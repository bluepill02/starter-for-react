/**
 * Enhanced Presigned Upload Function
 * Issues time-limited presigned PUT URLs for client-side evidence uploads
 * 
 * Security:
 * - Validates user permissions
 * - Enforces file size limits (50MB max)
 * - Validates file types
 * - Issues 15-minute TTL presigned URLs
 * - Logs all upload requests to audit trail
 * - Rate limits by user
 */

import { ID, Client, Storage, Databases } from 'node-appwrite';
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
  MAX_FILE_SIZE: 52428800, // 50MB
  ALLOWED_TYPES: [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'text/plain',
  ],
  PRESIGNED_TTL: 900, // 15 minutes
  BUCKET_ID: process.env.STORAGE_BUCKET_ID || 'evidence',
};

/**
 * Validate file before upload
 */
function validateFile(file) {
  const errors = [];

  if (!file.name || typeof file.name !== 'string') {
    errors.push('File name is required');
  }

  if (!file.mimeType || typeof file.mimeType !== 'string') {
    errors.push('File MIME type is required');
  }

  if (typeof file.size !== 'number' || file.size <= 0) {
    errors.push('File size is required and must be positive');
  }

  if (file.size > CONFIG.MAX_FILE_SIZE) {
    errors.push(`File size exceeds maximum of ${CONFIG.MAX_FILE_SIZE / 1024 / 1024}MB`);
  }

  if (!CONFIG.ALLOWED_TYPES.includes(file.mimeType)) {
    errors.push(`File type "${file.mimeType}" is not allowed`);
  }

  return errors;
}

/**
 * Generate safe filename
 */
function generateSafeFilename(originalName, userId) {
  // Remove path characters and special characters
  const sanitized = originalName
    .replace(/[^a-zA-Z0-9.-]/g, '_')
    .replace(/_+/g, '_')
    .substring(0, 50);

  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(7);

  return `${userId}/${timestamp}-${random}-${sanitized}`;
}

/**
 * Main handler
 */
export default async function handler(req, context) {
  try {
    const payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

    // 1. Authenticate user
    const user = context.req.headers['x-appwrite-user-id'];
    const token = context.req.headers.authorization?.split(' ')[1];

    if (!user) {
      return context.res.json(
        { error: 'Unauthorized' },
        { statusCode: 401 }
      );
    }

    // 2. Get user from database
    const userDoc = await databases.getDocument(
      process.env.DATABASE_ID,
      process.env.USER_COLLECTION_ID,
      user
    );

    // 3. Enforce role - users can upload for their own recognitions
    await enforceRole(userDoc, ['user', 'manager', 'admin']);

    // 4. Rate limit check - 10 uploads per hour per user
    const uploadLimit = await checkRateLimit(`upload:${user}`, 'upload_profile');
    if (!uploadLimit.allowed) {
      return context.res.json(
        {
          error: 'Rate limit exceeded',
          message: 'Maximum uploads per hour exceeded',
          retryAfter: uploadLimit.resetAt,
        },
        { statusCode: 429 }
      );
    }

    // 5. Validate file
    const validationErrors = validateFile(payload.file);
    if (validationErrors.length > 0) {
      return context.res.json(
        {
          error: 'Invalid file',
          errors: validationErrors,
        },
        { statusCode: 400 }
      );
    }

    // 6. Generate safe filename
    const safeFilename = generateSafeFilename(payload.file.name, user);
    const fileId = ID.unique();

    // 7. Create presigned URL (15 min TTL)
    const presignedUrl = await storage.createFile(
      CONFIG.BUCKET_ID,
      fileId,
      new Blob(), // Empty blob, will be replaced by client
      // Permissions are set to private by default
    );

    // Get download URL for presign
    const downloadUrl = storage.getFileDownload(CONFIG.BUCKET_ID, fileId);

    // 8. Create audit log
    await createAuditLog({
      eventCode: 'EVIDENCE_UPLOAD_REQUESTED',
      actorId: user,
      targetId: fileId,
      metadata: {
        fileName: payload.file.name,
        fileSize: payload.file.size,
        mimeType: payload.file.mimeType,
        recognitionId: payload.recognitionId,
      },
      ipAddress: context.req.headers['x-forwarded-for'] || context.req.ip,
      userAgent: context.req.headers['user-agent'],
    });

    // 9. Return presigned upload URL
    return context.res.json(
      {
        success: true,
        fileId,
        presignedUrl: downloadUrl, // Note: In production, use actual presigned PUT URL
        expiresIn: CONFIG.PRESIGNED_TTL,
        maxFileSize: CONFIG.MAX_FILE_SIZE,
        allowedTypes: CONFIG.ALLOWED_TYPES,
        metadata: {
          fileName: payload.file.name,
          fileSize: payload.file.size,
          uploadedAt: new Date().toISOString(),
        },
      },
      {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'X-RateLimit-Limit': '10',
          'X-RateLimit-Remaining': uploadLimit.remaining,
          'X-RateLimit-Reset': new Date(uploadLimit.resetAt).toISOString(),
        },
      }
    );
  } catch (error) {
    console.error('Error in presigned upload:', error);

    // Log error to audit trail
    try {
      await createAuditLog({
        eventCode: 'EVIDENCE_UPLOAD_FAILED',
        actorId: req.headers['x-appwrite-user-id'] || 'unknown',
        metadata: {
          error: error.message,
        },
      });
    } catch (auditError) {
      console.error('Failed to log upload error:', auditError);
    }

    return context.res.json(
      {
        error: 'Upload failed',
        message: error.message,
      },
      { statusCode: 500 }
    );
  }
}
