/**
 * Request Logger Service
 * Provides request tracing and logging with correlation IDs
 * 
 * Features:
 * - Trace ID generation and propagation
 * - Request/response logging
 * - Correlation tracking across services
 * - Performance metrics (response time, size)
 * - Structured logging for debugging
 * - Integration with audit logger for security events
 */

import crypto from 'crypto';

/**
 * Generate unique trace ID
 * Format: timestamp-randomhash (ensures uniqueness + sortability)
 */
export function generateTraceId() {
  const timestamp = Date.now().toString(36);
  const randomPart = crypto.randomBytes(8).toString('hex');
  return `${timestamp}-${randomPart}`;
}

/**
 * Get or generate trace ID from request headers
 * Propagates trace ID across distributed calls
 */
export function getOrCreateTraceId(req) {
  return (
    req.headers['x-trace-id'] ||
    req.headers['x-request-id'] ||
    req.headers['traceparent']?.split('-')[1] ||
    generateTraceId()
  );
}

/**
 * Extract user info for logging (anonymized)
 */
function getUserInfo(req) {
  const userId = req.headers['x-appwrite-user-id'];
  const userEmail = req.headers['x-user-email'];

  return {
    userId: userId ? hashId(userId) : 'anonymous',
    email: userEmail ? hashEmail(userEmail) : null,
  };
}

/**
 * Hash user ID for privacy
 */
function hashId(id) {
  return crypto
    .createHash('sha256')
    .update(id)
    .digest('hex')
    .substring(0, 8);
}

/**
 * Hash email for privacy
 */
function hashEmail(email) {
  return crypto
    .createHash('sha256')
    .update(email)
    .digest('hex')
    .substring(0, 8);
}

/**
 * Build request log entry
 */
export function buildRequestLog(req, traceId) {
  return {
    traceId,
    method: req.method,
    path: req.path || req.url,
    ip: req.headers['x-forwarded-for'] || req.ip || 'unknown',
    userAgent: req.headers['user-agent'],
    user: getUserInfo(req),
    headers: sanitizeHeaders(req.headers),
    query: req.query || {},
    timestamp: new Date().toISOString(),
  };
}

/**
 * Build response log entry
 */
export function buildResponseLog(statusCode, responseTime, responseSize, errorMessage = null) {
  return {
    statusCode,
    responseTime: `${responseTime}ms`,
    responseSize: `${responseSize}bytes`,
    error: errorMessage,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Sanitize headers to remove sensitive data
 */
function sanitizeHeaders(headers) {
  const sanitized = { ...headers };
  const sensitiveKeys = [
    'authorization',
    'cookie',
    'x-api-key',
    'x-auth-token',
    'x-appwrite-key',
    'password',
    'secret',
  ];

  sensitiveKeys.forEach((key) => {
    Object.keys(sanitized).forEach((headerKey) => {
      if (headerKey.toLowerCase().includes(key)) {
        sanitized[headerKey] = '[REDACTED]';
      }
    });
  });

  return sanitized;
}

/**
 * Log incoming request
 */
export function logIncomingRequest(req, traceId) {
  const requestLog = buildRequestLog(req, traceId);
  
  console.log(JSON.stringify({
    type: 'REQUEST_INCOMING',
    traceId,
    method: requestLog.method,
    path: requestLog.path,
    user: requestLog.user.userId,
    timestamp: requestLog.timestamp,
    ip: requestLog.ip,
  }));

  return requestLog;
}

/**
 * Log outgoing response
 */
export function logOutgoingResponse(traceId, statusCode, responseTime, responseSize, error = null) {
  const responseLog = buildResponseLog(statusCode, responseTime, responseSize, error);
  
  console.log(JSON.stringify({
    type: 'REQUEST_COMPLETE',
    traceId,
    statusCode,
    responseTime: responseLog.responseTime,
    error: error || null,
    timestamp: responseLog.timestamp,
  }));

  return responseLog;
}

/**
 * Log function execution metrics
 */
export function logFunctionExecution(functionName, traceId, duration, success = true, error = null) {
  console.log(JSON.stringify({
    type: 'FUNCTION_EXECUTION',
    functionName,
    traceId,
    duration: `${duration}ms`,
    success,
    error: error?.message || null,
    timestamp: new Date().toISOString(),
  }));
}

/**
 * Log external API call
 */
export function logExternalCall(traceId, service, method, endpoint, statusCode, duration, error = null) {
  console.log(JSON.stringify({
    type: 'EXTERNAL_API_CALL',
    traceId,
    service,
    method,
    endpoint,
    statusCode,
    duration: `${duration}ms`,
    error: error?.message || null,
    timestamp: new Date().toISOString(),
  }));
}

/**
 * Log database operation
 */
export function logDatabaseOperation(
  traceId,
  operation,
  collection,
  documentCount = null,
  duration = null,
  error = null
) {
  console.log(JSON.stringify({
    type: 'DATABASE_OPERATION',
    traceId,
    operation,
    collection,
    documentCount,
    duration: duration ? `${duration}ms` : null,
    error: error?.message || null,
    timestamp: new Date().toISOString(),
  }));
}

/**
 * Middleware to attach trace ID to request context
 */
export function requestTracingMiddleware(req) {
  const traceId = getOrCreateTraceId(req);
  
  // Attach to request for downstream access
  req.traceId = traceId;
  
  // Log incoming request
  logIncomingRequest(req, traceId);
  
  return {
    traceId,
    startTime: Date.now(),
  };
}

/**
 * Wrap function execution with logging
 */
export async function executeWithLogging(functionName, traceId, asyncFn) {
  const startTime = Date.now();
  
  try {
    const result = await asyncFn();
    const duration = Date.now() - startTime;
    
    logFunctionExecution(functionName, traceId, duration, true);
    
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    
    logFunctionExecution(functionName, traceId, duration, false, error);
    
    throw error;
  }
}

/**
 * Wrap external API calls with logging
 */
export async function executeExternalCall(
  traceId,
  service,
  method,
  endpoint,
  asyncFn
) {
  const startTime = Date.now();
  
  try {
    const response = await asyncFn();
    const duration = Date.now() - startTime;
    
    logExternalCall(
      traceId,
      service,
      method,
      endpoint,
      response.status || 200,
      duration
    );
    
    return response;
  } catch (error) {
    const duration = Date.now() - startTime;
    
    logExternalCall(
      traceId,
      service,
      method,
      endpoint,
      error.status || 500,
      duration,
      error
    );
    
    throw error;
  }
}

/**
 * Wrap database operations with logging
 */
export async function executeDatabaseOperation(
  traceId,
  operation,
  collection,
  asyncFn
) {
  const startTime = Date.now();
  
  try {
    const result = await asyncFn();
    const duration = Date.now() - startTime;
    
    const documentCount = Array.isArray(result) ? result.length : 1;
    
    logDatabaseOperation(
      traceId,
      operation,
      collection,
      documentCount,
      duration
    );
    
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    
    logDatabaseOperation(
      traceId,
      operation,
      collection,
      null,
      duration,
      error
    );
    
    throw error;
  }
}

/**
 * Create context object to pass through function calls
 */
export function createRequestContext(req) {
  const traceId = getOrCreateTraceId(req);
  
  return {
    traceId,
    userId: req.headers['x-appwrite-user-id'] || null,
    userEmail: req.headers['x-user-email'] || null,
    correlationId: req.headers['x-correlation-id'] || traceId,
    startTime: Date.now(),
    headers: {
      'x-trace-id': traceId,
      'x-correlation-id': traceId,
    },
  };
}

export default {
  generateTraceId,
  getOrCreateTraceId,
  buildRequestLog,
  buildResponseLog,
  logIncomingRequest,
  logOutgoingResponse,
  logFunctionExecution,
  logExternalCall,
  logDatabaseOperation,
  requestTracingMiddleware,
  executeWithLogging,
  executeExternalCall,
  executeDatabaseOperation,
  createRequestContext,
};
