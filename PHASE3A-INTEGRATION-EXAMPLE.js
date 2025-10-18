/**
 * Example: Create Recognition Function with Phase 3A Reliability
 * 
 * This demonstrates how to integrate Phase 3A components:
 * - Idempotency Service (prevent duplicate creates)
 * - Request Logger (enable tracing)
 * - Safe practices (transaction-like behavior)
 * 
 * Replaces: /apps/api/functions/recognition/create-recognition/index.js
 * This is a reference implementation - adapt to your existing function
 */

import { Client, Databases, ID } from 'appwrite';
import { idempotencyMiddleware, storeIdempotencyRecord } from '../../services/idempotency.js';
import { createRequestContext, executeWithLogging, executeDatabaseOperation } from '../../services/request-logger.js';
import { auditLog } from '../../services/audit-logger.js';
import { detectReciprocity, computeWeight } from '../../services/abuse.js';
import { getRateLimiter } from '../../services/rate-limiter.js';
import { validateRecognitionInput } from '../../schemas/recognition.js';

const client = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT)
  .setProject(process.env.APPWRITE_PROJECT_ID)
  .setKey(process.env.APPWRITE_KEY);

const databases = new Databases(client);

const DATABASE_ID = process.env.DATABASE_ID || 'recognition-db';

export default async (req, res, context) => {
  // ============================================================
  // Phase 3A: Request Context & Tracing
  // ============================================================
  const ctx = createRequestContext(req);

  try {
    // ============================================================
    // Phase 3A: Idempotency Check
    // ============================================================
    const idempotency = await idempotencyMiddleware(req);

    if (idempotency.isDuplicate) {
      console.log(`Duplicate request detected for trace ${ctx.traceId}`);

      // Return cached response
      res.setHeader('X-Trace-Id', ctx.traceId);
      res.setHeader('X-Idempotency-Replayed', 'true');
      res.setHeader('X-Idempotency-Created-At', idempotency.createdAt);

      return res.json(idempotency.cachedResponse, 200);
    }

    const userId = req.headers['x-appwrite-user-id'];

    // ============================================================
    // Input Validation
    // ============================================================
    const inputValidation = validateRecognitionInput(req.body);
    if (!inputValidation.success) {
      return res.json(
        {
          error: 'Validation failed',
          details: inputValidation.errors,
        },
        400
      );
    }

    const { recipientId, reason, tags, evidence, visibility = 'PRIVATE' } = req.body;

    // ============================================================
    // Rate Limiting Check
    // ============================================================
    const rateLimiter = getRateLimiter();
    const limiterKey = `recognition_create:${userId}`;
    const isRateLimited = await rateLimiter.isLimited(limiterKey, 10, 86400); // 10/day

    if (isRateLimited) {
      return res.json(
        {
          error: 'Rate limit exceeded',
          message: 'You can create a maximum of 10 recognitions per day',
        },
        429
      );
    }

    // ============================================================
    // Anti-Abuse Check
    // ============================================================
    const reciprocityResult = await executeWithLogging(
      'detect-reciprocity',
      ctx.traceId,
      async () => {
        return detectReciprocity(userId, recipientId);
      }
    );

    if (reciprocityResult.flagged) {
      console.warn(`Reciprocity flag for trace ${ctx.traceId}:`, reciprocityResult);
      // Continue but mark for review
    }

    // ============================================================
    // Create Recognition (with logging)
    // ============================================================
    const recognition = await executeWithLogging(
      'create-recognition',
      ctx.traceId,
      async () => {
        // Compute weight based on evidence, verification status
        const weight = await computeWeight({
          reason: reason.length,
          tagCount: tags.length,
          hasEvidence: !!evidence,
          giverRole: req.body.giverRole || 'employee',
        });

        // Create recognition document
        const recognitionData = {
          $id: ID.unique(),
          giverId: userId,
          recipientId,
          reason,
          tags,
          evidence: evidence || null,
          visibility,
          weight,
          status: 'PENDING_VERIFICATION',
          reciprocityFlag: reciprocityResult.flagged,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        // Execute with database operation logging
        return executeDatabaseOperation(
          ctx.traceId,
          'CREATE',
          'recognitions',
          async () => {
            return databases.createDocument(
              DATABASE_ID,
              'recognitions',
              recognitionData.$id,
              recognitionData
            );
          }
        );
      }
    );

    // ============================================================
    // Phase 3A: Store for Idempotent Retries
    // ============================================================
    if (idempotency.idempotencyKey) {
      await storeIdempotencyRecord(
        idempotency.idempotencyKey,
        userId,
        'recognition_create',
        recognition
      );
    }

    // ============================================================
    // Audit Logging
    // ============================================================
    await auditLog('recognition_created', {
      giverId: userId,
      recipientId,
      recognitionId: recognition.$id,
      tagCount: tags.length,
      weight: recognition.weight,
      reciprocityFlagged: reciprocityResult.flagged,
      traceId: ctx.traceId,
    });

    // ============================================================
    // Response
    // ============================================================
    res.setHeader('X-Trace-Id', ctx.traceId);
    res.setHeader('X-Correlation-Id', ctx.correlationId);
    if (idempotency.idempotencyKey) {
      res.setHeader('X-Idempotency-Key', idempotency.idempotencyKey);
    }

    return res.json(
      {
        success: true,
        recognition,
        trace: ctx.traceId,
      },
      201
    );
  } catch (error) {
    console.error(`Error in trace ${ctx.traceId}:`, error);

    // Audit error
    await auditLog('recognition_create_error', {
      error: error.message,
      traceId: ctx.traceId,
    });

    // Return error response
    res.setHeader('X-Trace-Id', ctx.traceId);

    return res.json(
      {
        error: 'Failed to create recognition',
        message: error.message,
        trace: ctx.traceId,
      },
      500
    );
  }
};

/**
 * Integration Notes:
 * 
 * 1. Idempotency:
 *    - Client must send Idempotency-Key header
 *    - Duplicate requests within 24 hours return cached response
 *    - Prevents duplicate recognition creation on retries
 * 
 * 2. Request Logging:
 *    - All requests get unique trace ID
 *    - Trace ID propagates through all function calls
 *    - Response includes X-Trace-Id header for debugging
 *    - Database operations, external calls logged with trace ID
 * 
 * 3. Error Handling:
 *    - Errors logged with full trace ID context
 *    - Audit trail records all failures
 *    - No partial state if creation fails (DB handles atomicity)
 * 
 * 4. Client Usage:
 *    import crypto from 'crypto';
 *    
 *    const response = await fetch('/api/functions/create-recognition', {
 *      method: 'POST',
 *      headers: {
 *        'Idempotency-Key': crypto.randomUUID(),
 *        'Content-Type': 'application/json',
 *        'X-Trace-Id': tracingContext.traceId, // optional
 *      },
 *      body: JSON.stringify({
 *        recipientId: 'user123',
 *        reason: 'Excellent work on the project...',
 *        tags: ['teamwork', 'quality'],
 *        evidence: { storageId: 'file-123' },
 *      }),
 *    });
 *    
 *    // Safe to retry with same Idempotency-Key
 *    if (response.status === 500) {
 *      await fetch(..., { headers: { 'Idempotency-Key': sameKey } });
 *      // Will get cached response, no duplicate created
 *    }
 * 
 * 5. Migration Path:
 *    - Update one function at a time
 *    - Test with dry-run migrations first
 *    - Existing functions continue working (backward compatible)
 *    - Phase in request logging gradually
 */
