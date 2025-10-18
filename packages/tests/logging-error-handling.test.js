/**
 * Unit tests for logging and error handling services
 * Tests: structured logger, error handler, request context, and PII redaction
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  StructuredLogger,
  redactPII,
  redactObjectPII,
  generateErrorFingerprint,
} from '../services/structured-logger.js';
import {
  classifyError,
  getRetryDelay,
  retryWithBackoff,
  CircuitBreaker,
  formatErrorResponse,
  ErrorTracker,
} from '../services/error-handler.js';
import {
  RequestContext,
  getRequestContext,
  withRequestContext,
} from '../services/request-context.js';

describe('StructuredLogger', () => {
  let logger;

  beforeEach(() => {
    logger = new StructuredLogger({
      service: 'test-service',
      environment: 'test',
      minLevel: 'DEBUG',
    });
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    console.log.mockRestore();
  });

  it('should create logger with correct context', () => {
    const context = logger.buildLogContext();
    expect(context.service).toBe('test-service');
    expect(context.environment).toBe('test');
    expect(context.correlationId).toBeDefined();
  });

  it('should log at different levels', () => {
    logger.info('Test info', { key: 'value' });
    logger.warn('Test warning', { key: 'value' });
    logger.error('Test error', new Error('Test error'));

    expect(console.log).toHaveBeenCalled();
  });

  it('should create child logger with inherited context', () => {
    const child = logger.child({ userId: 'user123' });
    expect(child.correlationId).toBe(logger.correlationId);
    expect(child.metadata.userId).toBe('user123');
  });

  it('should redact PII in data', () => {
    const data = {
      email: 'test@example.com',
      password: 'secret123',
      normal: 'data',
    };

    const redacted = redactObjectPII(data, new Set(['password']));
    expect(redacted.email).toContain('[EMAIL]');
    expect(redacted.password).toBe('[REDACTED]');
    expect(redacted.normal).toBe('data');
  });

  it('should generate consistent error fingerprints', () => {
    const error1 = new Error('Test error');
    const error2 = new Error('Test error');

    const fp1 = generateErrorFingerprint(error1);
    const fp2 = generateErrorFingerprint(error2);

    expect(fp1).toBe(fp2);
    expect(fp1).toHaveLength(12);
  });
});

describe('PII Redaction', () => {
  it('should redact email addresses', () => {
    const text = 'Contact me at john@example.com';
    const redacted = redactPII(text);
    expect(redacted).toContain('[EMAIL]');
    expect(redacted).not.toContain('john@example.com');
  });

  it('should redact phone numbers', () => {
    const text = 'Call me at (555) 123-4567';
    const redacted = redactPII(text);
    expect(redacted).toContain('[PHONE]');
  });

  it('should redact credit card numbers', () => {
    const text = 'Card: 4532-1111-1111-1111';
    const redacted = redactPII(text);
    expect(redacted).toContain('[CARD]');
  });

  it('should redact API keys', () => {
    const text = 'api_key: sk_live_abcdefghijklmnopqrst';
    const redacted = redactPII(text);
    expect(redacted).toContain('[REDACTED]');
  });

  it('should redact SSNs', () => {
    const text = 'SSN: 123-45-6789';
    const redacted = redactPII(text);
    expect(redacted).toContain('[SSN]');
  });

  it('should handle deep object redaction', () => {
    const obj = {
      user: {
        name: 'John',
        email: 'john@example.com',
        credentials: {
          password: 'secret123',
        },
      },
    };

    const redacted = redactObjectPII(obj, new Set(['password']));
    expect(redacted.user.email).toContain('[EMAIL]');
    expect(redacted.user.credentials.password).toBe('[REDACTED]');
  });
});

describe('Error Classification', () => {
  it('should classify validation errors', () => {
    const error = new Error('Validation failed');
    const category = classifyError(error);
    expect(category.code).toBe('VALIDATION_ERROR');
    expect(category.statusCode).toBe(400);
    expect(category.retryable).toBe(false);
  });

  it('should classify authentication errors', () => {
    const error = new Error('Unauthorized');
    const category = classifyError(error);
    expect(category.code).toBe('AUTH_ERROR');
    expect(category.statusCode).toBe(401);
  });

  it('should classify rate limit errors', () => {
    const error = new Error('Rate limit exceeded');
    const category = classifyError(error);
    expect(category.code).toBe('RATE_LIMIT');
    expect(category.retryable).toBe(true);
  });

  it('should classify database errors', () => {
    const error = new Error('Database connection failed');
    const category = classifyError(error);
    expect(category.code).toBe('DATABASE_ERROR');
    expect(category.retryable).toBe(true);
  });
});

describe('Retry Logic', () => {
  it('should calculate exponential backoff delay', () => {
    const delay0 = getRetryDelay(0, 100);
    const delay1 = getRetryDelay(1, 100);
    const delay2 = getRetryDelay(2, 100);

    expect(delay0).toBeLessThanOrEqual(110);
    expect(delay1).toBeLessThanOrEqual(220);
    expect(delay2).toBeLessThanOrEqual(440);
  });

  it('should retry operation on failure', async () => {
    let attempts = 0;
    const fn = async () => {
      attempts += 1;
      if (attempts < 3) {
        throw new Error('Temporary failure');
      }
      return 'success';
    };

    const result = await retryWithBackoff(fn, 5);
    expect(result).toBe('success');
    expect(attempts).toBe(3);
  });

  it('should fail after max attempts', async () => {
    const fn = async () => {
      throw new Error('Permanent failure');
    };

    await expect(retryWithBackoff(fn, 3)).rejects.toThrow('Permanent failure');
  });

  it('should respect custom retry predicate', async () => {
    let attempts = 0;
    const shouldRetry = (err) => err.message.includes('retry');
    const fn = async () => {
      attempts += 1;
      throw new Error('No retry');
    };

    await expect(retryWithBackoff(fn, 3, shouldRetry)).rejects.toThrow('No retry');
    expect(attempts).toBe(1); // Should not retry
  });
});

describe('CircuitBreaker', () => {
  it('should close after successful calls', async () => {
    const breaker = new CircuitBreaker({ failureThreshold: 3 });
    const fn = async () => 'success';

    await breaker.execute(fn);
    expect(breaker.state).toBe('CLOSED');
    expect(breaker.failures).toBe(0);
  });

  it('should open after threshold failures', async () => {
    const breaker = new CircuitBreaker({ failureThreshold: 2 });
    const fn = async () => {
      throw new Error('Failure');
    };

    for (let i = 0; i < 2; i++) {
      try {
        await breaker.execute(fn);
      } catch {
        // Expected
      }
    }

    expect(breaker.state).toBe('OPEN');
  });

  it('should reject requests when open', async () => {
    const breaker = new CircuitBreaker({ failureThreshold: 1, name: 'TestBreaker' });

    try {
      await breaker.execute(async () => {
        throw new Error('Failure');
      });
    } catch {
      // Expected
    }

    await expect(breaker.execute(async () => 'success')).rejects.toThrow('OPEN');
  });

  it('should transition to half-open after timeout', async () => {
    const breaker = new CircuitBreaker({
      failureThreshold: 1,
      resetTimeout: 100,
    });

    try {
      await breaker.execute(async () => {
        throw new Error('Failure');
      });
    } catch {
      // Expected
    }

    expect(breaker.state).toBe('OPEN');

    // Wait for timeout
    await new Promise(resolve => setTimeout(resolve, 150));

    // Next attempt should transition to HALF_OPEN
    try {
      await breaker.execute(async () => {
        throw new Error('Failure');
      });
    } catch {
      // Expected
    }

    expect(breaker.state).toBe('OPEN'); // Still open as it failed in HALF_OPEN
  });

  it('should reset when successful in half-open', async () => {
    const breaker = new CircuitBreaker({
      failureThreshold: 1,
      resetTimeout: 100,
    });

    // Trigger open state
    try {
      await breaker.execute(async () => {
        throw new Error('Failure');
      });
    } catch {
      // Expected
    }

    // Wait for timeout
    await new Promise(resolve => setTimeout(resolve, 150));

    // Successful call in HALF_OPEN should reset
    await breaker.execute(async () => 'success');
    expect(breaker.state).toBe('CLOSED');
  });
});

describe('ErrorTracker', () => {
  it('should track error occurrences', () => {
    const tracker = new ErrorTracker();
    const error = new Error('Test error');

    const fp1 = tracker.track(error);
    const fp2 = tracker.track(error);

    expect(fp1).toBe(fp2);
    const stats = tracker.getStats();
    expect(stats.totalOccurrences).toBeGreaterThanOrEqual(2);
  });

  it('should detect recurring errors', () => {
    const tracker = new ErrorTracker({ dedupWindow: 1000 });
    const error = new Error('Test error');

    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    for (let i = 0; i < 6; i++) {
      tracker.track(error);
    }

    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('should maintain error statistics', () => {
    const tracker = new ErrorTracker();
    const error1 = new Error('Error 1');
    const error2 = new Error('Error 2');

    for (let i = 0; i < 5; i++) tracker.track(error1);
    for (let i = 0; i < 3; i++) tracker.track(error2);

    const stats = tracker.getStats();
    expect(stats.totalUnique).toBe(2);
    expect(stats.totalOccurrences).toBe(8);
    expect(stats.topErrors[0].count).toBe(5);
  });
});

describe('RequestContext', () => {
  it('should create context with unique IDs', () => {
    const context = new RequestContext({
      method: 'GET',
      path: '/test',
    });

    expect(context.correlationId).toBeDefined();
    expect(context.traceId).toBeDefined();
    expect(context.requestId).toBeDefined();
    expect(context.method).toBe('GET');
    expect(context.path).toBe('/test');
  });

  it('should track request duration', async () => {
    const context = new RequestContext();
    await new Promise(resolve => setTimeout(resolve, 100));
    context.end();

    const duration = context.getDuration();
    expect(duration).toBeGreaterThanOrEqual(90);
  });

  it('should add and retrieve metadata', () => {
    const context = new RequestContext();
    context.addMetadata('userId', 'user123');
    context.addMetadata('action', 'create');

    const summary = context.getSummary();
    expect(summary.metadata.userId).toBe('user123');
    expect(summary.metadata.action).toBe('create');
  });

  it('should create context with async storage', async () => {
    const contextData = {
      method: 'POST',
      path: '/api/test',
      userId: 'user123',
    };

    const fn = async () => {
      const context = getRequestContext();
      return context?.getSummary();
    };

    const wrappedFn = withRequestContext(fn, contextData);
    const result = await wrappedFn();

    expect(result.method).toBe('POST');
    expect(result.userId).toBe('user123');
  });
});

describe('Format Error Response', () => {
  it('should format validation error response', () => {
    const error = new Error('Validation failed');
    const response = formatErrorResponse(error, { hideDetails: false });

    expect(response.code).toBe('VALIDATION_ERROR');
    expect(response.statusCode).toBe(400);
    expect(response.retryable).toBeUndefined();
  });

  it('should format retryable error response', () => {
    const error = new Error('Rate limit exceeded');
    const response = formatErrorResponse(error, { hideDetails: false, retryAfter: 10 });

    expect(response.code).toBe('RATE_LIMIT');
    expect(response.statusCode).toBe(429);
    expect(response.retryable).toBe(true);
    expect(response.retryAfter).toBe(10);
  });

  it('should hide details in production', () => {
    const error = new Error('Sensitive error details');
    const response = formatErrorResponse(error, { hideDetails: true });

    expect(response.message).toBe('An error occurred');
    expect(response.fingerprint).toBeUndefined();
  });
});
