/**
 * Structured Logger Service
 * Provides centralized JSON logging with PII scrubbing, correlation tracking,
 * and integration with monitoring systems (Prometheus, ELK, CloudWatch)
 * 
 * Features:
 * - JSON structured logging for machine parsing
 * - PII redaction (emails, phone numbers, SSNs, tokens, etc.)
 * - Correlation ID propagation
 * - Context-aware logging levels
 * - Integration with telemetry
 * - Error fingerprinting for deduplication
 */

import crypto from 'crypto';

/**
 * Log levels with severity mapping
 */
const LogLevels = {
  DEBUG: { level: 0, name: 'DEBUG', severity: 'low' },
  INFO: { level: 1, name: 'INFO', severity: 'low' },
  WARN: { level: 2, name: 'WARN', severity: 'medium' },
  ERROR: { level: 3, name: 'ERROR', severity: 'high' },
  CRITICAL: { level: 4, name: 'CRITICAL', severity: 'critical' },
};

/**
 * Patterns for PII redaction
 * Updated to catch: emails, phone numbers, credit cards, SSNs, tokens, URLs with secrets
 */
const PII_PATTERNS = [
  // Email addresses
  {
    regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    replacement: '[EMAIL]',
  },
  // Phone numbers (various formats)
  {
    regex: /(\+1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/g,
    replacement: '[PHONE]',
  },
  // Credit card numbers
  {
    regex: /\b(\d{4}[\s-]?){3}(\d{4})\b/g,
    replacement: '[CARD]',
  },
  // Social Security Numbers (XXX-XX-XXXX)
  {
    regex: /\d{3}-\d{2}-\d{4}/g,
    replacement: '[SSN]',
  },
  // API Keys and Tokens (common patterns)
  {
    regex: /(api[_-]?key|token|secret|password|auth)["\s:=]+[a-zA-Z0-9_.-]{20,}/gi,
    replacement: '$1=[REDACTED]',
  },
  // Bearer tokens
  {
    regex: /Bearer\s+[a-zA-Z0-9._-]+/gi,
    replacement: 'Bearer [TOKEN]',
  },
  // URLs with credentials
  {
    regex: /(https?:\/\/)([^:]+):([^@]+)@/g,
    replacement: '$1[USER]:[PASS]@',
  },
  // IPv4 addresses (partial masking)
  {
    regex: /(\d{1,3}\.\d{1,3}\.\d{1,3}\.)\d{1,3}/g,
    replacement: '$1***',
  },
];

/**
 * Redact PII from a string value
 * @param {string} value - Value to redact
 * @returns {string} Redacted value
 */
export function redactPII(value) {
  if (typeof value !== 'string') return value;

  let redacted = value;
  PII_PATTERNS.forEach(({ regex, replacement }) => {
    redacted = redacted.replace(regex, replacement);
  });
  return redacted;
}

/**
 * Deeply redact PII from an object
 * @param {object} obj - Object to redact (mutated in place)
 * @param {Set<string>} sensitiveKeys - Keys to always redact (case-insensitive)
 * @returns {object} Redacted object
 */
export function redactObjectPII(obj, sensitiveKeys = new Set()) {
  const defaultSensitiveKeys = new Set([
    'password',
    'secret',
    'token',
    'apikey',
    'api_key',
    'authorization',
    'x-api-key',
    'x-auth-token',
    'x-appwrite-key',
    'credit_card',
    'ssn',
    'phone',
    'email',
    'pid',
    'dob',
    'address',
  ]);

  // Merge user-provided sensitive keys
  sensitiveKeys.forEach(key => defaultSensitiveKeys.add(key.toLowerCase()));

  function scrub(val) {
    if (val === null || val === undefined) return val;

    if (typeof val === 'object' && !Array.isArray(val)) {
      const cleaned = {};
      for (const [key, value] of Object.entries(val)) {
        if (defaultSensitiveKeys.has(key.toLowerCase())) {
          cleaned[key] = '[REDACTED]';
        } else {
          cleaned[key] = scrub(value);
        }
      }
      return cleaned;
    }

    if (Array.isArray(val)) {
      return val.map(v => scrub(v));
    }

    if (typeof val === 'string') {
      return redactPII(val);
    }

    return val;
  }

  return scrub(obj);
}

/**
 * Generate error fingerprint for deduplication
 * Fingerprints errors by stack trace to group similar issues
 * @param {Error} error - Error to fingerprint
 * @returns {string} Fingerprint hash
 */
export function generateErrorFingerprint(error) {
  const stack = (error?.stack || 'unknown').split('\n').slice(0, 3).join('\n');
  return crypto
    .createHash('sha256')
    .update(stack)
    .digest('hex')
    .substring(0, 12);
}

/**
 * Format error for logging
 * @param {Error} error - Error to format
 * @returns {object} Formatted error object
 */
export function formatError(error) {
  return {
    name: error?.name || 'UnknownError',
    message: redactPII(error?.message || 'Unknown error'),
    stack: error?.stack ? redactPII(error.stack) : null,
    fingerprint: generateErrorFingerprint(error),
    code: error?.code,
    statusCode: error?.statusCode,
  };
}

/**
 * Context-aware structured logger class
 */
export class StructuredLogger {
  constructor(options = {}) {
    this.minLevel = LogLevels[options.minLevel || 'INFO'];
    this.correlationId = options.correlationId || this.generateCorrelationId();
    this.service = options.service || 'unknown';
    this.environment = options.environment || process.env.NODE_ENV || 'development';
    this.version = options.version || '1.0.0';
    this.sensitiveKeys = new Set(options.sensitiveKeys || []);
    this.metadata = options.metadata || {};
  }

  /**
   * Generate unique correlation ID
   */
  generateCorrelationId() {
    const timestamp = Date.now().toString(36);
    const random = crypto.randomBytes(6).toString('hex');
    return `${timestamp}-${random}`;
  }

  /**
   * Build base log object with context
   */
  buildLogContext() {
    return {
      timestamp: new Date().toISOString(),
      correlationId: this.correlationId,
      service: this.service,
      environment: this.environment,
      version: this.version,
      ...this.metadata,
    };
  }

  /**
   * Format and output log entry
   */
  log(level, message, data = {}) {
    if (LogLevels[level].level < this.minLevel.level) {
      return; // Skip logs below minimum level
    }

    // Redact PII from data
    const cleanData = redactObjectPII(data, this.sensitiveKeys);

    const logEntry = {
      ...this.buildLogContext(),
      level: LogLevels[level].name,
      severity: LogLevels[level].severity,
      message: redactPII(message),
      data: cleanData,
    };

    // Output as JSON for machine parsing
    console.log(JSON.stringify(logEntry));

    // In production, this would also send to centralized logging service
    this.sendToMonitoring(logEntry, LogLevels[level]);
  }

  /**
   * Send critical logs to monitoring system
   */
  sendToMonitoring(logEntry, levelInfo) {
    // Only send WARN, ERROR, and CRITICAL to monitoring
    if (levelInfo.level >= LogLevels.WARN.level) {
      // This would integrate with Prometheus, DataDog, New Relic, etc.
      // For now, we track it locally
      if (process.env.MONITORING_ENABLED === 'true') {
        this.recordMetric(`log_${logEntry.level.toLowerCase()}`, 1, {
          service: this.service,
          environment: this.environment,
        });
      }
    }
  }

  /**
   * Record metric for monitoring
   */
  recordMetric(name, value, _labels = {}) {
    // Placeholder for metric recording
    // In production, this sends to Prometheus, CloudWatch, etc.
  }

  // Convenience methods
  debug(message, data) { this.log('DEBUG', message, data); }
  info(message, data) { this.log('INFO', message, data); }
  warn(message, data) { this.log('WARN', message, data); }
  error(message, errorOrData, data) {
    // Support both error object and plain data
    const errorData = errorOrData instanceof Error
      ? { error: formatError(errorOrData), ...data }
      : { ...errorOrData, ...data };
    this.log('ERROR', message, errorData);
  }
  critical(message, data) { this.log('CRITICAL', message, data); }

  /**
   * Create a child logger with additional context
   */
  child(metadata) {
    return new StructuredLogger({
      minLevel: this.minLevel.name,
      correlationId: this.correlationId,
      service: this.service,
      environment: this.environment,
      version: this.version,
      sensitiveKeys: this.sensitiveKeys,
      metadata: { ...this.metadata, ...metadata },
    });
  }

  /**
   * Track request context
   */
  trackRequest(req, res) {
    const startTime = Date.now();

    const requestLog = {
      method: req.method,
      url: redactPII(req.url || ''),
      ip: req.headers['x-forwarded-for']?.split(',')[0] || req.ip,
      userAgent: req.headers['user-agent'],
    };

    // Log incoming request
    this.info('Request received', requestLog);

    // Capture response
    const originalJson = res.json;
    res.json = (body) => {
      const duration = Date.now() - startTime;
      this.info('Request completed', {
        method: req.method,
        statusCode: res.statusCode,
        duration: `${duration}ms`,
        size: JSON.stringify(body).length,
      });
      return originalJson.call(res, body);
    };
  }
}

/**
 * Global logger instance
 */
export const globalLogger = new StructuredLogger({
  service: process.env.SERVICE_NAME || 'appwrite-functions',
  environment: process.env.NODE_ENV || 'development',
  version: process.env.APP_VERSION || '1.0.0',
  minLevel: process.env.LOG_LEVEL || 'INFO',
});

export default StructuredLogger;
