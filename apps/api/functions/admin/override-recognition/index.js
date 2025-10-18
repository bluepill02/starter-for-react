/**
 * Admin Override Recognition Function
 * Allows admins to override recognition status with mandatory justification
 * 
 * Security:
 * - Only admins can override
 * - Requires detailed justification (20-500 chars)
 * - All overrides logged with justification in audit trail
 * - Affected users notified (if email opt-in enabled)
 * - Cannot be undone without another override with justification
 */

import { Client, Databases } from 'node-appwrite';
import { enforceRole, requireAdmin } from '../services/rbac-middleware.js';
import { createAuditLog } from '../services/audit-logger.js';

const client = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT)
  .setProject(process.env.APPWRITE_PROJECT_ID)
  .setKey(process.env.APPWRITE_KEY);

const databases = new Databases(client);

// Valid override reasons
const OVERRIDE_REASONS = [
  'ABUSE_PREVENTION',
  'DATA_CORRECTION',
  'POLICY_VIOLATION',
  'SYSTEM_ERROR',
  'USER_REQUEST',
  'COMPLIANCE',
  'DUPLICATE_REMOVAL',
  'OTHER',
];

// Valid statuses an override can set
const OVERRIDE_ALLOWED_STATUSES = [
  'active',
  'verified',
  'blocked',
  'archived',
];

/**
 * Validate override justification
 */
function validateJustification(justification) {
  if (!justification || typeof justification !== 'string') {
    throw new Error('Override justification is required');
  }

  const trimmed = justification.trim();

  if (trimmed.length < 20) {
    throw new Error('Justification must be at least 20 characters');
  }

  if (trimmed.length > 500) {
    throw new Error('Justification must not exceed 500 characters');
  }

  return trimmed;
}

/**
 * Validate override reason code
 */
function validateReason(reason) {
  if (!reason || !OVERRIDE_REASONS.includes(reason)) {
    throw new Error(
      `Invalid override reason. Must be one of: ${OVERRIDE_REASONS.join(', ')}`
    );
  }

  return reason;
}

/**
 * Validate new status
 */
function validateNewStatus(status) {
  if (!status || !OVERRIDE_ALLOWED_STATUSES.includes(status)) {
    throw new Error(
      `Invalid status. Must be one of: ${OVERRIDE_ALLOWED_STATUSES.join(', ')}`
    );
  }

  return status;
}

/**
 * Send notification to affected user
 */
async function notifyAffectedUser(recognition, admin, reason, justification) {
  try {
    // Get recipient user to check email opt-in
    const recipientUser = await databases.getDocument(
      process.env.DATABASE_ID,
      process.env.USER_COLLECTION_ID,
      recognition.recipientId
    );

    // If user opted out of emails, don't send
    if (recipientUser.emailOptIn === false) {
      console.log(`User ${recognition.recipientId} opted out of emails`);
      return;
    }

    // TODO: Implement email sending
    // This would send an email notifying the user about the admin action
    console.log('Email notification would be sent here');
  } catch (error) {
    console.error('Error notifying user:', error);
    // Non-critical, continue
  }
}

/**
 * Main handler
 */
export default async function handler(req, context) {
  try {
    const payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

    // 1. Authenticate user
    const adminId = context.req.headers['x-appwrite-user-id'];
    if (!adminId) {
      return context.res.json(
        { error: 'Unauthorized' },
        { statusCode: 401 }
      );
    }

    // 2. Get admin user
    let admin;
    try {
      admin = await databases.getDocument(
        process.env.DATABASE_ID,
        process.env.USER_COLLECTION_ID,
        adminId
      );
    } catch (error) {
      return context.res.json(
        { error: 'Admin user not found' },
        { statusCode: 404 }
      );
    }

    // 3. Enforce admin role
    try {
      await requireAdmin(admin);
    } catch (error) {
      await createAuditLog({
        eventCode: 'ADMIN_OVERRIDE_DENIED_PERMISSION',
        actorId: adminId,
        targetId: payload.recognitionId || 'unknown',
        metadata: {
          reason: 'Insufficient permissions',
        },
      });

      return context.res.json(
        { error: 'Only admins can override recognitions' },
        { statusCode: 403 }
      );
    }

    // 4. Validate required parameters
    if (!payload.recognitionId) {
      return context.res.json(
        { error: 'Missing recognitionId' },
        { statusCode: 400 }
      );
    }

    // 5. Validate justification
    let justification;
    try {
      justification = validateJustification(payload.justification);
    } catch (error) {
      return context.res.json(
        { error: 'Invalid justification', message: error.message },
        { statusCode: 400 }
      );
    }

    // 6. Validate reason code
    let reason = 'OTHER';
    if (payload.reason) {
      try {
        reason = validateReason(payload.reason);
      } catch (error) {
        return context.res.json(
          { error: 'Invalid reason code', message: error.message },
          { statusCode: 400 }
        );
      }
    }

    // 7. Validate new status
    let newStatus = 'blocked';
    if (payload.newStatus) {
      try {
        newStatus = validateNewStatus(payload.newStatus);
      } catch (error) {
        return context.res.json(
          { error: 'Invalid status', message: error.message },
          { statusCode: 400 }
        );
      }
    }

    // 8. Get recognition document
    let recognition;
    try {
      recognition = await databases.getDocument(
        process.env.DATABASE_ID,
        process.env.RECOGNITION_COLLECTION_ID,
        payload.recognitionId
      );
    } catch (error) {
      await createAuditLog({
        eventCode: 'ADMIN_OVERRIDE_FAILED_NOT_FOUND',
        actorId: adminId,
        targetId: payload.recognitionId,
        metadata: {
          error: 'Recognition not found',
        },
      });

      return context.res.json(
        { error: 'Recognition not found' },
        { statusCode: 404 }
      );
    }

    // 9. Check if recognition is already overridden
    if (recognition.overriddenBy && recognition.overriddenBy !== adminId) {
      return context.res.json(
        {
          error: 'Recognition already overridden',
          message: 'This recognition has been overridden previously. Review audit trail before proceeding.',
          previousOverride: {
            by: recognition.overriddenBy,
            at: recognition.overrideTimestamp,
            justification: recognition.overrideJustification,
          },
        },
        { statusCode: 409 }
      );
    }

    // 10. Update recognition with override information
    const now = new Date().toISOString();
    const update = {
      status: newStatus,
      overriddenBy: adminId,
      overrideTimestamp: now,
      overrideJustification: justification,
      overrideReason: reason,
      previousStatus: recognition.status,
    };

    let updatedRecognition;
    try {
      updatedRecognition = await databases.updateDocument(
        process.env.DATABASE_ID,
        process.env.RECOGNITION_COLLECTION_ID,
        payload.recognitionId,
        update
      );
    } catch (error) {
      await createAuditLog({
        eventCode: 'ADMIN_OVERRIDE_FAILED_UPDATE',
        actorId: adminId,
        targetId: payload.recognitionId,
        metadata: {
          error: error.message,
          reason,
        },
      });

      return context.res.json(
        { error: 'Failed to override recognition', message: error.message },
        { statusCode: 500 }
      );
    }

    // 11. Create audit log entry with full justification
    await createAuditLog({
      eventCode: 'ADMIN_OVERRIDE_SUCCESS',
      actorId: adminId,
      targetId: payload.recognitionId,
      metadata: {
        reason,
        justification, // Full justification in audit trail
        previousStatus: recognition.status,
        newStatus,
        giverName: recognition.giverName,
        recipientEmail: recognition.recipientEmail,
        overrideAt: now,
      },
      ipAddress: context.req.headers['x-forwarded-for'] || context.req.ip,
      userAgent: context.req.headers['user-agent'],
    });

    // 12. Notify affected users
    await notifyAffectedUser(recognition, admin, reason, justification);

    // 13. Return success response
    return context.res.json(
      {
        success: true,
        message: 'Recognition overridden successfully',
        recognition: {
          id: updatedRecognition.$id,
          status: updatedRecognition.status,
          overriddenBy: adminId,
          overrideTimestamp: now,
          reason,
        },
        audit: {
          eventCode: 'ADMIN_OVERRIDE_SUCCESS',
          timestamp: now,
          justificationStored: true,
        },
      },
      {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Error in admin override:', error);

    // Log error to audit trail
    try {
      await createAuditLog({
        eventCode: 'ADMIN_OVERRIDE_ERROR',
        actorId: context.req.headers['x-appwrite-user-id'] || 'unknown',
        metadata: {
          error: error.message,
        },
      });
    } catch (auditError) {
      console.error('Failed to log override error:', auditError);
    }

    return context.res.json(
      {
        error: 'Override operation failed',
        message: error.message,
      },
      { statusCode: 500 }
    );
  }
}
