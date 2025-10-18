# Rate Limiting & Audit Logging Implementation Guide

## Overview

The Recognition app implements a comprehensive rate limiting and audit logging system to ensure:
- **Abuse Prevention**: Rate limits prevent spam, excessive recognition creation, and brute-force attacks
- **Compliance**: Immutable audit trail for regulatory compliance and investigations
- **Security**: Detection of suspicious patterns and unauthorized access attempts
- **Performance**: In-memory rate limiting with persistent backup for multi-instance deployments

## Architecture

### Rate Limiting Service

**Location**: `/apps/api/functions/services/rate-limiter.js`

**Features**:
- In-memory rate limit store with automatic TTL management
- Multiple rate limit tiers for different operations
- Configurable time windows and max attempts
- Persistent fallback to Appwrite Database for monitoring
- HTTP middleware support with standard headers

**Rate Limit Types**:

```javascript
{
  recognition_daily: { maxAttempts: 10, windowMs: 24h },      // 10 recognitions/day
  recognition_weekly: { maxAttempts: 50, windowMs: 7d },      // 50 recognitions/week
  recognition_monthly: { maxAttempts: 100, windowMs: 30d },   // 100 recognitions/month
  auth_signin: { maxAttempts: 5, windowMs: 5min },           // 5 failed attempts/5min
  auth_signup: { maxAttempts: 3, windowMs: 1h },             // 3 signup attempts/hour
  auth_password_reset: { maxAttempts: 3, windowMs: 1h },     // 3 password resets/hour
  export_profile: { maxAttempts: 5, windowMs: 24h },         // 5 exports/day
  integration_slack: { maxAttempts: 100, windowMs: 1h },     // 100 calls/hour
  integration_teams: { maxAttempts: 100, windowMs: 1h },     // 100 calls/hour
  api_general: { maxAttempts: 1000, windowMs: 1h },          // 1000 requests/hour
}
```

### Audit Logging Service

**Location**: `/apps/api/functions/services/audit-logger.js`

**Features**:
- Immutable audit trail stored in Appwrite Database
- Privacy-safe hashed user IDs
- IP address and user agent tracking
- Comprehensive metadata logging
- Query/filtering capabilities
- Suspicious pattern detection
- Audit report generation

**Event Codes**:

```javascript
// Recognition operations
RECOGNITION_CREATED        // Recognition successfully created
RECOGNITION_VERIFIED       // Recognition verified by manager
RECOGNITION_EXPORTED       // Profile exported by user
RECOGNITION_BLOCKED        // Recognition blocked by rate limit/abuse

// Evidence operations
EVIDENCE_UPLOADED          // Evidence file uploaded
EVIDENCE_PREVIEWED         // Evidence preview generated
EVIDENCE_DELETED           // Evidence deleted

// Authentication operations
AUTH_SIGNIN_SUCCESS        // Successful sign-in
AUTH_SIGNIN_FAILED         // Failed sign-in attempt
AUTH_SIGNUP                // New user signup
AUTH_SIGNOUT               // User signed out
AUTH_OAUTH_SUCCESS         // OAuth sign-in successful
AUTH_OAUTH_FAILED          // OAuth sign-in failed
AUTH_RATE_LIMITED          // Rate limit hit during auth

// Admin operations
ADMIN_ACTION               // Admin performed action
ADMIN_OVERRIDE             // Admin override of system decision
ABUSE_FLAGGED              // Recognition flagged as abuse
ABUSE_REVIEWED             // Abuse flag reviewed
ABUSE_DISMISSED            // Abuse flag dismissed

// System operations
USER_SYNCED                // User synced via SCIM
INTEGRATION_CALLED         // Integration endpoint called
TELEMETRY_EVENT            // Analytics event logged
RATE_LIMIT_BREACH          // Rate limit breach detected
EXPORT_REQUESTED           // Export requested
```

## Usage

### Using Rate Limiting

**1. Import the service**:
```javascript
const { checkRateLimit, checkRateLimitMiddleware } = require('../services/rate-limiter');
```

**2. Check rate limit in function handler**:
```javascript
export default async function createRecognition({ req, res }) {
  const userId = req.headers['x-user-id'];
  
  // Check daily recognition limit
  const result = await checkRateLimit(
    `recognition_daily:${userId}`,
    'recognition_daily'
  );
  
  if (!result.allowed) {
    return res.json({
      success: false,
      error: `Rate limit exceeded. Try again in ${result.retryAfter} seconds`,
      metadata: { retryAfter: result.retryAfter, resetAt: result.resetAt }
    }, 429);
  }
  
  // ... create recognition
  return res.json({ success: true, data: recognition });
}
```

**3. Use middleware helper**:
```javascript
const middleware = await checkRateLimitMiddleware(
  'recognition_daily',
  `recognition_daily:${userId}`,
  databases
);

if (!middleware.allowed) {
  return res.json(middleware.body, middleware.statusCode);
}

// Add rate limit headers to response
Object.entries(middleware.headers).forEach(([key, value]) => {
  res.addHeader(key, value);
});
```

**4. Reset rate limit (for admin/testing)**:
```javascript
const { resetRateLimit } = require('../services/rate-limiter');

resetRateLimit(`recognition_daily:${userId}`);
```

### Using Audit Logging

**1. Import the service**:
```javascript
const { createAuditLog, AuditEventCodes } = require('../services/audit-logger');
```

**2. Log events**:
```javascript
export default async function createRecognition({ req, res }) {
  const userId = req.headers['x-user-id'];
  const databases = new Databases(client);
  
  try {
    // ... create recognition logic
    const recognition = { $id: 'rec_123', ... };
    
    // Log successful creation
    await createAuditLog(
      databases,
      AuditEventCodes.RECOGNITION_CREATED,
      userId,
      recognition.$id,
      {
        recipientEmail: hashUserId(recipientEmail),
        tags,
        evidenceCount: evidenceIds.length,
        weight,
        visibility,
        source: 'WEB'
      },
      req  // HTTP request for IP/user agent
    );
    
    return res.json({ success: true, data: recognition });
  } catch (error) {
    // Log error event
    await createAuditLog(
      databases,
      AuditEventCodes.RECOGNITION_ERROR,
      userId,
      null,
      { error: error.message, endpoint: '/create-recognition' },
      req
    );
    
    return res.json({ success: false, error: error.message }, 500);
  }
}
```

**3. Query audit logs**:
```javascript
const { queryAuditLogs } = require('../services/audit-logger');

// Get audit logs for a specific user
const logs = await queryAuditLogs(databases, {
  actorId: userId,
  startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
  limit: 100
});

console.log(`Total events: ${logs.total}`);
logs.entries.forEach(entry => {
  console.log(`${entry.eventCode} at ${entry.createdAt}`);
});
```

**4. Get audit summary**:
```javascript
const { getAuditSummary } = require('../services/audit-logger');

const summary = await getAuditSummary(databases, userId, 30); // Last 30 days
console.log('Event counts:', summary.eventCounts);
console.log('Suspicious patterns:', summary.suspiciousPatterns);
```

**5. Generate audit report**:
```javascript
const { generateAuditReport } = require('../services/audit-logger');

const report = await generateAuditReport(databases, {
  startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
  endDate: new Date(),
  suspiciousThreshold: 100
});

console.log('Total events:', report.statistics.totalEvents);
console.log('Top event types:', report.topEvents);
console.log('Suspicious activities:', report.statistics.suspiciousActivities);
```

## Integration with Existing Functions

### create-recognition

Add rate limiting and audit logging:

```javascript
// At the start of the function
const { checkRateLimit } = require('../services/rate-limiter');
const { createAuditLog, AuditEventCodes } = require('../services/audit-logger');

const rateLimit = await checkRateLimit(
  `recognition_daily:${giverUserId}`,
  'recognition_daily'
);

if (!rateLimit.allowed) {
  await createAuditLog(
    databases,
    AuditEventCodes.RECOGNITION_BLOCKED,
    giverUserId,
    null,
    { reason: 'Daily limit exceeded', rateLimitType: 'daily' },
    req
  );
  return res.json({ success: false, error: 'Daily limit exceeded' }, 429);
}

// ... create recognition ...

// After successful creation
await createAuditLog(
  databases,
  AuditEventCodes.RECOGNITION_CREATED,
  giverUserId,
  recognitionId,
  { ... metadata ... },
  req
);
```

### Authentication Function

Add auth rate limiting:

```javascript
const { checkRateLimit } = require('../services/rate-limiter');
const { createAuditLog, AuditEventCodes } = require('../services/audit-logger');

export default async function signIn({ req, res }) {
  const { email, password } = JSON.parse(req.body);
  
  // Get client IP for rate limiting key
  const clientIp = req.headers['x-forwarded-for']?.split(',')[0] || 'unknown';
  
  // Check rate limit
  const rateLimit = await checkRateLimit(
    `auth_signin:${clientIp}`,
    'auth_signin'
  );
  
  if (!rateLimit.allowed) {
    await createAuditLog(
      databases,
      AuditEventCodes.AUTH_RATE_LIMITED,
      'anonymous',
      null,
      { email: hashUserId(email), ipAddress: clientIp },
      req
    );
    return res.json(
      { success: false, error: 'Too many attempts. Try again later.' },
      429
    );
  }
  
  try {
    const user = await account.createEmailPasswordSession(email, password);
    
    // Log successful sign-in
    await createAuditLog(
      databases,
      AuditEventCodes.AUTH_SIGNIN_SUCCESS,
      user.$id,
      null,
      { email, method: 'email/password' },
      req
    );
    
    return res.json({ success: true, data: user });
  } catch (error) {
    // Log failed sign-in
    await createAuditLog(
      databases,
      AuditEventCodes.AUTH_SIGNIN_FAILED,
      'anonymous',
      null,
      { email: hashUserId(email), error: error.message },
      req
    );
    
    return res.json({ success: false, error: 'Invalid credentials' }, 401);
  }
}
```

## Database Collections

### audit_entries Collection

```typescript
{
  $id: string,                    // Auto-generated
  eventCode: string,              // Event type (from AuditEventCodes)
  actorId: string,                // Hashed user ID
  targetId: string (optional),    // Hashed resource ID
  metadata: string (JSON),        // Event-specific metadata
  ipAddress: string,              // Client IP address
  userAgent: string,              // Browser/client info
  createdAt: string (ISO 8601),   // Timestamp
  
  // Indexes
  indexes: [
    'eventCode',
    'actorId',
    'targetId',
    'createdAt'
  ]
}
```

### rate_limit_breaches Collection

```typescript
{
  $id: string,                    // Auto-generated
  limitKey: string,               // Rate limit key
  limitType: string,              // Type of limit
  breachedAt: string (ISO 8601),  // When breach occurred
  resetAt: string (ISO 8601),     // When limit resets
  metadata: string (JSON),        // Limit config and state
  createdAt: string (ISO 8601),   // Timestamp
}
```

## Monitoring & Alerts

### Key Metrics to Monitor

1. **Rate Limit Breaches**:
   - Count of rate limit breaches per type
   - Trend over time
   - Users with most breaches

2. **Suspicious Activity**:
   - Rapid authentication failures
   - Unusual recognition creation patterns
   - Admin action errors
   - Multiple rate limit breaches

3. **Audit Events**:
   - Total events per type
   - Events by actor (top users)
   - Events by date (volume trends)

### Alert Triggers

```javascript
// High-priority alerts
if (suspiciousPatterns.length > 0) {
  // Alert if suspicious patterns detected for a user
  await alertSecurityTeam({
    severity: 'MEDIUM',
    message: `Suspicious activity detected for user ${userId}`,
    patterns: suspiciousPatterns
  });
}

// Critical alerts
if (authFailures >= 10 && timePeriod <= 15 * 60 * 1000) {
  // Alert on potential brute-force attack
  await alertSecurityTeam({
    severity: 'CRITICAL',
    message: `Potential brute-force attack from ${ipAddress}`,
    failures: authFailures,
    timeWindow: '15 minutes'
  });
}
```

## Privacy Considerations

- **User IDs are hashed** using Base64 encoding for privacy
- **Metadata contains hashed IDs** for recognition and evidence records
- **IP addresses are tracked** for security analysis only
- **No PII is logged** except as hashed identifiers
- **Audit logs are immutable** and cannot be modified or deleted
- **Access is restricted** to admin and security teams

## Testing

### Test Rate Limiting

```bash
# Test recognition daily limit
curl -X POST http://localhost/api/functions/create-recognition \
  -H "x-user-id: test-user" \
  -d '{"recipientEmail":"user@example.com","reason":"Great work!...","tags":["teamwork"]}'

# Run 11 times to hit the 10 recognition/day limit
# On the 11th request, should get 429 Too Many Requests
```

### Test Audit Logging

```bash
# Query audit logs for a specific user
curl "http://localhost/api/audit-logs?actorId=test-user&eventCode=RECOGNITION_CREATED"

# Generate audit report
curl "http://localhost/api/audit-report?days=30"
```

## Troubleshooting

### Rate Limit Not Working

1. Check rate limiter service is imported correctly
2. Verify rate limit key is unique and consistent
3. Check in-memory store size: `getStatistics().totalEntries`
4. Verify database connection for persistence

### Audit Logs Not Appearing

1. Check `audit_entries` collection exists in database
2. Verify `createAuditLog()` calls are awaited
3. Check for errors in function logs
4. Verify user ID is being passed correctly

### False Positives in Suspicious Patterns

1. Adjust pattern thresholds in `detectSuspiciousPatterns()`
2. Add user-specific exceptions
3. Implement whitelist for known bulk operations
4. Review suspicious pattern detection algorithm

## Performance Considerations

- **In-memory store**: Grows with concurrent users, auto-cleanup every 5 minutes
- **Database writes**: Rate limit breaches only written on denial (not every request)
- **Audit logging**: All events written to database (async, non-blocking)
- **Query performance**: Use indexes on eventCode, actorId, targetId, createdAt
- **Report generation**: Can handle up to 10,000 events, use date ranges for larger datasets

## Security Best Practices

1. **Rotate audit logs** monthly to archive storage
2. **Restrict audit log access** to admin/security teams only
3. **Monitor rate limiter** for potential DoS attacks
4. **Review audit reports** weekly for suspicious patterns
5. **Alert on threshold breaches** to security team
6. **Document all admin overrides** with justification
7. **Audit the auditors** - track who accesses audit logs

---

**Created**: October 18, 2025
**Status**: Ready for Integration
