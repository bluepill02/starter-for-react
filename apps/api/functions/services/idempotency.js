/**
 * Idempotency Service
 * Prevents duplicate operations using idempotency keys
 * 
 * Features:
 * - Idempotency-Key header support
 * - Duplicate detection by key + user + operation
 * - Response caching for retried requests
 * - Automatic cleanup of old entries
 * - TTL-based expiration (24 hours)
 */

import { Client, Databases } from 'node-appwrite';
import crypto from 'crypto';

const client = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT)
  .setProject(process.env.APPWRITE_PROJECT_ID)
  .setKey(process.env.APPWRITE_KEY);

const databases = new Databases(client);

const DATABASE_ID = process.env.DATABASE_ID || 'recognition-db';
const IDEMPOTENCY_TTL_HOURS = 24;

/**
 * Check if request is idempotent (has idempotency-key)
 */
export function isIdempotentRequest(req) {
  return !!(
    req.headers['idempotency-key'] ||
    req.headers['x-idempotency-key'] ||
    req.headers['Idempotency-Key']
  );
}

/**
 * Get idempotency key from request headers
 */
export function getIdempotencyKey(req) {
  return (
    req.headers['idempotency-key'] ||
    req.headers['x-idempotency-key'] ||
    req.headers['Idempotency-Key'] ||
    null
  );
}

/**
 * Create idempotency record fingerprint
 * Combines user ID, operation type, and request body hash
 */
export function createFingerprint(userId, operationType, requestBody) {
  const bodyHash = crypto
    .createHash('sha256')
    .update(JSON.stringify(requestBody || {}))
    .digest('hex');

  return crypto
    .createHash('sha256')
    .update(`${userId}:${operationType}:${bodyHash}`)
    .digest('hex')
    .substring(0, 16);
}

/**
 * Calculate idempotency key expiration
 */
function calculateExpiration() {
  const now = new Date();
  const expiration = new Date(now.getTime() + IDEMPOTENCY_TTL_HOURS * 60 * 60 * 1000);
  return expiration.toISOString();
}

/**
 * Store idempotency record
 * Called after successful operation to enable idempotent retries
 */
export async function storeIdempotencyRecord(idempotencyKey, userId, operationType, responseData) {
  try {
    const recordId = `${userId}-${idempotencyKey}`;
    const fingerprint = createFingerprint(userId, operationType, responseData);

    const record = {
      $id: recordId,
      idempotencyKey,
      userId,
      operationType,
      fingerprint,
      responseData: JSON.stringify(responseData),
      createdAt: new Date().toISOString(),
      expiresAt: calculateExpiration(),
    };

    // Store in idempotency-keys collection
    try {
      await databases.createDocument(
        DATABASE_ID,
        'idempotency-keys',
        recordId,
        record
      );
    } catch (error) {
      if (error.code === 404) {
        // Collection doesn't exist, create it
        await databases.createCollection(
          DATABASE_ID,
          'idempotency-keys',
          'Idempotency Keys'
        );
        await databases.createDocument(
          DATABASE_ID,
          'idempotency-keys',
          recordId,
          record
        );
      } else if (!error.message?.includes('already exists')) {
        throw error;
      }
    }

    return {
      success: true,
      recordId,
    };
  } catch (error) {
    console.warn('Failed to store idempotency record:', error.message);
    // Non-critical, continue without storing
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Check for duplicate request using idempotency key
 * Returns cached response if duplicate found, null otherwise
 */
export async function checkDuplicate(idempotencyKey, userId) {
  try {
    if (!idempotencyKey || !userId) {
      return null;
    }

    const recordId = `${userId}-${idempotencyKey}`;

    try {
      const record = await databases.getDocument(
        DATABASE_ID,
        'idempotency-keys',
        recordId
      );

      // Check if not expired
      const expiresAt = new Date(record.expiresAt);
      if (expiresAt > new Date()) {
        return {
          isDuplicate: true,
          responseData: JSON.parse(record.responseData),
          createdAt: record.createdAt,
        };
      } else {
        // Record expired, delete it
        try {
          await databases.deleteDocument(
            DATABASE_ID,
            'idempotency-keys',
            recordId
          );
        } catch (deleteError) {
          console.warn('Could not delete expired idempotency record:', deleteError.message);
        }
      }
    } catch (error) {
      if (error.code === 404) {
        return null;
      }
      throw error;
    }

    return null;
  } catch (error) {
    console.warn('Error checking duplicate:', error.message);
    return null;
  }
}

/**
 * Middleware to check for duplicate requests
 * Use in functions to prevent duplicate creation
 */
export async function idempotencyMiddleware(req) {
  const idempotencyKey = getIdempotencyKey(req);
  const userId = req.headers['x-appwrite-user-id'];

  if (!idempotencyKey) {
    return {
      isDuplicate: false,
      idempotencyKey: null,
    };
  }

  if (!userId) {
    return {
      isDuplicate: false,
      idempotencyKey,
      error: 'User ID required for idempotent requests',
    };
  }

  // Check for duplicate
  const duplicate = await checkDuplicate(idempotencyKey, userId);

  if (duplicate?.isDuplicate) {
    return {
      isDuplicate: true,
      idempotencyKey,
      cachedResponse: duplicate.responseData,
      createdAt: duplicate.createdAt,
    };
  }

  return {
    isDuplicate: false,
    idempotencyKey,
  };
}

/**
 * Cleanup expired idempotency records
 * Should be called periodically (e.g., daily)
 */
export async function cleanupExpiredRecords() {
  try {
    const now = new Date();

    // Query all idempotency records
    const records = await databases.listDocuments(
      DATABASE_ID,
      'idempotency-keys'
    );

    let deletedCount = 0;

    for (const record of records.documents) {
      const expiresAt = new Date(record.expiresAt);
      
      if (expiresAt <= now) {
        try {
          await databases.deleteDocument(
            DATABASE_ID,
            'idempotency-keys',
            record.$id
          );
          deletedCount++;
        } catch (error) {
          console.warn(`Could not delete record ${record.$id}:`, error.message);
        }
      }
    }

    return {
      deletedCount,
      totalRecords: records.total,
    };
  } catch (error) {
    console.error('Error cleaning up idempotency records:', error);
    throw error;
  }
}

export default {
  isIdempotentRequest,
  getIdempotencyKey,
  createFingerprint,
  storeIdempotencyRecord,
  checkDuplicate,
  idempotencyMiddleware,
  cleanupExpiredRecords,
};
