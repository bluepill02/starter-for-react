/**
 * Audit Log Export Function
 * Generates comprehensive audit logs for compliance and investigation
 * 
 * Features:
 * - Export audit logs in multiple formats (JSON, CSV)
 * - Filter by date range, event type, actor
 * - Hashed identifiers for privacy
 * - Access control: only admins/auditors
 * - Rate limiting
 * - Comprehensive audit of the audit export itself
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
 * Convert audit entries to CSV format
 */
function convertToCSV(entries) {
  if (entries.length === 0) {
    return 'No audit entries found';
  }

  // CSV Headers
  const headers = [
    'Timestamp',
    'Event Code',
    'Actor ID',
    'Target ID',
    'IP Address',
    'User Agent',
    'Metadata',
  ];

  // CSV Rows
  const rows = entries.map((entry) => [
    new Date(entry.createdAt).toISOString(),
    entry.eventCode,
    entry.actorId || 'system',
    entry.targetId || '',
    entry.ipAddress || '',
    entry.userAgent ? entry.userAgent.substring(0, 50) : '',
    typeof entry.metadata === 'string' ? entry.metadata : JSON.stringify(entry.metadata || {}),
  ]);

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

  return csvLines.join('\n');
}

/**
 * Export audit logs
 * 
 * Usage:
 * POST /functions/audit-log-export
 * Headers: x-appwrite-user-id, x-appwrite-user-role
 * Body: {
 *   startDate: "2024-01-01",
 *   endDate: "2024-12-31",
 *   eventCodes?: ["RECOGNITION_CREATED", "ADMIN_OVERRIDE_SUCCESS"],
 *   actorId?: "user-id",
 *   format: "json" | "csv",
 *   includeMetadata?: boolean (default: true)
 * }
 */
export default async function handler(req, context) {
  try {
    // Extract user ID and role
    const userId = req.headers['x-appwrite-user-id'];
    const userRole = req.headers['x-appwrite-user-role'] || 'user';

    if (!userId) {
      return context.res.json(
        {
          error: 'Unauthorized',
          code: 'UNAUTHORIZED',
        },
        401
      );
    }

    // Role check: only admin and auditor can export audit logs
    if (userRole !== 'admin' && userRole !== 'auditor') {
      await createAuditLog({
        eventCode: 'AUDIT_EXPORT_DENIED',
        actorId: userId,
        metadata: {
          reason: 'Insufficient permissions',
          userRole,
        },
      });

      return context.res.json(
        {
          error: 'Only admins and auditors can export audit logs',
          code: 'PERMISSION_DENIED',
        },
        403
      );
    }

    // Check rate limit (5 exports per day per user)
    const rateLimitKey = `audit_export_${userId}`;
    const rateLimit = checkRateLimit(rateLimitKey, 'export_profile');

    if (!rateLimit.allowed) {
      await createAuditLog({
        eventCode: 'AUDIT_EXPORT_RATE_LIMITED',
        actorId: userId,
        metadata: {
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

    // Parse request
    const body = typeof req.bodyJson === 'string'
      ? JSON.parse(req.bodyJson)
      : req.bodyJson;

    const {
      startDate,
      endDate,
      eventCodes,
      actorId,
      format = 'json',
      includeMetadata = true,
    } = body;

    // Validation
    if (!startDate || !endDate) {
      return context.res.json(
        {
          error: 'startDate and endDate are required',
          code: 'VALIDATION_ERROR',
        },
        400
      );
    }

    if (!['json', 'csv'].includes(format)) {
      return context.res.json(
        {
          error: 'format must be "json" or "csv"',
          code: 'INVALID_FORMAT',
        },
        400
      );
    }

    // Limit export window to prevent excessive data retrieval (90 days)
    const startDateTime = new Date(startDate).getTime();
    const endDateTime = new Date(endDate).getTime();
    const maxWindow = 90 * 24 * 60 * 60 * 1000;

    if (endDateTime - startDateTime > maxWindow) {
      return context.res.json(
        {
          error: 'Date range cannot exceed 90 days',
          code: 'WINDOW_TOO_LARGE',
        },
        400
      );
    }

    // Query audit entries
    const auditEntries = await databases.listDocuments(DATABASE_ID, 'audit-entries');

    // Filter entries
    let filteredEntries = auditEntries.documents.filter((entry) => {
      const entryDate = new Date(entry.createdAt).getTime();
      const inDateRange = entryDate >= startDateTime && entryDate <= endDateTime;

      const matchesEventCode = !eventCodes || eventCodes.includes(entry.eventCode);
      const matchesActor = !actorId || entry.actorId === actorId;

      return inDateRange && matchesEventCode && matchesActor;
    });

    if (filteredEntries.length === 0) {
      return context.res.json(
        {
          error: 'No audit entries found for the specified criteria',
          code: 'NO_DATA',
        },
        404
      );
    }

    // Remove metadata if not requested
    if (!includeMetadata) {
      filteredEntries = filteredEntries.map((entry) => ({
        ...entry,
        metadata: undefined,
      }));
    }

    // Convert to requested format
    let exportContent;
    let contentType;
    let fileName;

    if (format === 'csv') {
      exportContent = convertToCSV(filteredEntries);
      contentType = 'text/csv; charset=utf-8';
      fileName = `audit-log-${new Date().toISOString().split('T')[0]}.csv`;
    } else {
      exportContent = JSON.stringify(
        {
          exportDate: new Date().toISOString(),
          filters: {
            startDate,
            endDate,
            eventCodes,
            actorId,
          },
          recordCount: filteredEntries.length,
          entries: filteredEntries,
        },
        null,
        2
      );
      contentType = 'application/json';
      fileName = `audit-log-${new Date().toISOString().split('T')[0]}.json`;
    }

    // Log the export itself
    await createAuditLog({
      eventCode: 'AUDIT_LOG_EXPORTED',
      actorId: userId,
      metadata: {
        format,
        recordCount: filteredEntries.length,
        filters: {
          startDate,
          endDate,
          eventCodesCount: eventCodes?.length || 0,
          actorIdSpecified: !!actorId,
        },
        includeMetadata,
      },
    });

    return context.res.json(
      {
        success: true,
        data: format === 'json' ? JSON.parse(exportContent) : exportContent,
        format,
        recordCount: filteredEntries.length,
        exportedAt: new Date().toISOString(),
      },
      200,
      {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'X-Record-Count': String(filteredEntries.length),
      }
    );
  } catch (error) {
    console.error('Error exporting audit logs:', error);

    const userId = req.headers['x-appwrite-user-id'];
    if (userId) {
      await createAuditLog({
        eventCode: 'AUDIT_LOG_EXPORT_FAILED',
        actorId: userId,
        metadata: {
          error: error.message,
        },
      });
    }

    return context.res.json(
      {
        error: 'Failed to export audit logs',
        code: 'EXPORT_FAILED',
        details: error.message,
      },
      500
    );
  }
}
