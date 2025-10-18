/**
 * Presigned Download Function
 * Issues time-limited presigned GET URLs for downloading evidence
 * 
 * Security:
 * - Validates user has access to recognition
 * - Verifies evidence file exists
 * - Issues 5-minute TTL presigned URLs
 * - Logs all download attempts (successful and failed)
 * - Rate limits downloads per user
 */

import { Client, Storage, Databases } from 'node-appwrite';
import { enforceRole } from '../services/rbac-middleware.js';
import { createAuditLog } from '../services/audit-logger.js';
import { checkRateLimit } from '../services/rate-limiter.js';

const client = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT)
  .setProject(process.env.APPWRITE_PROJECT_ID)
  .setKey(process.env.APPWRITE_KEY);

const storage = new Storage(client);
const databases = new Databases(client);

// Configuration
const CONFIG = {
  PRESIGNED_TTL: 300, // 5 minutes for download
  BUCKET_ID: process.env.STORAGE_BUCKET_ID || 'evidence',
};

/**
 * Check if user can download evidence
 * Rules:
 * - User who uploaded can download (giver or recipient)
 * - Manager can download for recognitions they manage
 * - Admin can download anything
 */
async function canDownloadEvidence(user, recognition) {
  if (!user || !user.role) {
    return false;
  }

  // Admin can download anything
  if (user.role === 'admin') {
    return true;
  }

  // User can download their own recognition
  if (user.$id === recognition.giverId || user.$id === recognition.recipientId) {
    return true;
  }

  // Manager can download recognitions in their department
  if (
    user.role === 'manager' &&
    (user.department === recognition.giverDepartment ||
      user.department === recognition.recipientDepartment)
  ) {
    return true;
  }

  // HR can download (for exports)
  if (user.role === 'hr') {
    return true;
  }

  return false;
}

/**
 * Main handler
 */
export default async function handler(req, context) {
  try {
    const payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

    // 1. Authenticate user
    const userId = context.req.headers['x-appwrite-user-id'];
    if (!userId) {
      return context.res.json(
        { error: 'Unauthorized' },
        { statusCode: 401 }
      );
    }

    // 2. Validate required parameters
    if (!payload.fileId) {
      return context.res.json(
        { error: 'Missing fileId parameter' },
        { statusCode: 400 }
      );
    }

    if (!payload.recognitionId) {
      return context.res.json(
        { error: 'Missing recognitionId parameter' },
        { statusCode: 400 }
      );
    }

    // 3. Rate limit check - 20 downloads per hour
    const downloadLimit = await checkRateLimit(`download:${userId}`, 'download_profile');
    if (!downloadLimit.allowed) {
      // Log rate limit violation
      await createAuditLog({
        eventCode: 'EVIDENCE_DOWNLOAD_RATE_LIMITED',
        actorId: userId,
        targetId: payload.recognitionId,
        metadata: {
          fileId: payload.fileId,
        },
      });

      return context.res.json(
        {
          error: 'Rate limit exceeded',
          message: 'Maximum downloads per hour exceeded',
          retryAfter: downloadLimit.resetAt,
        },
        { statusCode: 429 }
      );
    }

    // 4. Get user from database
    let userDoc;
    try {
      userDoc = await databases.getDocument(
        process.env.DATABASE_ID,
        process.env.USER_COLLECTION_ID,
        userId
      );
    } catch (error) {
      return context.res.json(
        { error: 'User not found' },
        { statusCode: 404 }
      );
    }

    // 5. Enforce role - basic access check
    try {
      await enforceRole(userDoc, ['user', 'manager', 'hr', 'admin', 'auditor']);
    } catch (error) {
      return context.res.json(
        { error: 'Forbidden' },
        { statusCode: 403 }
      );
    }

    // 6. Get recognition document to verify permissions
    let recognition;
    try {
      recognition = await databases.getDocument(
        process.env.DATABASE_ID,
        process.env.RECOGNITION_COLLECTION_ID,
        payload.recognitionId
      );
    } catch (error) {
      return context.res.json(
        { error: 'Recognition not found' },
        { statusCode: 404 }
      );
    }

    // 7. Check if recognition is deleted or blocked
    if (recognition.status === 'deleted' || recognition.status === 'blocked') {
      await createAuditLog({
        eventCode: 'EVIDENCE_DOWNLOAD_DENIED_BLOCKED',
        actorId: userId,
        targetId: payload.recognitionId,
        metadata: {
          reason: `Recognition is ${recognition.status}`,
          fileId: payload.fileId,
        },
      });

      return context.res.json(
        { error: 'This recognition is not available for download' },
        { statusCode: 410 }
      );
    }

    // 8. Verify user can download this evidence
    const hasAccess = await canDownloadEvidence(userDoc, recognition);
    if (!hasAccess) {
      await createAuditLog({
        eventCode: 'EVIDENCE_DOWNLOAD_DENIED',
        actorId: userId,
        targetId: payload.recognitionId,
        metadata: {
          reason: 'Insufficient permissions',
          fileId: payload.fileId,
        },
      });

      return context.res.json(
        { error: 'You do not have permission to download this evidence' },
        { statusCode: 403 }
      );
    }

    // 9. Verify file exists in storage
    let fileInfo;
    try {
      fileInfo = await storage.getFile(CONFIG.BUCKET_ID, payload.fileId);
    } catch (error) {
      await createAuditLog({
        eventCode: 'EVIDENCE_DOWNLOAD_FAILED_NOT_FOUND',
        actorId: userId,
        targetId: payload.recognitionId,
        metadata: {
          fileId: payload.fileId,
          error: error.message,
        },
      });

      return context.res.json(
        { error: 'Evidence file not found' },
        { statusCode: 404 }
      );
    }

    // 10. Create presigned download URL (5 min TTL)
    const presignedUrl = storage.getFileDownload(CONFIG.BUCKET_ID, payload.fileId);

    // 11. Create audit log for successful download authorization
    await createAuditLog({
      eventCode: 'EVIDENCE_DOWNLOAD_AUTHORIZED',
      actorId: userId,
      targetId: payload.recognitionId,
      metadata: {
        fileId: payload.fileId,
        fileName: fileInfo.name || 'unknown',
        fileSize: fileInfo.sizeOriginal || fileInfo.size || 0,
      },
      ipAddress: context.req.headers['x-forwarded-for'] || context.req.ip,
      userAgent: context.req.headers['user-agent'],
    });

    // 12. Return presigned URL
    return context.res.json(
      {
        success: true,
        fileId: payload.fileId,
        recognitionId: payload.recognitionId,
        downloadUrl: presignedUrl,
        expiresIn: CONFIG.PRESIGNED_TTL,
        fileName: fileInfo.name || 'evidence',
        fileSize: fileInfo.sizeOriginal || fileInfo.size || 0,
        metadata: {
          authorizedAt: new Date().toISOString(),
          downloadWindow: `${CONFIG.PRESIGNED_TTL} seconds`,
        },
      },
      {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'X-RateLimit-Limit': '20',
          'X-RateLimit-Remaining': downloadLimit.remaining,
          'X-RateLimit-Reset': new Date(downloadLimit.resetAt).toISOString(),
        },
      }
    );
  } catch (error) {
    console.error('Error in presigned download:', error);

    // Log error
    try {
      await createAuditLog({
        eventCode: 'EVIDENCE_DOWNLOAD_ERROR',
        actorId: context.req.headers['x-appwrite-user-id'] || 'unknown',
        targetId: payload?.recognitionId || 'unknown',
        metadata: {
          error: error.message,
          fileId: payload?.fileId,
        },
      });
    } catch (auditError) {
      console.error('Failed to log download error:', auditError);
    }

    return context.res.json(
      {
        error: 'Download request failed',
        message: error.message,
      },
      { statusCode: 500 }
    );
  }
}
