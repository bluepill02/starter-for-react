# Phase 3A Quick Reference - Developer Cheatsheet

## Services Quick Start

### 1. Idempotency (Prevent Duplicates)

**In your function:**
```javascript
import { idempotencyMiddleware, storeIdempotencyRecord } from '../services/idempotency.js';

export default async (req, res) => {
  // Check for duplicate
  const idempotency = await idempotencyMiddleware(req);
  if (idempotency.isDuplicate) {
    return res.json(idempotency.cachedResponse, 200);
  }

  // Do your work...
  const result = await doWork();

  // Store for future retries
  await storeIdempotencyRecord(
    idempotency.idempotencyKey,
    userId,
    'operation_type',
    result
  );

  return res.json(result);
};
```

**Client usage:**
```javascript
const response = await fetch('/api/..', {
  headers: { 'Idempotency-Key': crypto.randomUUID() }
});
```

---

### 2. Request Logging (Enable Tracing)

**In your function:**
```javascript
import { createRequestContext, executeWithLogging, executeDatabaseOperation } from '../services/request-logger.js';

export default async (req, res) => {
  // Create trace context
  const ctx = createRequestContext(req);

  // Wrap business logic
  const result = await executeWithLogging(
    'function-name',
    ctx.traceId,
    async () => {
      return executeDatabaseOperation(
        ctx.traceId,
        'CREATE',
        'collection-name',
        async () => {
          return databases.createDocument(...);
        }
      );
    }
  );

  // Return with trace ID
  res.setHeader('X-Trace-Id', ctx.traceId);
  return res.json(result);
};
```

**Log output (automatically structured):**
```json
{"type": "REQUEST_INCOMING", "traceId": "abc123...", "path": "/api/..."}
{"type": "DATABASE_OPERATION", "traceId": "abc123...", "operation": "CREATE", "duration": "245ms"}
{"type": "REQUEST_COMPLETE", "traceId": "abc123...", "statusCode": 200}
```

---

### 3. Safe Migrations (Prevent Data Loss)

**Define a migration:**
```javascript
const migrationFn = async (context, databases, DATABASE_ID) => {
  // Make your schema changes
  // On success: context.changes.push('description')
  // On error: context.errors.push('error message')
};

const verifyFn = async (databases, DATABASE_ID) => {
  // Verify your changes worked
  return { success: true, message: 'Verified' };
};
```

**Execute migration:**
```javascript
import { executeMigration } from '../scripts/safe-migration-runner.js';

const result = await executeMigration(
  'migration-name',
  migrationFn,
  {
    backupCollections: ['collection1', 'collection2'],
    verifyFn,
    dryRun: false,  // Test with true first!
  }
);
```

---

### 4. Health Checks (Kubernetes Ready)

**Endpoints (auto-deployed):**
- `GET /functions/health-check?path=/live` → 200 (service running)
- `GET /functions/health-check?path=/ready` → 200 (ready for traffic)
- `GET /functions/health-check?path=/health` → 200 (detailed status)

**In Kubernetes:**
```yaml
livenessProbe:
  httpGet:
    path: /functions/health-check
    query: path=/live
  initialDelaySeconds: 10
  periodSeconds: 30

readinessProbe:
  httpGet:
    path: /functions/health-check
    query: path=/ready
  initialDelaySeconds: 5
  periodSeconds: 10
```

---

## Integration Patterns

### Pattern 1: Create-like Operations (idempotency + logging)
```javascript
export default async (req, res) => {
  const ctx = createRequestContext(req);
  const idempotency = await idempotencyMiddleware(req);

  if (idempotency.isDuplicate) {
    return res.json(idempotency.cachedResponse);
  }

  const result = await executeWithLogging('create-op', ctx.traceId, async () => {
    return executeDatabaseOperation(ctx.traceId, 'CREATE', 'collection', async () => {
      return databases.createDocument(DATABASE_ID, 'collection', ID.unique(), data);
    });
  });

  await storeIdempotencyRecord(idempotency.idempotencyKey, userId, 'create_op', result);
  res.setHeader('X-Trace-Id', ctx.traceId);
  return res.json(result);
};
```

### Pattern 2: Query/List Operations (logging only, no idempotency)
```javascript
export default async (req, res) => {
  const ctx = createRequestContext(req);

  const results = await executeWithLogging('list-op', ctx.traceId, async () => {
    return executeDatabaseOperation(ctx.traceId, 'LIST', 'collection', async () => {
      return databases.listDocuments(DATABASE_ID, 'collection');
    });
  });

  res.setHeader('X-Trace-Id', ctx.traceId);
  return res.json(results);
};
```

### Pattern 3: External API Calls (tracing + error handling)
```javascript
export default async (req, res) => {
  const ctx = createRequestContext(req);

  try {
    const slackResponse = await executeExternalCall(
      ctx.traceId,
      'slack',
      'POST',
      '/send',
      async () => fetch('https://hooks.slack.com/...', {
        headers: { 'X-Trace-Id': ctx.traceId }
      })
    );
    res.setHeader('X-Trace-Id', ctx.traceId);
    return res.json({ ok: true });
  } catch (error) {
    res.setHeader('X-Trace-Id', ctx.traceId);
    return res.json({ error: error.message }, 500);
  }
};
```

---

## Testing Idempotency

**Test duplicate detection:**
```bash
# Store trace ID from first request
TRACE_ID=$(curl -X POST http://localhost/api/create \
  -H "Idempotency-Key: test-key-123" \
  -H "Content-Type: application/json" \
  -d '{"data": "test"}' \
  -H "X-Trace-Id: trace-123" | jq -r '.trace')

# Retry with same key - should get cached response
curl -X POST http://localhost/api/create \
  -H "Idempotency-Key: test-key-123" \
  -H "Content-Type: application/json" \
  -d '{"data": "test"}' \
  -H "X-Trace-Id: trace-123"

# Should return same result, without duplicate creation
```

---

## Monitoring Trace IDs

**In your log aggregation (ELK, Datadog, etc):**
```
query: trace_id = "abc123..."
aggregation: 
  - group by trace_id
  - show all events for that request
  - measure total duration
```

**Example dashboard query:**
```json
{
  "filter": {
    "trace_id": "exists"
  },
  "metrics": [
    "duration_ms",
    "status_code",
    "error_count"
  ],
  "group_by": ["trace_id", "path"]
}
```

---

## Cleanup Tasks

**Schedule daily (cron):**
```javascript
// Clean up expired idempotency records
import { cleanupExpiredRecords } from '../services/idempotency.js';
const result = await cleanupExpiredRecords();
console.log(`Cleaned ${result.deletedCount} records`);
```

**Schedule weekly (cron):**
```javascript
// Remove old audit logs (> 90 days)
// Remove old trace entries (> 30 days)
// Clear migration backup history (keep last 10)
```

---

## Error Handling

**Idempotency errors (non-critical):**
```javascript
const result = await storeIdempotencyRecord(...);
if (!result.success) {
  // Log warning but continue - operation already succeeded
  console.warn('Idempotency store failed:', result.error);
}
```

**Request logging errors (non-critical):**
```javascript
try {
  await executeWithLogging(...);
} catch (error) {
  // Logging failed but original error is what matters
  // Always throw original error
}
```

**Migration errors (critical):**
```javascript
const result = await executeMigration(...);
if (!result.success) {
  // Migration failed and was rolled back
  // Database is in original state
  console.error('Migration rolled back:', result.error);
  process.exit(1);
}
```

---

## Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| "Idempotency-Key header missing" | Client must send header for operations that need idempotency |
| "Duplicate detected but no cached response" | TTL may have expired (24 hours) - that's by design |
| "Trace ID not in logs" | Make sure to call `res.setHeader('X-Trace-Id', traceId)` |
| "Migration dry-run passes but execution fails" | Database state changed between dry-run and execution - retry |
| "Backup file corrupted" | Check backup directory permissions, disk space |
| "Health check returning 503" | Database might be down - check Appwrite logs |

---

## Files Reference

| File | Purpose | Size |
|------|---------|------|
| `/apps/api/functions/services/idempotency.js` | Idempotency service | 230 lines |
| `/apps/api/functions/services/request-logger.js` | Request tracing | 260 lines |
| `/scripts/safe-migration-runner.js` | Migration framework | 340 lines |
| `/apps/api/functions/system/health-check/index.js` | Health endpoints | 200 lines |
| `/scripts/deploy-phase3a.js` | Deployment script | 180 lines |
| `PHASE3A-RELIABILITY-INTEGRATION.md` | Full integration guide | 400+ lines |
| `PHASE3A-INTEGRATION-EXAMPLE.js` | Code example | 220 lines |

---

## Deployment Checklist

- [ ] Run: `node scripts/deploy-phase3a.js`
- [ ] Verify health endpoints respond
- [ ] Update 1 function with idempotency (test)
- [ ] Enable request logging in logs aggregation
- [ ] Set up daily cleanup cron job
- [ ] Test idempotency with retry scenario
- [ ] Monitor trace IDs in production logs
- [ ] Document any custom implementation decisions

---

**Need help?** See `PHASE3A-RELIABILITY-INTEGRATION.md` for detailed guide or `PHASE3A-INTEGRATION-EXAMPLE.js` for code template.
