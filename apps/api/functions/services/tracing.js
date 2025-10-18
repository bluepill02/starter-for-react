/**
 * Distributed Tracing Service
 * 
 * Tracks requests across services using trace IDs
 * Creates spans for major operations
 * Integrates with request logger from Phase 3A
 * 
 * Usage:
 *   import { TracingService, createSpan, propagateTraceContext } from '../services/tracing.js';
 *   
 *   // Initialize tracing for request
 *   const tracing = new TracingService(req.headers['x-trace-id']);
 *   
 *   // Create span for operation
 *   const span = tracing.startSpan('database_query');
 *   try {
 *     const result = await db.query(sql);
 *     span.end({ success: true, rowsAffected: result.length });
 *   } catch (error) {
 *     span.end({ success: false, error: error.message });
 *   }
 *   
 *   // Export tracing data
 *   const trace = tracing.exportTrace();
 */

class Span {
  constructor(name, traceId, parentSpanId = null) {
    this.name = name;
    this.spanId = generateSpanId();
    this.traceId = traceId;
    this.parentSpanId = parentSpanId;
    this.startTime = Date.now();
    this.endTime = null;
    this.duration = null;
    this.status = 'PENDING';
    this.attributes = {};
    this.events = [];
  }

  addAttribute(key, value) {
    this.attributes[key] = value;
    return this;
  }

  addEvent(name, attributes = {}) {
    this.events.push({
      name,
      timestamp: Date.now(),
      attributes,
    });
    return this;
  }

  end(attributes = {}) {
    this.endTime = Date.now();
    this.duration = this.endTime - this.startTime;

    // Add end attributes
    Object.assign(this.attributes, attributes);

    // Determine status from attributes
    if (attributes.success === false) {
      this.status = 'ERROR';
    } else if (attributes.success === true) {
      this.status = 'OK';
    }

    return this;
  }

  toJSON() {
    return {
      traceId: this.traceId,
      spanId: this.spanId,
      parentSpanId: this.parentSpanId,
      name: this.name,
      startTime: this.startTime,
      endTime: this.endTime,
      duration: this.duration,
      status: this.status,
      attributes: this.attributes,
      events: this.events,
    };
  }
}

class TracingService {
  constructor(traceId = null) {
    this.traceId = traceId || generateTraceId();
    this.rootStartTime = Date.now();
    this.spans = [];
    this.currentSpan = null;
    this.baggage = {}; // Cross-cutting context
  }

  startSpan(name, parentSpanId = null) {
    const span = new Span(name, this.traceId, parentSpanId || this.currentSpan?.spanId);
    this.spans.push(span);

    const previousSpan = this.currentSpan;
    this.currentSpan = span;

    return {
      span,
      end: (attributes) => {
        span.end(attributes);
        this.currentSpan = previousSpan;
        return span;
      },
    };
  }

  /**
   * Record span without nesting
   */
  recordSpan(name, attributes = {}, duration = 0) {
    const span = new Span(name, this.traceId);
    span.startTime = Date.now() - duration;
    span.endTime = Date.now();
    span.duration = duration;
    span.addAttribute('manual_record', true);
    Object.assign(span.attributes, attributes);
    this.spans.push(span);
    return span;
  }

  /**
   * Add baggage for cross-service propagation
   */
  setBaggage(key, value) {
    this.baggage[key] = value;
    return this;
  }

  getBaggage(key) {
    return this.baggage[key];
  }

  /**
   * Get trace ID for propagation to other services
   */
  getTraceId() {
    return this.traceId;
  }

  /**
   * Get headers for propagating trace context
   */
  getTraceHeaders() {
    return {
      'x-trace-id': this.traceId,
      'x-baggage': JSON.stringify(this.baggage),
    };
  }

  /**
   * Export trace for storage/analysis
   */
  exportTrace() {
    const rootDuration = Date.now() - this.rootStartTime;

    return {
      traceId: this.traceId,
      startTime: this.rootStartTime,
      duration: rootDuration,
      spanCount: this.spans.length,
      spans: this.spans.map(s => s.toJSON()),
      baggage: this.baggage,
      summary: this.generateSummary(),
    };
  }

  generateSummary() {
    const errorSpans = this.spans.filter(s => s.status === 'ERROR');
    const successSpans = this.spans.filter(s => s.status === 'OK');
    const totalDuration = this.spans.reduce((sum, s) => sum + (s.duration || 0), 0);

    return {
      totalSpans: this.spans.length,
      successSpans: successSpans.length,
      errorSpans: errorSpans.length,
      totalDuration,
      errorRate: this.spans.length > 0 ? errorSpans.length / this.spans.length : 0,
      criticalPath: this.findCriticalPath(),
    };
  }

  findCriticalPath() {
    // Find the longest sequential path through spans
    if (this.spans.length === 0) return [];

    const rootSpans = this.spans.filter(s => !s.parentSpanId);
    const paths = [];

    for (const root of rootSpans) {
      const path = this.buildPath(root);
      paths.push(path);
    }

    return paths.sort((a, b) => b.duration - a.duration)[0] || [];
  }

  buildPath(span, path = []) {
    path.push({
      name: span.name,
      duration: span.duration,
      spanId: span.spanId,
    });

    const children = this.spans.filter(s => s.parentSpanId === span.spanId);
    for (const child of children) {
      this.buildPath(child, path);
    }

    return path;
  }

  /**
   * Find slowest span
   */
  getSlowestSpan() {
    return this.spans.reduce((slowest, span) => 
      (span.duration || 0) > (slowest.duration || 0) ? span : slowest
    );
  }

  /**
   * Find spans by name
   */
  findSpans(name) {
    return this.spans.filter(s => s.name === name);
  }

  /**
   * Get trace tree structure
   */
  getTraceTree() {
    const rootSpans = this.spans.filter(s => !s.parentSpanId);
    return rootSpans.map(root => this.buildTree(root));
  }

  buildTree(span, depth = 0) {
    const children = this.spans.filter(s => s.parentSpanId === span.spanId);
    return {
      ...span.toJSON(),
      children: children.map(child => this.buildTree(child, depth + 1)),
      depth,
    };
  }
}

/**
 * Generate unique trace ID
 */
function generateTraceId() {
  const timestamp = Date.now().toString(16);
  const random = Math.random().toString(16).substring(2, 10);
  return `${timestamp}${random}`;
}

/**
 * Generate unique span ID
 */
function generateSpanId() {
  return Math.random().toString(16).substring(2, 10);
}

/**
 * Extract trace context from headers
 */
export function extractTraceContext(headers) {
  const traceId = headers['x-trace-id'];
  const baggage = headers['x-baggage'] ? JSON.parse(headers['x-baggage']) : {};

  return { traceId, baggage };
}

/**
 * Create tracing service from request headers
 */
export function createTracingFromRequest(req) {
  const { traceId, baggage } = extractTraceContext(req.headers || {});
  const tracing = new TracingService(traceId);

  for (const [key, value] of Object.entries(baggage)) {
    tracing.setBaggage(key, value);
  }

  return tracing;
}

/**
 * Global tracing instances (one per request)
 */
const tracingInstances = new Map();

export function getTracing(traceId) {
  if (!tracingInstances.has(traceId)) {
    tracingInstances.set(traceId, new TracingService(traceId));
  }
  return tracingInstances.get(traceId);
}

export function cleanupTracing(traceId) {
  tracingInstances.delete(traceId);
}

export function getAllTracings() {
  return Array.from(tracingInstances.values());
}

/**
 * Trace span middleware for Express-like functions
 */
export function traceSpanMiddleware(spanName) {
  return async (req, res, next) => {
    const tracing = createTracingFromRequest(req);
    const { end } = tracing.startSpan(spanName);

    // Store tracing in request for use in handlers
    req.tracing = tracing;

    // Add trace ID to response headers
    res.set('x-trace-id', tracing.getTraceId());

    // Intercept response to end span
    const originalSend = res.send || res.json;
    res.send = function(data) {
      const statusCode = res.statusCode || 200;
      end({
        success: statusCode >= 200 && statusCode < 300,
        statusCode,
      });

      // Export trace
      const trace = tracing.exportTrace();
      console.log(`[TRACE] ${trace.traceId}`, trace.summary);

      return originalSend.call(this, data);
    };

    if (next) next();
  };
}

/**
 * Performance monitoring utilities
 */
export class PerformanceMonitor {
  constructor(tracing) {
    this.tracing = tracing;
  }

  async timeOperation(name, fn) {
    const { end } = this.tracing.startSpan(name);
    try {
      const result = await fn();
      end({ success: true });
      return result;
    } catch (error) {
      end({ success: false, error: error.message });
      throw error;
    }
  }

  measureSync(name, fn) {
    const start = Date.now();
    try {
      const result = fn();
      const duration = Date.now() - start;
      this.tracing.recordSpan(name, { success: true }, duration);
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      this.tracing.recordSpan(name, { success: false, error: error.message }, duration);
      throw error;
    }
  }
}

export { TracingService, Span };
