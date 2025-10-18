/**
 * Request Context Middleware
 * Provides unified request/response context with correlation tracking,
 * performance monitoring, and error handling
 * 
 * Features:
 * - Request correlation ID injection
 * - Performance monitoring
 * - Error context preservation
 * - Request/response body logging
 * - Async local storage for context propagation
 */

import { AsyncLocalStorage } from 'async_hooks';
import { globalLogger } from './structured-logger.js';
import { formatError, formatErrorResponse } from './error-handler.js';

/**
 * Async local storage for request context
 * Allows context to be accessed throughout async call chain
 */
const requestContextStorage = new AsyncLocalStorage();

/**
 * Request context object
 */
export class RequestContext {
  constructor(options = {}) {
    this.correlationId = options.correlationId || this.generateId();
    this.traceId = options.traceId || this.generateId();
    this.requestId = options.requestId || this.generateId();

    this.method = options.method || 'UNKNOWN';
    this.path = options.path || '';
    this.ip = options.ip || 'unknown';
    this.userAgent = options.userAgent || '';
    this.userId = options.userId || null;

    this.startTime = Date.now();
    this.endTime = null;

    this.logger = globalLogger.child({
      correlationId: this.correlationId,
      traceId: this.traceId,
      requestId: this.requestId,
    });

    this.metadata = options.metadata || {};
  }

  /**
   * Generate unique ID
   */
  generateId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `${timestamp}${random}`;
  }

  /**
   * Get request duration in milliseconds
   */
  getDuration() {
    return (this.endTime || Date.now()) - this.startTime;
  }

  /**
   * Mark request as completed
   */
  end() {
    this.endTime = Date.now();
  }

  /**
   * Get context summary
   */
  getSummary() {
    return {
      correlationId: this.correlationId,
      traceId: this.traceId,
      requestId: this.requestId,
      method: this.method,
      path: this.path,
      ip: this.ip,
      userId: this.userId,
      duration: this.getDuration(),
      metadata: this.metadata,
    };
  }

  /**
   * Add metadata to context
   */
  addMetadata(key, value) {
    this.metadata[key] = value;
  }
}

/**
 * Get current request context (or null if not in request)
 */
export function getRequestContext() {
  return requestContextStorage.getStore();
}

/**
 * Create Express/Node middleware for request context
 * @returns {Function} Middleware function
 */
export function requestContextMiddleware() {
  return (req, res, next) => {
    const context = new RequestContext({
      correlationId: req.headers['x-correlation-id'] || req.headers['x-request-id'],
      traceId: req.headers['x-trace-id'] || req.headers['traceparent'],
      method: req.method,
      path: req.path || req.url,
      ip: req.headers['x-forwarded-for']?.split(',')[0] || req.ip,
      userAgent: req.headers['user-agent'],
      userId: req.headers['x-user-id'] || req.user?.id,
    });

    // Run the rest of the request in the context
    requestContextStorage.run(context, () => {
      // Inject correlation IDs into response headers
      res.setHeader('X-Correlation-ID', context.correlationId);
      res.setHeader('X-Trace-ID', context.traceId);
      res.setHeader('X-Request-ID', context.requestId);

      // Log incoming request
      context.logger.info('Request received', {
        method: context.method,
        path: context.path,
        ip: context.ip,
        userId: context.userId,
      });

      // Capture response
      const originalJson = res.json.bind(res);
      const originalEnd = res.end.bind(res);

      res.json = (body) => {
        context.end();
        const duration = context.getDuration();

        context.logger.info('Request completed', {
          method: context.method,
          statusCode: res.statusCode,
          duration: `${duration}ms`,
          size: JSON.stringify(body).length,
        });

        return originalJson(body);
      };

      res.end = (chunk, encoding, callback) => {
        if (!context.endTime) {
          context.end();
          const duration = context.getDuration();

          context.logger.info('Request completed', {
            method: context.method,
            statusCode: res.statusCode,
            duration: `${duration}ms`,
          });
        }

        return originalEnd(chunk, encoding, callback);
      };

      next();
    });
  };
}

/**
 * Error handler middleware with context
 * @returns {Function} Error handler middleware
 */
export function errorHandlerMiddleware() {
  return (err, req, res, _next) => {
    const context = getRequestContext();
    const category = err.category || 'UNKNOWN';
    const statusCode = err.statusCode || 500;

    // End context if not already ended
    if (context && !context.endTime) {
      context.end();
    }

    // Log error with context
    if (context) {
      context.logger.error('Request failed with error', {
        error: formatError(err),
        category,
        statusCode,
      });
    } else {
      globalLogger.error('Request failed with error', {
        error: formatError(err),
        category,
        statusCode,
      });
    }

    // Format and send error response
    const errorResponse = formatErrorResponse(err, {
      hideDetails: process.env.NODE_ENV === 'production',
      includeSuggestions: process.env.NODE_ENV !== 'production',
    });

    res.status(statusCode).json(errorResponse);
  };
}

/**
 * Wrap async function with request context
 * Useful for manual context management in functions
 */
export function withRequestContext(fn, contextData = {}) {
  const context = new RequestContext(contextData);

  return async (...args) => {
    return requestContextStorage.run(context, async () => {
      try {
        return await fn(...args);
      } finally {
        context.end();
      }
    });
  };
}

/**
 * Logger with request context integration
 * Automatically includes correlation IDs in logs
 */
export function getContextLogger() {
  const context = getRequestContext();
  return context?.logger || globalLogger;
}

/**
 * Request interceptor for external API calls
 * Adds correlation headers to outgoing requests
 */
export function getCorrelationHeaders() {
  const context = getRequestContext();
  if (!context) return {};

  return {
    'X-Correlation-ID': context.correlationId,
    'X-Trace-ID': context.traceId,
    'X-Request-ID': context.requestId,
  };
}

export default {
  RequestContext,
  getRequestContext,
  requestContextMiddleware,
  errorHandlerMiddleware,
  withRequestContext,
  getContextLogger,
  getCorrelationHeaders,
};
