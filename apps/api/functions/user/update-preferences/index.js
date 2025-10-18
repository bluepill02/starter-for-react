/**
 * User Preferences Update Function
 * Allows users to control privacy preferences
 * 
 * Features:
 * - Email opt-in/out
 * - Share opt-in/out
 * - Notification preferences per recognition type
 * - Preference history for audit trail
 * - Rate limiting
 */

import { Client, Databases } from 'node-appwrite';
import { createAuditLog } from '../services/audit-logger.js';
import { checkRateLimit } from '../services/rate-limiter.js';

const client = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT)
  .setProject(process.env.APPWRITE_PROJECT_ID)
  .setKey(process.env.APPWRITE_KEY);

const databases = new Databases(client);

const DATABASE_ID = process.env.DATABASE_ID || 'recognition-db';

/**
 * Validate preference update
 */
function validatePreferences(prefs) {
  const errors = [];

  if (prefs.emailOptIn !== undefined && typeof prefs.emailOptIn !== 'boolean') {
    errors.push('emailOptIn must be boolean');
  }

  if (prefs.shareOptIn !== undefined && typeof prefs.shareOptIn !== 'boolean') {
    errors.push('shareOptIn must be boolean');
  }

  if (prefs.notificationFrequency !== undefined) {
    const validFrequencies = ['immediate', 'daily', 'weekly', 'never'];
    if (!validFrequencies.includes(prefs.notificationFrequency)) {
      errors.push(
        `notificationFrequency must be one of: ${validFrequencies.join(', ')}`
      );
    }
  }

  if (prefs.recognitionTypes !== undefined) {
    if (!Array.isArray(prefs.recognitionTypes)) {
      errors.push('recognitionTypes must be array');
    } else {
      const validTypes = ['received', 'verified', 'override'];
      const invalid = prefs.recognitionTypes.filter((t) => !validTypes.includes(t));
      if (invalid.length > 0) {
        errors.push(
          `recognitionTypes contains invalid types: ${invalid.join(', ')}`
        );
      }
    }
  }

  return errors;
}

/**
 * Update user preferences
 * 
 * Usage:
 * POST /functions/user-update-preferences
 * Headers: x-appwrite-user-id
 * Body: {
 *   emailOptIn?: boolean,
 *   shareOptIn?: boolean,
 *   notificationFrequency?: "immediate" | "daily" | "weekly" | "never",
 *   recognitionTypes?: ["received", "verified", "override"],
 *   reason?: string  // Optional reason for preference change
 * }
 */
export default async function handler(req, context) {
  try {
    // Extract user ID
    const userId = req.headers['x-appwrite-user-id'];
    if (!userId) {
      return context.res.json(
        {
          error: 'Unauthorized',
          code: 'UNAUTHORIZED',
        },
        401
      );
    }

    // Check rate limit (10 preference updates per day)
    const rateLimitKey = `preference_updates_${userId}`;
    const rateLimit = checkRateLimit(rateLimitKey, 'auth_signin');

    if (!rateLimit.allowed) {
      await createAuditLog({
        eventCode: 'PREFERENCE_UPDATE_RATE_LIMITED',
        actorId: userId,
        metadata: {
          rateLimitType: 'preference_updates',
          remaining: rateLimit.remaining,
          resetAt: rateLimit.resetAt,
        },
      });

      return context.res.json(
        {
          error: 'Too many preference update attempts',
          code: 'RATE_LIMIT_EXCEEDED',
          remaining: rateLimit.remaining,
          resetAt: rateLimit.resetAt,
        },
        429
      );
    }

    // Parse request body
    const body = typeof req.bodyJson === 'string'
      ? JSON.parse(req.bodyJson)
      : req.bodyJson;

    const { emailOptIn, shareOptIn, notificationFrequency, recognitionTypes, reason } = body;

    // Validate input
    const validationErrors = validatePreferences({
      emailOptIn,
      shareOptIn,
      notificationFrequency,
      recognitionTypes,
    });

    if (validationErrors.length > 0) {
      return context.res.json(
        {
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: validationErrors,
        },
        400
      );
    }

    // Check if at least one preference is being updated
    if (
      emailOptIn === undefined &&
      shareOptIn === undefined &&
      notificationFrequency === undefined &&
      recognitionTypes === undefined
    ) {
      return context.res.json(
        {
          error: 'At least one preference must be specified',
          code: 'NO_PREFERENCES_PROVIDED',
        },
        400
      );
    }

    // Get current user preferences
    let user;
    try {
      user = await databases.getDocument(DATABASE_ID, 'users', userId);
    } catch (error) {
      if (error.code === 404) {
        // User doesn't exist yet, create with default preferences
        user = {
          $id: userId,
          emailOptIn: true,
          shareOptIn: false,
          notificationFrequency: 'daily',
          recognitionTypes: ['received', 'verified'],
          preferenceHistory: [],
        };
      } else {
        throw error;
      }
    }

    // Store previous preferences for audit trail
    const previousPreferences = {
      emailOptIn: user.emailOptIn,
      shareOptIn: user.shareOptIn,
      notificationFrequency: user.notificationFrequency,
      recognitionTypes: user.recognitionTypes,
    };

    // Update preferences
    const updatedUser = {
      ...user,
      emailOptIn: emailOptIn !== undefined ? emailOptIn : user.emailOptIn,
      shareOptIn: shareOptIn !== undefined ? shareOptIn : user.shareOptIn,
      notificationFrequency: notificationFrequency || user.notificationFrequency,
      recognitionTypes: recognitionTypes || user.recognitionTypes,
      preferenceUpdatedAt: new Date().toISOString(),
    };

    // Store preference change history
    const preferenceHistory = (user.preferenceHistory || []) || [];
    preferenceHistory.push({
      timestamp: new Date().toISOString(),
      previousPreferences,
      newPreferences: {
        emailOptIn: updatedUser.emailOptIn,
        shareOptIn: updatedUser.shareOptIn,
        notificationFrequency: updatedUser.notificationFrequency,
        recognitionTypes: updatedUser.recognitionTypes,
      },
      reason: reason || 'User requested change',
    });

    // Keep last 50 changes only
    updatedUser.preferenceHistory = preferenceHistory.slice(-50);

    // Update or create user document
    try {
      await databases.updateDocument(DATABASE_ID, 'users', userId, updatedUser);
    } catch (error) {
      if (error.code === 404) {
        // Document doesn't exist, create it
        await databases.createDocument(DATABASE_ID, 'users', userId, updatedUser);
      } else {
        throw error;
      }
    }

    // Log preference change
    const changesSummary = [];
    if (emailOptIn !== undefined && emailOptIn !== previousPreferences.emailOptIn) {
      changesSummary.push(
        `Email: ${previousPreferences.emailOptIn} → ${emailOptIn}`
      );
    }
    if (shareOptIn !== undefined && shareOptIn !== previousPreferences.shareOptIn) {
      changesSummary.push(
        `Share: ${previousPreferences.shareOptIn} → ${shareOptIn}`
      );
    }
    if (
      notificationFrequency &&
      notificationFrequency !== previousPreferences.notificationFrequency
    ) {
      changesSummary.push(
        `Frequency: ${previousPreferences.notificationFrequency} → ${notificationFrequency}`
      );
    }

    await createAuditLog({
      eventCode: 'PREFERENCE_UPDATED',
      actorId: userId,
      targetId: userId,
      metadata: {
        previousPreferences,
        newPreferences: {
          emailOptIn: updatedUser.emailOptIn,
          shareOptIn: updatedUser.shareOptIn,
          notificationFrequency: updatedUser.notificationFrequency,
          recognitionTypes: updatedUser.recognitionTypes,
        },
        changes: changesSummary,
        reason,
      },
    });

    return context.res.json(
      {
        success: true,
        message: 'Preferences updated successfully',
        preferences: {
          emailOptIn: updatedUser.emailOptIn,
          shareOptIn: updatedUser.shareOptIn,
          notificationFrequency: updatedUser.notificationFrequency,
          recognitionTypes: updatedUser.recognitionTypes,
          updatedAt: updatedUser.preferenceUpdatedAt,
        },
        changes: changesSummary,
      },
      200
    );
  } catch (error) {
    console.error('Error updating preferences:', error);

    const userId = req.headers['x-appwrite-user-id'];
    if (userId) {
      await createAuditLog({
        eventCode: 'PREFERENCE_UPDATE_FAILED',
        actorId: userId,
        metadata: {
          error: error.message,
        },
      });
    }

    return context.res.json(
      {
        error: 'Failed to update preferences',
        code: 'UPDATE_FAILED',
        details: error.message,
      },
      500
    );
  }
}
