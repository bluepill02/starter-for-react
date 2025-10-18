# Phase 2: Logging & Error Handling - Implementation Guide

## Overview

This document describes the comprehensive logging and error handling system implemented for the Recognition App. The system provides:

- **Structured JSON logging** for machine parsing and centralized log aggregation
- **PII redaction** to protect sensitive data (emails, phone numbers, tokens, etc.)
- **Error classification** and automatic recovery strategies
- **Request correlation tracking** across distributed systems
- **Circuit breaker pattern** for cascading failure prevention
- **Error deduplication** and anomaly detection
- **Retry logic** with exponential backoff and jitter

## Architecture

### Core Services

#### 1. StructuredLogger (`structured-logger.js`)
Centralized structured logging with PII protection.

**Features:**
- JSON output for machine parsing
- Correlation ID propagation
- Context-aware logging levels
- PII redaction using regex patterns
- Integration with monitoring systems

**Usage:**
```javascript
import { globalLogger, StructuredLogger } from './services/structured-logger.js';

// Use global logger
globalLogger.info('Operation started', { userId: 'user123' });
globalLogger.error('Operation failed', new Error('Details'));

// Create instance logger
const logger = new StructuredLogger({
  service: 'create-recognition',
  environment: 'production',
  minLevel: 'INFO',
  metadata: { functionId: 'rec-123' },
});

logger.info('Recognition created', { recognitionId: 'id123' });

// Create child logger with additional context
const childLogger = logger.child({ correlationId: 'corr-123' });
```

**PII Redaction:**
The logger automatically redacts:
- Email addresses
- Phone numbers (US format)
- Credit card numbers
- Social Security Numbers
- API keys and tokens
- Bearer tokens
- URLs with credentials
- IPv4 addresses (partial masking)

```javascript
import { redactObjectPII } from './services/structured-logger.js';

const data = {
  user: 'john@example.com',
  ssn: '123-45-6789',
  apiKey: 'sk_live_abcdef',
};

const safe = redactObjectPII(data);
// Output: {
//   user: '[EMAIL]',
//   ssn: '[SSN]',
//   apiKey: '[REDACTED]',
// }
```

#### 2. Error Handler (`error-handler.js`)
Comprehensive error handling with classification and recovery.

**Error Categories:**
- `VALIDATION_ERROR` (400) - Non-retryable
- `AUTH_ERROR` (401) - Non-retryable
- `AUTHZ_ERROR` (403) - Non-retryable
- `NOT_FOUND` (404) - Non-retryable
- `RATE_LIMIT` (429) - Retryable
- `CONFLICT` (409) - Retryable
- `EXTERNAL_SERVICE` (502) - Retryable
- `DATABASE_ERROR` (500) - Retryable
- `INTERNAL_ERROR` (500) - Non-retryable

**Retry Logic:**
```javascript
import { retryWithBackoff } from './services/error-handler.js';

// Simple retry with exponential backoff
const result = await retryWithBackoff(
  async () => externalApi.call(),
  3 // max attempts
);

// Custom retry predicate
const result = await retryWithBackoff(
  async () => fetchData(),
  5,
  (error) => error.statusCode === 502 // Only retry service unavailable
);
```

**Circuit Breaker Pattern:**
```javascript
import { CircuitBreaker } from './services/error-handler.js';

const breaker = new CircuitBreaker({
  failureThreshold: 5, // Open after 5 failures
  resetTimeout: 60000, // Try reset after 60s
  name: 'SlackIntegration',
});

try {
  await breaker.execute(async () => {
    return await slackClient.postMessage(channel, message);
  });
} catch (error) {
  if (error.code === 'CIRCUIT_BREAKER_OPEN') {
    // Circuit is open - Slack is down
    logger.warn('Slack circuit breaker open - skipping notification');
  } else {
    throw error;
  }
}

// Check state
console.log(breaker.getState());
// { state: 'CLOSED', failures: 0, failureThreshold: 5 }
```

**Error Tracking and Deduplication:**
```javascript
import { ErrorTracker, globalErrorTracker } from './services/error-handler.js';

// Automatically tracks errors globally
try {
  riskyOperation();
} catch (error) {
  const fingerprint = globalErrorTracker.track(error);
  // fingerprint: "abc123def456" - unique hash of error stack
}

// Get statistics
const stats = globalErrorTracker.getStats();
// {
//   totalUnique: 5,
//   totalOccurrences: 47,
//   topErrors: [
//     { fingerprint: 'abc123...', count: 15, lastSeen: 1697... },
//     ...
//   ]
// }
```

**Error Response Formatting:**
```javascript
import { formatErrorResponse } from './services/error-handler.js';

const response = formatErrorResponse(error, {
  hideDetails: false, // Set true in production
  includeSuggestions: true,
  retryAfter: 10, // seconds
});

// Response:
// {
//   code: 'RATE_LIMIT',
//   message: 'Rate limit exceeded',
//   statusCode: 429,
//   timestamp: '2025-10-18T...',
//   fingerprint: 'abc123def456', // For duplicate detection
//   suggestions: ['Please wait before retrying', '...'],
//   retryable: true,
//   retryAfter: 10,
// }
```

#### 3. Request Context (`request-context.js`)
Unified request/response context with correlation tracking.

**Express Middleware Integration:**
```javascript
import express from 'express';
import { requestContextMiddleware, errorHandlerMiddleware } from './services/request-context.js';

const app = express();

// Add context to all requests
app.use(requestContextMiddleware());

app.get('/api/recognitions', async (req, res, next) => {
  try {
    // Context automatically available
    const context = getRequestContext();
    logger.info('Fetching recognitions', {
      userId: context.userId,
      traceId: context.traceId,
    });
    res.json(recognitions);
  } catch (error) {
    next(error);
  }
});

// Global error handler
app.use(errorHandlerMiddleware());
```

**Request Context Usage:**
```javascript
import { 
  getRequestContext, 
  getContextLogger, 
  getCorrelationHeaders 
} from './services/request-context.js';

// Get current request context
const context = getRequestContext();
if (context) {
  console.log(context.correlationId); // Unique per request
  console.log(context.traceId);       // For distributed tracing
  console.log(context.userId);        // Current user
}

// Logger automatically includes context
const logger = getContextLogger();
logger.info('Processing recognition'); // Includes all context IDs

// Add correlation headers to external calls
const headers = {
  ...getCorrelationHeaders(),
  'Content-Type': 'application/json',
};

const response = await fetch('https://api.example.com/data', {
  headers,
});
```

**Manual Context Management:**
```javascript
import { withRequestContext } from './services/request-context.js';

const myFunction = withRequestContext(
  async (data) => {
    const context = getRequestContext();
    logger.info('Processing', { data, traceId: context.traceId });
    return processData(data);
  },
  {
    method: 'POST',
    path: '/process',
    userId: 'user123',
  }
);

const result = await myFunction({ key: 'value' });
```

## Integration Examples

### 1. Appwrite Function with Full Instrumentation

```javascript
import { Client, Functions } from 'node-appwrite';
import { globalLogger, StructuredLogger } from '../services/structured-logger.js';
import { retryWithBackoff, classifyError } from '../services/error-handler.js';
import { withRequestContext, getRequestContext } from '../services/request-context.js';

export default async function handler(req, res) {
  const context = await withRequestContext(
    async () => {
      const logger = getRequestContext()?.logger || globalLogger;

      try {
        logger.info('Function invoked', {
          payload: req.body,
        });

        // Retry database operations
        const result = await retryWithBackoff(async () => {
          return await db.createDocument(
            process.env.DATABASE_ID,
            'recognitions',
            ID.unique(),
            req.body
          );
        });

        logger.info('Document created', {
          documentId: result.$id,
        });

        return res.json({ success: true, data: result });
      } catch (error) {
        const category = classifyError(error);
        logger.error('Function failed', {
          error: formatError(error),
          category: category.code,
        });

        return res.status(category.statusCode).json({
          error: category.code,
          message: hideDetails ? 'An error occurred' : error.message,
        });
      }
    },
    {
      method: 'POST',
      path: '/functions/create-recognition',
      userId: req.headers['x-user-id'],
    }
  );

  return context;
}
```

### 2. External API Call with Circuit Breaker

```javascript
import { CircuitBreaker, retryWithBackoff } from '../services/error-handler.js';
import { getCorrelationHeaders, getContextLogger } from '../services/request-context.js';

const slackBreaker = new CircuitBreaker({
  name: 'SlackAPI',
  failureThreshold: 5,
  resetTimeout: 300000, // 5 minutes
});

const logger = getContextLogger();

export async function sendSlackNotification(channel, message) {
  try {
    return await slackBreaker.execute(() =>
      retryWithBackoff(async () => {
        const response = await fetch('https://slack.com/api/chat.postMessage', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.SLACK_TOKEN}`,
            ...getCorrelationHeaders(),
          },
          body: JSON.stringify({
            channel,
            text: message,
          }),
        });

        if (!response.ok) {
          throw new Error(`Slack API error: ${response.statusCode}`);
        }

        return await response.json();
      }, 3)
    );
  } catch (error) {
    logger.error('Failed to send Slack notification', { error, channel });
    throw error;
  }
}
```

### 3. Database Layer with Retry Logic

```javascript
import { retryWithBackoff, classifyError } from '../services/error-handler.js';
import { getContextLogger } from '../services/request-context.js';

const logger = getContextLogger();

export async function getRecognitions(userId, limit = 50, offset = 0) {
  return retryWithBackoff(
    async () => {
      logger.debug('Querying recognitions', { userId, limit, offset });

      const result = await databases.listDocuments(
        process.env.DATABASE_ID,
        'recognitions',
        [
          Query.equal('recipientId', userId),
          Query.orderDesc('createdAt'),
        ],
        limit,
        offset
      );

      logger.info('Recognition query successful', {
        count: result.documents.length,
        total: result.total,
      });

      return result;
    },
    3,
    (error) => {
      const category = classifyError(error);
      return category.retryable;
    }
  );
}
```

## Monitoring Integration

### Prometheus Metrics

The logging system automatically exposes metrics:

```
# Log levels
log_debug_total{service="...", environment="..."}
log_info_total{service="...", environment="..."}
log_warn_total{service="...", environment="..."}
log_error_total{service="...", environment="..."}
log_critical_total{service="...", environment="..."}

# Error tracking
error_fingerprint_total{fingerprint="...", name="..."}
circuit_breaker_state{name="...", state="OPEN|CLOSED|HALF_OPEN"}
```

### Centralized Log Aggregation

Configure your logging backend:

**CloudWatch (AWS):**
```javascript
import { CloudWatchTransport } from 'winston-cloudwatch';

// Logs are automatically JSON formatted for CloudWatch
```

**ELK Stack (Elasticsearch):**
```javascript
const logEntry = {
  timestamp: new Date().toISOString(),
  level: 'ERROR',
  correlationId: 'corr-123',
  traceId: 'trace-456',
  service: 'create-recognition',
  message: 'Operation failed',
  error: {
    name: 'ValidationError',
    message: 'Invalid input',
    fingerprint: 'abc123',
  },
};

// Send to Elasticsearch for indexing and analysis
```

**DataDog:**
```javascript
// JSON logs are automatically parsed by DataDog
// Correlation IDs enable trace correlation
// Error fingerprints enable duplicate detection
```

## Testing

Run the comprehensive test suite:

```bash
npm test -- logging-error-handling.test.js
```

**Test Coverage:**
- ✅ Structured logging with PII redaction
- ✅ Error classification and recovery
- ✅ Retry logic and exponential backoff
- ✅ Circuit breaker state transitions
- ✅ Error deduplication and tracking
- ✅ Request context propagation
- ✅ Error response formatting

## Best Practices

1. **Always use `getContextLogger()`** in functions to automatically include correlation context
2. **Log at appropriate levels**: DEBUG for detailed flow, INFO for business events, WARN for recoverable issues, ERROR for failures, CRITICAL for system-wide issues
3. **Use structured data**: Pass objects with context, not string concatenation
4. **Redact sensitive data**: The logger does this automatically, but verify in tests
5. **Use circuit breakers** for external service calls to prevent cascading failures
6. **Implement retry logic** for transient failures (network, rate limits, etc.)
7. **Track errors** to detect patterns and recurring issues
8. **Include correlation IDs** in external calls for distributed tracing

## Migration Guide

### From Old Logging

**Before:**
```javascript
console.log('User created:', user.id, user.email);
```

**After:**
```javascript
logger.info('User created', { userId: user.id, email: user.email });
// Email is automatically redacted
```

### From Manual Error Handling

**Before:**
```javascript
try {
  await db.query(sql);
} catch (error) {
  console.error('Query failed:', error.message);
  throw error;
}
```

**After:**
```javascript
try {
  return await retryWithBackoff(() => db.query(sql), 3);
} catch (error) {
  logger.error('Query failed', error);
  throw error;
}
```

## Troubleshooting

### Missing Correlation IDs in Logs

**Issue:** Logs don't contain correlation IDs

**Solution:**
```javascript
// Ensure middleware is registered first
app.use(requestContextMiddleware());
app.use(routes); // Routes come after
```

### PII Not Redacting Custom Patterns

**Issue:** Custom sensitive data not being redacted

**Solution:**
```javascript
const logger = new StructuredLogger({
  sensitiveKeys: new Set(['customField', 'internalId']),
});
```

### Circuit Breaker Stuck in Open

**Issue:** Circuit breaker won't recover

**Solution:**
```javascript
// Manually reset if needed
breaker.reset();

// Or increase resetTimeout
const breaker = new CircuitBreaker({
  resetTimeout: 600000, // 10 minutes
});
```

## Next Steps

1. Integrate with Grafana dashboards (created in Phase 2)
2. Setup alerting for critical logs
3. Configure log retention and archival
4. Implement log sampling for high-volume scenarios
5. Add distributed tracing (Jaeger/OpenTelemetry)

---

**Created:** October 18, 2025  
**Version:** 1.0.0  
**Status:** Production Ready
