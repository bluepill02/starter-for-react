/**
 * CSV HR-Safe Export Function
 * Generates anonymized recognition data exports for HR
 * 
 * Features:
 * - Removes PII: emails, user names, IPs, phone numbers
 * - Uses hashed user IDs instead of real identifiers
 * - Includes aggregated metrics without sensitive details
 * - Optional anonymization levels
 * - Audit logging for all exports
 * - Rate limiting (5 exports per day per user)
 */

import { Client, Databases } from 'node-appwrite';
import { checkRateLimit } from './rate-limiter.js';
import { createAuditLog } from './audit-logger.js';
import crypto from 'crypto';

const client = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT)
  .setProject(process.env.APPWRITE_PROJECT_ID)
  .setKey(process.env.APPWRITE_KEY);

const databases = new Databases(client);

const DATABASE_ID = process.env.DATABASE_ID || 'recognition-db';

/**
 * Hash user ID for anonymization
 * One-way hash using SHA-256
 */
function hashUserId(userId) {
  return crypto
    .createHash('sha256')
    .update(userId + process.env.HASH_SALT || 'default-salt')
    .digest('hex')
    .substring(0, 12);
}

/**
 * Strip PII from recognition record
 */
function stripPII(recognition, anonymizationLevel = 'full') {
  const stripped = {
    id: hashUserId(recognition.giverId),
    recipient_id: hashUserId(recognition.recipientId),
    recognition_id: recognition.$id,
    created_date: new Date(recognition.createdAt).toLocaleDateString(),
    recognition_weight: recognition.weight || 0,
    status: recognition.status,
    is_verified: recognition.verifiedBy ? true : false,
    has_evidence: recognition.evidenceIds?.length > 0 ? true : false,
  };

  // High anonymization: no text at all
  if (anonymizationLevel === 'maximum') {
    return stripped;
  }

  // Full anonymization (default): hashed reason, tags stripped
  if (anonymizationLevel === 'full') {
    if (recognition.reason) {
      stripped.reason_hash = crypto
        .createHash('sha256')
        .update(recognition.reason)
        .digest('hex')
        .substring(0, 16);
    }
    return stripped;
  }

  // Moderate: short tags but anonymized recipient
  if (anonymizationLevel === 'moderate') {
    stripped.tag_count = recognition.tags?.length || 0;
    stripped.has_reason = !!recognition.reason;
    return stripped;
  }

  return stripped;
}

/**
 * Generate CSV content from recognitions
 */
function generateCSVContent(recognitions, anonymizationLevel = 'full') {
  if (recognitions.length === 0) {
    return 'No recognition data available for export period';
  }

  // CSV Header
  const headers = [
    'Giver ID',
    'Recipient ID',
    'Recognition ID',
    'Created Date',
    'Weight',
    'Status',
    'Is Verified',
    'Has Evidence',
  ];

  if (anonymizationLevel !== 'maximum') {
    headers.push('Reason Hash');
  }

  if (anonymizationLevel === 'moderate') {
    headers.push('Tag Count', 'Has Reason');
  }

  // CSV Rows
  const rows = recognitions.map((rec) => {
    const stripped = stripPII(rec, anonymizationLevel);
    const row = [
      stripped.id,
      stripped.recipient_id,
      stripped.recognition_id,
      stripped.created_date,
      stripped.recognition_weight,
      stripped.status,
      stripped.is_verified ? 'Yes' : 'No',
      stripped.has_evidence ? 'Yes' : 'No',
    ];

    if (anonymizationLevel !== 'maximum' && stripped.reason_hash) {
      row.push(stripped.reason_hash);
    }

    if (anonymizationLevel === 'moderate') {
      row.push(stripped.tag_count, stripped.has_reason ? 'Yes' : 'No');
    }

    return row;
  });

  // Escape CSV values
  const escapedRows = rows.map((row) =>
    row.map((cell) => {
      const cellStr = String(cell);
      if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
        return `"${cellStr.replace(/"/g, '""')}"`;
      }
      return cellStr;
    })
  );

  // Combine header + rows
  const csvLines = [
    headers.join(','),
    ...escapedRows.map((row) => row.join(',')),
  ];

  // Add metadata footer
  csvLines.push('');
  csvLines.push('Export Metadata:');
  csvLines.push(`Export Date: ${new Date().toISOString()}`);
  csvLines.push(`Anonymization Level: ${anonymizationLevel}`);
  csvLines.push(`Total Records: ${recognitions.length}`);
  csvLines.push('Note: This export contains anonymized data. User IDs are hashed.');

  return csvLines.join('\n');
}

/**
 * Calculate aggregated metrics from recognitions
 */
function calculateMetrics(recognitions) {
  return {
    total_count: recognitions.length,
    verified_count: recognitions.filter((r) => r.verifiedBy).length,
    with_evidence_count: recognitions.filter((r) => r.evidenceIds?.length > 0).length,
    average_weight: (
      recognitions.reduce((sum, r) => sum + (r.weight || 0), 0) / recognitions.length
    ).toFixed(2),
    status_breakdown: recognitions.reduce((acc, r) => {
      acc[r.status] = (acc[r.status] || 0) + 1;
      return acc;
    }, {}),
  };
}

/**
 * Export recognitions as HR-safe CSV
 * 
 * Usage:
 * POST /functions/export-csv-hr-safe
 * Body: {
 *   startDate: "2024-01-01",
 *   endDate: "2024-12-31",
 *   anonymizationLevel: "full" | "moderate" | "maximum"
 * }
 */
export default async function handler(req, context) {
  try {
    // Extract user from Appwrite auth
    const userId = req.headers['x-appwrite-user-id'];
    if (!userId) {
      return context.res.json(
        { error: 'Unauthorized', code: 'UNAUTHORIZED' },
        401
      );
    }

    // Check rate limit (5 exports per day per user)
    const rateLimitKey = `export_profile_${userId}`;
    const rateLimit = checkRateLimit(rateLimitKey, 'export_profile');

    if (!rateLimit.allowed) {
      // Log rate limit violation
      await createAuditLog({
        eventCode: 'EXPORT_CSV_RATE_LIMITED',
        actorId: userId,
        metadata: {
          rateLimitType: 'export_profile',
          remaining: rateLimit.remaining,
          resetAt: rateLimit.resetAt,
        },
      });

      return context.res.json(
        {
          error: 'Rate limit exceeded',
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

    const {
      startDate,
      endDate,
      anonymizationLevel = 'full',
    } = body;

    // Validate anonymization level
    const validLevels = ['maximum', 'full', 'moderate'];
    if (!validLevels.includes(anonymizationLevel)) {
      return context.res.json(
        {
          error: `Invalid anonymization level. Must be one of: ${validLevels.join(', ')}`,
          code: 'INVALID_ANONYMIZATION_LEVEL',
        },
        400
      );
    }

    // Validate date range
    let startDateTime = new Date(startDate || '2000-01-01').getTime();
    let endDateTime = new Date(endDate || new Date()).getTime();

    if (startDateTime > endDateTime) {
      return context.res.json(
        {
          error: 'Start date must be before end date',
          code: 'INVALID_DATE_RANGE',
        },
        400
      );
    }

    // Limit export window to prevent excessive data retrieval
    const maxWindow = 90 * 24 * 60 * 60 * 1000; // 90 days
    if (endDateTime - startDateTime > maxWindow) {
      endDateTime = startDateTime + maxWindow;
    }

    // Query recognitions for the user
    // Only fetch recognitions the user can see (gave or received)
    const recognitions = await databases.listDocuments(
      DATABASE_ID,
      'recognitions',
      [
        // Only include recognitions from the specified date range
        // Note: Appwrite Query API has limitations, so we'll filter in code
      ]
    );

    // Filter recognitions by:
    // 1. User can only export recognitions they gave or received
    // 2. Date range
    // 3. Not deleted/blocked
    const filteredRecognitions = recognitions.documents.filter((rec) => {
      const recDate = new Date(rec.createdAt).getTime();
      const userCanExport =
        rec.giverId === userId || // User gave recognition
        rec.recipientId === userId || // User received recognition
        rec.verifiedBy === userId; // User verified recognition

      return (
        userCanExport &&
        recDate >= startDateTime &&
        recDate <= endDateTime &&
        rec.status !== 'deleted' &&
        rec.status !== 'blocked'
      );
    });

    if (filteredRecognitions.length === 0) {
      return context.res.json(
        {
          error: 'No recognitions found for the specified date range',
          code: 'NO_DATA',
        },
        404
      );
    }

    // Generate CSV content
    const csvContent = generateCSVContent(filteredRecognitions, anonymizationLevel);

    // Calculate metrics
    const metrics = calculateMetrics(filteredRecognitions);

    // Log export
    await createAuditLog({
      eventCode: 'EXPORT_CSV_CREATED',
      actorId: userId,
      metadata: {
        startDate,
        endDate,
        anonymizationLevel,
        recordCount: filteredRecognitions.length,
        metrics,
      },
    });

    // Return CSV
    return context.res.json(
      {
        success: true,
        csv: csvContent,
        metrics,
        recordCount: filteredRecognitions.length,
        anonymizationLevel,
        exportedAt: new Date().toISOString(),
      },
      200,
      {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="recognition-export-${new Date().toISOString().split('T')[0]}.csv"`,
        'X-RateLimit-Limit': '5',
        'X-RateLimit-Remaining': String(rateLimit.remaining),
        'X-RateLimit-Reset': String(rateLimit.resetAt),
      }
    );
  } catch (error) {
    console.error('Error exporting CSV:', error);

    // Log error
    const userId = req.headers['x-appwrite-user-id'];
    if (userId) {
      await createAuditLog({
        eventCode: 'EXPORT_CSV_FAILED',
        actorId: userId,
        metadata: {
          error: error.message,
        },
      });
    }

    return context.res.json(
      {
        error: 'Failed to generate export',
        code: 'EXPORT_FAILED',
        details: error.message,
      },
      500
    );
  }
}
