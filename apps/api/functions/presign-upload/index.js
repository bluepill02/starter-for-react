/* eslint-env node */
/* global require, process, module */

// Presign Upload Function - Validates files and creates secure upload tokens
const sdk = require('node-appwrite');
const { z } = require('zod');

// Zod validation schema for upload requests
const UploadRequestSchema = z.object({
  filename: z.string().min(1).max(255),
  fileType: z.enum([
    'image/jpeg',
    'image/png', 
    'image/gif',
    'image/webp',
    'application/pdf',
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]),
  fileSize: z.number().max(10 * 1024 * 1024) // 10MB limit
});

// Audit entry creation helper
async function createAuditEntry(databases, payload) {
  try {
    await databases.createDocument(
      process.env.RECOGNITION_DATABASE_ID || 'main',
      'audit',
      sdk.ID.unique(),
      {
        event: 'upload_request',
        userId: payload.userId || 'anonymous',
        metadata: JSON.stringify({
          filename: payload.filename,
          fileType: payload.fileType,
          fileSize: payload.fileSize,
          storageId: payload.storageId
        }),
        timestamp: new Date().toISOString()
      }
    );
    return true;
  } catch (error) {
    console.error('Failed to create audit entry:', error);
    return false;
  }
}

module.exports = async ({ req, res, log, error }) => {
  try {
    // Initialize Appwrite client with server-side SDK
    const client = new sdk.Client()
      .setEndpoint(process.env.APPWRITE_FUNCTION_ENDPOINT || 'https://cloud.appwrite.io/v1')
      .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
      .setKey(process.env.APPWRITE_API_KEY);

    const databases = new sdk.Databases(client);
    // Storage instance available for future use
    // const storage = new sdk.Storage(client);

    // Parse and validate request
    let payload;
    try {
      payload = JSON.parse(req.body || '{}');
    } catch {
      error('Invalid JSON in request body');
      return res.json({
        success: false,
        error: 'Invalid request format'
      }, 400);
    }

    // Validate upload request with Zod
    try {
      UploadRequestSchema.parse(payload);
    } catch (validationError) {
      error('File validation failed:', validationError.message);
      return res.json({
        success: false,
        error: 'Invalid file parameters',
        details: validationError.issues
      }, 400);
    }

    // Generate unique storage ID
    const storageId = sdk.ID.unique();

    // Create audit entry for upload request
    const auditCreated = await createAuditEntry(databases, {
      ...payload,
      storageId,
      userId: req.headers['x-appwrite-user-id'] || 'anonymous'
    });

    if (!auditCreated) {
      log('Warning: Failed to create audit entry for upload request');
    }

    // For Appwrite Storage, we don't need presigned URLs
    // The client will upload directly using the storage ID we provide
    log(`Upload token generated for file: ${payload.filename} (${payload.fileSize} bytes)`);

    return res.json({
      success: true,
      storageId,
      bucketId: 'evidence',
      message: 'Upload authorized'
    });

  } catch (err) {
    error('Presign upload function error:', err.message);
    return res.json({
      success: false,
      error: 'Internal server error'
    }, 500);
  }
};