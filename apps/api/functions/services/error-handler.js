/**
 * Error Handler Service
 * Comprehensive error handling with classification, recovery strategies, and telemetry
 * 
 * Features:
 * - Error classification and categorization
 * - Automatic retry logic with exponential backoff
 * - Circuit breaker pattern for cascading failures
 * - Error recovery suggestions
 * - Integration with error tracking (Sentry, Rollbar, etc.)
 * - Error deduplication and alerts
 */

import { globalLogger, formatError, generateErrorFingerprint } from './structured-logger.js';

/**
 * Error categories with handling strategies
 */
const ErrorCategories = {
  VALIDATION: {
    code: 'VALIDATION_ERROR',
    statusCode: 400,
    retryable: false,
    userFacing: true,
    severity: 'low',
  },
  AUTHENTICATION: {
    code: 'AUTH_ERROR',
    statusCode: 401,
    retryable: false,
    userFacing: true,
    severity: 'medium',
  },
  AUTHORIZATION: {
    code: 'AUTHZ_ERROR',
    statusCode: 403,
    retryable: false,
    userFacing: true,
    severity: 'medium',
  },
  NOT_FOUND: {
    code: 'NOT_FOUND',
    statusCode: 404,
    retryable: false,
    userFacing: true,
    severity: 'low',
  },
  RATE_LIMIT: {
    code: 'RATE_LIMIT',
    statusCode: 429,
    retryable: true,
    userFacing: true,
    severity: 'medium',
  },
  CONFLICT: {
    code: 'CONFLICT',
    statusCode: 409,
    retryable: true,
    userFacing: true,
    severity: 'low',
  },
  EXTERNAL_SERVICE: {
    code: 'EXTERNAL_SERVICE_ERROR',
    statusCode: 502,
    retryable: true,
    userFacing: false,
    severity: 'high',
  },
  DATABASE: {
    code: 'DATABASE_ERROR',
    statusCode: 500,
    retryable: true,
    userFacing: false,
    severity: 'high',
  },
  INTERNAL: {
    code: 'INTERNAL_ERROR',
    statusCode: 500,
    retryable: false,
    userFacing: false,
    severity: 'critical',
  },
  UNKNOWN: {
    code: 'UNKNOWN_ERROR',
    statusCode: 500,
    retryable: false,
    userFacing: false,
    severity: 'high',
  },
};

/**
 * Classify error and determine handling strategy
 * @param {Error} error - Error to classify
 * @returns {object} Error classification with handler
 */
export function classifyError(error) {
  // Handle Appwrite-specific errors
  if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
    return ErrorCategories.EXTERNAL_SERVICE;
  }

  if (error.message.includes('Validation') || error.message.includes('Invalid')) {
    return ErrorCategories.VALIDATION;
  }

  if (error.message.includes('Unauthorized') || error.message.includes('Invalid credentials')) {
    return ErrorCategories.AUTHENTICATION;
  }

  if (error.message.includes('Permission denied') || error.message.includes('Forbidden')) {
    return ErrorCategories.AUTHORIZATION;
  }

  if (error.message.includes('Not found') || error.statusCode === 404) {
    return ErrorCategories.NOT_FOUND;
  }

  if (error.message.includes('Rate limit') || error.statusCode === 429) {
    return ErrorCategories.RATE_LIMIT;
  }

  if (error.message.includes('Conflict') || error.statusCode === 409) {
    return ErrorCategories.CONFLICT;
  }

  if (error.message.includes('Database') || error.code === 'EQUERY') {
    return ErrorCategories.DATABASE;
  }

  if (error.statusCode >= 500) {
    return ErrorCategories.EXTERNAL_SERVICE;
  }

  return ErrorCategories.UNKNOWN;
}

/**
 * Generate retry backoff delay (exponential backoff with jitter)
 * @param {number} attempt - Retry attempt number (0-indexed)
 * @param {number} baseDelay - Base delay in milliseconds (default: 100ms)
 * @returns {number} Delay in milliseconds
 */
export function getRetryDelay(attempt, baseDelay = 100) {
  // Exponential backoff: 100ms, 200ms, 400ms, 800ms, 1600ms, ...
  const delay = baseDelay * Math.pow(2, attempt);
  // Add jitter to prevent thundering herd
  const jitter = Math.random() * 0.1 * delay;
  // Cap at 30 seconds
  return Math.min(delay + jitter, 30000);
}

/**
 * Retry operation with exponential backoff
 * @param {Function} fn - Async function to retry
 * @param {number} maxAttempts - Maximum retry attempts (default: 3)
 * @param {Function} shouldRetry - Optional predicate to determine if retry needed
 * @returns {Promise<any>} Result of successful operation
 */
export async function retryWithBackoff(fn, maxAttempts = 3, shouldRetry = null) {
  let lastError;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Check if error is retryable
      const isRetryable = shouldRetry
        ? shouldRetry(error)
        : classifyError(error).retryable;

      if (!isRetryable || attempt === maxAttempts - 1) {
        throw error;
      }

      // Calculate backoff and wait
      const delay = getRetryDelay(attempt);
      globalLogger.warn(`Retry attempt ${attempt + 1}/${maxAttempts} after ${delay}ms`, {
        error: formatError(error),
      });

      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

/**
 * Circuit breaker for handling cascading failures
 */
export class CircuitBreaker {
  constructor(options = {}) {
    this.failureThreshold = options.failureThreshold || 5; // Fail after 5 errors
    this.resetTimeout = options.resetTimeout || 60000; // Reset after 1 minute
    this.name = options.name || 'CircuitBreaker';

    this.failures = 0;
    this.lastFailureTime = null;
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
  }

  /**
   * Execute operation with circuit breaker protection
   */
  async execute(fn) {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.resetTimeout) {
        this.state = 'HALF_OPEN';
        globalLogger.info(`${this.name} circuit breaker transitioning to HALF_OPEN`);
      } else {
        const error = new Error(`${this.name} circuit breaker is OPEN`);
        error.code = 'CIRCUIT_BREAKER_OPEN';
        error.statusCode = 503;
        throw error;
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Record successful call
   */
  onSuccess() {
    if (this.state === 'HALF_OPEN') {
      this.state = 'CLOSED';
      this.failures = 0;
      globalLogger.info(`${this.name} circuit breaker transitioned to CLOSED`);
    }
  }

  /**
   * Record failed call
   */
  onFailure() {
    this.failures += 1;
    this.lastFailureTime = Date.now();

    if (this.failures >= this.failureThreshold && this.state !== 'OPEN') {
      this.state = 'OPEN';
      globalLogger.critical(`${this.name} circuit breaker opened after ${this.failures} failures`);
    }
  }

  /**
   * Reset circuit breaker manually
   */
  reset() {
    this.failures = 0;
    this.state = 'CLOSED';
    this.lastFailureTime = null;
  }

  /**
   * Get current state
   */
  getState() {
    return {
      name: this.name,
      state: this.state,
      failures: this.failures,
      failureThreshold: this.failureThreshold,
    };
  }
}

/**
 * Format error response for API
 * @param {Error} error - Error to format
 * @param {object} options - Formatting options
 * @returns {object} Formatted error response
 */
export function formatErrorResponse(error, options = {}) {
  const hideDetails = options.hideDetails !== false || process.env.NODE_ENV === 'production';
  const category = classifyError(error);

  const response = {
    code: category.code,
    message: hideDetails ? 'An error occurred' : error.message,
    statusCode: category.statusCode,
    timestamp: new Date().toISOString(),
  };

  // Include fingerprint for duplicate detection
  if (!hideDetails) {
    response.fingerprint = generateErrorFingerprint(error);
  }

  // Include suggestions if available
  if (options.includeSuggestions) {
    response.suggestions = getErrorRecoverySuggestions(error, category);
  }

  // Include retry information if applicable
  if (category.retryable) {
    response.retryable = true;
    response.retryAfter = options.retryAfter || 5; // seconds
  }

  return response;
}

/**
 * Get recovery suggestions for an error
 * @param {Error} error - Error to get suggestions for
 * @param {object} category - Error category
 * @returns {Array<string>} Suggested recovery actions
 */
export function getErrorRecoverySuggestions(error, category = null) {
  const cat = category || classifyError(error);
  const suggestions = [];

  switch (cat.code) {
    case 'VALIDATION_ERROR':
      suggestions.push('Check your input parameters');
      suggestions.push('Verify required fields are provided');
      break;

    case 'AUTH_ERROR':
      suggestions.push('Please log in again');
      suggestions.push('Refresh your authentication token');
      break;

    case 'AUTHZ_ERROR':
      suggestions.push('You do not have permission to perform this action');
      suggestions.push('Contact your administrator');
      break;

    case 'NOT_FOUND':
      suggestions.push('The requested resource does not exist');
      suggestions.push('Check the resource ID or path');
      break;

    case 'RATE_LIMIT':
      suggestions.push('Please wait before retrying');
      suggestions.push('Reduce the frequency of requests');
      break;

    case 'EXTERNAL_SERVICE_ERROR':
      suggestions.push('The service is temporarily unavailable');
      suggestions.push('Please try again in a few moments');
      break;

    case 'DATABASE_ERROR':
      suggestions.push('A database error occurred');
      suggestions.push('Please try your operation again');
      break;

    default:
      suggestions.push('An unexpected error occurred');
      suggestions.push('Please try again or contact support');
  }

  return suggestions;
}

/**
 * Error tracker for deduplication and alerting
 */
export class ErrorTracker {
  constructor(options = {}) {
    this.maxErrors = options.maxErrors || 100;
    this.dedupWindow = options.dedupWindow || 60000; // 1 minute
    this.errors = [];
    this.fingerprints = new Map(); // fingerprint -> count and last seen
  }

  /**
   * Track error occurrence
   */
  track(error) {
    const fingerprint = generateErrorFingerprint(error);
    const now = Date.now();

    // Check if we've seen this error recently
    const tracked = this.fingerprints.get(fingerprint) || { count: 0, firstSeen: now, lastSeen: now };

    tracked.count += 1;
    tracked.lastSeen = now;

    // Alert if error is recurring frequently
    if (tracked.count > 5 && (now - tracked.firstSeen) < this.dedupWindow) {
      globalLogger.warn('Recurring error detected', {
        fingerprint,
        count: tracked.count,
        error: formatError(error),
      });
    }

    this.fingerprints.set(fingerprint, tracked);

    // Store error for analysis
    this.errors.push({
      fingerprint,
      error: formatError(error),
      timestamp: new Date().toISOString(),
    });

    // Keep only recent errors
    if (this.errors.length > this.maxErrors) {
      this.errors = this.errors.slice(-this.maxErrors);
    }

    return fingerprint;
  }

  /**
   * Get error statistics
   */
  getStats() {
    const stats = {
      totalUnique: this.fingerprints.size,
      totalOccurrences: Array.from(this.fingerprints.values()).reduce((sum, t) => sum + t.count, 0),
      topErrors: Array.from(this.fingerprints.entries())
        .map(([fp, tracked]) => ({
          fingerprint: fp,
          count: tracked.count,
          lastSeen: tracked.lastSeen,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10),
    };

    return stats;
  }

  /**
   * Clear error history
   */
  clear() {
    this.errors = [];
    this.fingerprints.clear();
  }
}

/**
 * Global error tracker
 */
export const globalErrorTracker = new ErrorTracker();

export default {
  classifyError,
  getRetryDelay,
  retryWithBackoff,
  CircuitBreaker,
  formatErrorResponse,
  getErrorRecoverySuggestions,
  ErrorTracker,
  globalErrorTracker,
};
