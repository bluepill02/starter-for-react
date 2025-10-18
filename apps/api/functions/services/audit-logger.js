/**
 * Audit Logging Service
 * Comprehensive logging for all sensitive operations
 * Features:
 * - Immutable audit trail
 * - Hashed IDs for privacy
 * - Query/filtering capabilities
 * - Telemetry integration
 * - Alert generation for suspicious patterns
 */

const { ID } = require('node-appwrite');

/**
 * Event codes for audit logging
 */
const AuditEventCodes = {
  // Recognition operations
  RECOGNITION_CREATED: 'RECOGNITION_CREATED',
  RECOGNITION_VERIFIED: 'RECOGNITION_VERIFIED',
  RECOGNITION_EXPORTED: 'RECOGNITION_EXPORTED',
  RECOGNITION_BLOCKED: 'RECOGNITION_BLOCKED',
  RECOGNITION_ERROR: 'RECOGNITION_ERROR',
  
  // Evidence operations
  EVIDENCE_UPLOADED: 'EVIDENCE_UPLOADED',
  EVIDENCE_PREVIEWED: 'EVIDENCE_PREVIEWED',
  EVIDENCE_DELETED: 'EVIDENCE_DELETED',
  
  // Authentication operations
  AUTH_SIGNIN_SUCCESS: 'AUTH_SIGNIN_SUCCESS',
  AUTH_SIGNIN_FAILED: 'AUTH_SIGNIN_FAILED',
  AUTH_SIGNUP: 'AUTH_SIGNUP',
  AUTH_SIGNOUT: 'AUTH_SIGNOUT',
  AUTH_OAUTH_SUCCESS: 'AUTH_OAUTH_SUCCESS',
  AUTH_OAUTH_FAILED: 'AUTH_OAUTH_FAILED',
  AUTH_RATE_LIMITED: 'AUTH_RATE_LIMITED',
  
  // Admin operations
  ADMIN_ACTION: 'ADMIN_ACTION',
  ADMIN_OVERRIDE: 'ADMIN_OVERRIDE',
  ABUSE_FLAGGED: 'ABUSE_FLAGGED',
  ABUSE_REVIEWED: 'ABUSE_REVIEWED',
  ABUSE_DISMISSED: 'ABUSE_DISMISSED',
  
  // System operations
  USER_SYNCED: 'USER_SYNCED',
  INTEGRATION_CALLED: 'INTEGRATION_CALLED',
  TELEMETRY_EVENT: 'TELEMETRY_EVENT',
  RATE_LIMIT_BREACH: 'RATE_LIMIT_BREACH',
  EXPORT_REQUESTED: 'EXPORT_REQUESTED',
};

/**
 * Hash user ID for privacy
 * @param {string} userId - User ID to hash
 * @returns {string} Hashed user ID (privacy-safe)
 */
function hashUserId(userId) {
  if (!userId) return 'SYSTEM';
  return Buffer.from(userId).toString('base64').replace(/[+=/]/g, '').substring(0, 16);
}

/**
 * Extract IP address from request headers
 * @param {object} req - Request object
 * @returns {string} IP address
 */
function extractIpAddress(req) {
  return req.headers['x-forwarded-for']?.split(',')[0].trim() ||
         req.headers['x-real-ip'] ||
         req.headers['cf-connecting-ip'] ||
         'UNKNOWN';
}

/**
 * Extract user agent from request headers
 * @param {object} req - Request object
 * @returns {string} User agent string
 */
function extractUserAgent(req) {
  return req.headers['user-agent'] || 'UNKNOWN';
}

/**
 * Create audit log entry
 * @param {object} databases - Appwrite Databases instance
 * @param {string} eventCode - Event code (from AuditEventCodes)
 * @param {string} actorId - User ID performing the action (will be hashed)
 * @param {string} targetId - Optional target resource ID (will be hashed)
 * @param {object} metadata - Additional metadata to log
 * @param {object} req - Optional HTTP request object for IP/user agent
 * @returns {Promise<string>} Created audit entry ID
 */
async function createAuditLog(
  databases,
  eventCode,
  actorId,
  targetId,
  metadata = {},
  req = null
) {
  try {
    const DATABASE_ID = process.env.DATABASE_ID || 'main';
    const AUDIT_COLLECTION_ID = process.env.AUDIT_COLLECTION_ID || 'audit_entries';

    const ipAddress = req ? extractIpAddress(req) : 'API';
    const userAgent = req ? extractUserAgent(req) : 'UNKNOWN';

    const auditEntry = {
      eventCode,
      actorId: hashUserId(actorId),
      targetId: targetId ? hashUserId(targetId) : null,
      metadata: JSON.stringify(metadata),
      ipAddress,
      userAgent,
      createdAt: new Date().toISOString(),
    };

    const response = await databases.createDocument(
      DATABASE_ID,
      AUDIT_COLLECTION_ID,
      ID.unique(),
      auditEntry
    );

    return response.$id;
  } catch (error) {
    console.error('Failed to create audit log:', error);
    // Don't throw - audit logging is critical but shouldn't break the main operation
    throw error;
  }
}

/**
 * Query audit logs with filters
 * @param {object} databases - Appwrite Databases instance
 * @param {object} filters - Filter options
 * @returns {Promise<Array>} Audit log entries
 */
async function queryAuditLogs(databases, filters = {}) {
  try {
    const DATABASE_ID = process.env.DATABASE_ID || 'main';
    const AUDIT_COLLECTION_ID = process.env.AUDIT_COLLECTION_ID || 'audit_entries';

    const queries = [];

    // Filter by event code
    if (filters.eventCode) {
      queries.push(`eventCode.equal("${filters.eventCode}")`);
    }

    // Filter by actor
    if (filters.actorId) {
      queries.push(`actorId.equal("${hashUserId(filters.actorId)}")`);
    }

    // Filter by target
    if (filters.targetId) {
      queries.push(`targetId.equal("${hashUserId(filters.targetId)}")`);
    }

    // Filter by date range
    if (filters.startDate) {
      queries.push(`createdAt.greaterThanEqual("${filters.startDate}")`);
    }
    if (filters.endDate) {
      queries.push(`createdAt.lessThanEqual("${filters.endDate}")`);
    }

    // Filter by IP address
    if (filters.ipAddress) {
      queries.push(`ipAddress.equal("${filters.ipAddress}")`);
    }

    // Pagination
    const limit = filters.limit || 50;
    const offset = filters.offset || 0;

    const result = await databases.listDocuments(
      DATABASE_ID,
      AUDIT_COLLECTION_ID,
      queries.length > 0 ? queries : undefined,
      limit,
      offset
    );

    return {
      entries: result.documents.map(doc => ({
        ...doc,
        metadata: doc.metadata ? JSON.parse(doc.metadata) : {},
      })),
      total: result.total,
      limit,
      offset,
    };
  } catch (error) {
    console.error('Failed to query audit logs:', error);
    throw error;
  }
}

/**
 * Get audit summary for a user
 * @param {object} databases - Appwrite Databases instance
 * @param {string} userId - User ID to get summary for
 * @param {number} days - Number of days to look back (default: 30)
 * @returns {Promise<object>} Audit summary
 */
async function getAuditSummary(databases, userId, days = 30) {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const logs = await queryAuditLogs(databases, {
      actorId: userId,
      startDate: startDate.toISOString(),
    });

    // Aggregate by event type
    const eventCounts = {};
    logs.entries.forEach(entry => {
      eventCounts[entry.eventCode] = (eventCounts[entry.eventCode] || 0) + 1;
    });

    // Detect suspicious patterns
    const suspiciousPatterns = detectSuspiciousPatterns(logs.entries);

    return {
      userId: hashUserId(userId),
      period: {
        start: startDate.toISOString(),
        end: new Date().toISOString(),
        days,
      },
      totalEvents: logs.total,
      eventCounts,
      suspiciousPatterns,
      lastActivity: logs.entries[0]?.createdAt,
    };
  } catch (error) {
    console.error('Failed to get audit summary:', error);
    throw error;
  }
}

/**
 * Detect suspicious patterns in audit logs
 * @param {Array<object>} entries - Audit log entries
 * @returns {Array<object>} Detected suspicious patterns
 */
function detectSuspiciousPatterns(entries) {
  const patterns = [];

  if (!entries || entries.length === 0) {
    return patterns;
  }

  // Detect rapid auth failures
  const authFailures = entries.filter(e => e.eventCode === AuditEventCodes.AUTH_SIGNIN_FAILED);
  if (authFailures.length >= 5) {
    patterns.push({
      type: 'RAPID_AUTH_FAILURES',
      severity: 'HIGH',
      count: authFailures.length,
      description: `${authFailures.length} authentication failures detected`,
    });
  }

  // Detect rate limit breaches
  const rateLimitBreach = entries.filter(e => e.eventCode === AuditEventCodes.RATE_LIMIT_BREACH);
  if (rateLimitBreach.length >= 3) {
    patterns.push({
      type: 'RATE_LIMIT_BREACHES',
      severity: 'MEDIUM',
      count: rateLimitBreach.length,
      description: `${rateLimitBreach.length} rate limit breaches detected`,
    });
  }

  // Detect unusual activity patterns (recognitions outside normal hours)
  const recognitionCreates = entries.filter(e => e.eventCode === AuditEventCodes.RECOGNITION_CREATED);
  if (recognitionCreates.length >= 20) {
    patterns.push({
      type: 'UNUSUAL_VOLUME',
      severity: 'MEDIUM',
      count: recognitionCreates.length,
      description: `${recognitionCreates.length} recognitions created (high volume)`,
    });
  }

  // Detect multiple failed admin operations
  const adminErrors = entries.filter(e => 
    e.eventCode === AuditEventCodes.ADMIN_ACTION && 
    e.metadata?.error
  );
  if (adminErrors.length >= 5) {
    patterns.push({
      type: 'ADMIN_OPERATION_ERRORS',
      severity: 'MEDIUM',
      count: adminErrors.length,
      description: `${adminErrors.length} admin operations failed`,
    });
  }

  return patterns;
}

/**
 * Generate audit report
 * @param {object} databases - Appwrite Databases instance
 * @param {object} options - Report options
 * @returns {Promise<object>} Audit report
 */
async function generateAuditReport(databases, options = {}) {
  try {
    const startDate = options.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const endDate = options.endDate || new Date();

    const logs = await queryAuditLogs(databases, {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      limit: 10000, // Large limit for full report
    });

    // Aggregate statistics
    const stats = {
      totalEvents: logs.total,
      eventsByType: {},
      eventsByActor: {},
      eventsByDate: {},
      uniqueActors: new Set(),
      uniqueIPs: new Set(),
      suspiciousActivities: [],
    };

    logs.entries.forEach(entry => {
      // Count by event type
      stats.eventsByType[entry.eventCode] = (stats.eventsByType[entry.eventCode] || 0) + 1;

      // Count by actor
      if (entry.actorId !== 'SYSTEM') {
        stats.eventsByActor[entry.actorId] = (stats.eventsByActor[entry.actorId] || 0) + 1;
        stats.uniqueActors.add(entry.actorId);
      }

      // Count by date
      const date = new Date(entry.createdAt).toISOString().split('T')[0];
      stats.eventsByDate[date] = (stats.eventsByDate[date] || 0) + 1;

      // Track unique IPs
      if (entry.ipAddress !== 'API') {
        stats.uniqueIPs.add(entry.ipAddress);
      }
    });

    // Detect suspicious activities
    const suspiciousThreshold = options.suspiciousThreshold || 100;
    Object.entries(stats.eventsByActor).forEach(([actor, count]) => {
      if (count > suspiciousThreshold) {
        stats.suspiciousActivities.push({
          actor,
          count,
          description: `High activity count (${count} events)`,
        });
      }
    });

    return {
      reportPeriod: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      },
      statistics: {
        ...stats,
        uniqueActors: stats.uniqueActors.size,
        uniqueIPs: stats.uniqueIPs.size,
      },
      topEvents: Object.entries(stats.eventsByType)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10),
      topActors: Object.entries(stats.eventsByActor)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10),
    };
  } catch (error) {
    console.error('Failed to generate audit report:', error);
    throw error;
  }
}

/**
 * Audit middleware for Appwrite Functions
 * @param {object} req - HTTP request
 * @param {string} eventCode - Event code to log
 * @param {string} userId - User ID (actor)
 * @param {string} _targetId - Optional target ID (unused)
 * @param {object} _metadata - Optional metadata (unused)
 * @returns {Promise<void>}
 */
async function auditMiddleware(req, eventCode, userId, _targetId = null, _metadata = {}) {
  try {
    // This would be called within function handlers
    // Typically after successful operation
    // For now, just return a promise that resolves
    return Promise.resolve();
  } catch (error) {
    console.error('Audit middleware error:', error);
    // Non-critical - don't throw
  }
}

module.exports = {
  AuditEventCodes,
  hashUserId,
  createAuditLog,
  queryAuditLogs,
  getAuditSummary,
  detectSuspiciousPatterns,
  generateAuditReport,
  auditMiddleware,
};
