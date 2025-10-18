/**
 * Prometheus Metrics Exporter Service
 * 
 * Collects and exposes metrics from Phase 3B services and functions
 * Formats output in Prometheus text format for scraping
 * 
 * Usage:
 *   import { MetricsCollector, exposeMetrics } from '../services/metrics-exporter.js';
 *   
 *   const metrics = new MetricsCollector();
 *   metrics.recordFunctionExecution('create-recognition', 245, true);
 *   metrics.recordQuotaUsage('org-123', 'recognitions_per_day', 500);
 *   
 *   // Expose as Prometheus endpoint
 *   app.get('/metrics', (req, res) => {
 *     res.type('text/plain');
 *     res.send(exposeMetrics(metrics));
 *   });
 */

class MetricsCollector {
  constructor() {
    this.metrics = new Map();
    this.initializeDefaultMetrics();
  }

  initializeDefaultMetrics() {
    // Function execution metrics
    this.registerMetric('function_execution_time_ms', 'histogram', 'Function execution time in milliseconds');
    this.registerMetric('function_executions_total', 'counter', 'Total function executions');
    this.registerMetric('function_errors_total', 'counter', 'Total function errors');
    this.registerMetric('function_success_rate', 'gauge', 'Function success rate (0-100)');

    // Quota metrics
    this.registerMetric('quota_usage_percent', 'gauge', 'Organization quota usage percentage');
    this.registerMetric('quota_exceeded_total', 'counter', 'Total quota exceeded incidents');
    this.registerMetric('quota_reset_total', 'counter', 'Total quota resets');

    // Circuit breaker metrics
    this.registerMetric('circuit_breaker_state', 'gauge', 'Circuit breaker state (0=CLOSED, 1=OPEN, 2=HALF_OPEN)');
    this.registerMetric('circuit_breaker_failures_total', 'counter', 'Circuit breaker failures');
    this.registerMetric('circuit_breaker_recoveries_total', 'counter', 'Circuit breaker recoveries');

    // Background job metrics
    this.registerMetric('job_queue_depth', 'gauge', 'Current job queue depth');
    this.registerMetric('jobs_processed_total', 'counter', 'Total jobs processed');
    this.registerMetric('jobs_failed_total', 'counter', 'Total failed jobs');
    this.registerMetric('job_processing_time_ms', 'histogram', 'Job processing time');

    // Blue-green deployment metrics
    this.registerMetric('deployment_duration_seconds', 'histogram', 'Deployment duration');
    this.registerMetric('deployment_rollbacks_total', 'counter', 'Total deployment rollbacks');
    this.registerMetric('deployment_success_rate', 'gauge', 'Deployment success rate');

    // System metrics
    this.registerMetric('requests_total', 'counter', 'Total requests');
    this.registerMetric('request_duration_ms', 'histogram', 'Request duration');
    this.registerMetric('database_operations_total', 'counter', 'Database operations');
    this.registerMetric('cache_hits_total', 'counter', 'Cache hits');
    this.registerMetric('cache_misses_total', 'counter', 'Cache misses');
  }

  registerMetric(name, type, help) {
    this.metrics.set(name, {
      type,
      help,
      values: new Map(), // label_set -> value
      samples: [], // For histograms
    });
  }

  /**
   * Record function execution
   * @param {string} functionName - Function name
   * @param {number} executionTimeMs - Execution time in ms
   * @param {boolean} success - Whether execution succeeded
   */
  recordFunctionExecution(functionName, executionTimeMs, success) {
    // Record execution time histogram
    const timeMetric = this.metrics.get('function_execution_time_ms');
    if (timeMetric) {
      const label = `function="${functionName}"`;
      if (!timeMetric.samples[label]) {
        timeMetric.samples[label] = [];
      }
      timeMetric.samples[label].push(executionTimeMs);
    }

    // Record total counter
    const totalMetric = this.metrics.get('function_executions_total');
    if (totalMetric) {
      const label = `function="${functionName}"`;
      const current = totalMetric.values.get(label) || 0;
      totalMetric.values.set(label, current + 1);
    }

    // Record errors if failed
    if (!success) {
      const errorMetric = this.metrics.get('function_errors_total');
      if (errorMetric) {
        const label = `function="${functionName}"`;
        const current = errorMetric.values.get(label) || 0;
        errorMetric.values.set(label, current + 1);
      }
    }

    // Update success rate
    this.updateSuccessRate(functionName);
  }

  updateSuccessRate(functionName) {
    const totalMetric = this.metrics.get('function_executions_total');
    const errorMetric = this.metrics.get('function_errors_total');
    const rateMetric = this.metrics.get('function_success_rate');

    if (totalMetric && errorMetric && rateMetric) {
      const label = `function="${functionName}"`;
      const total = totalMetric.values.get(label) || 0;
      const errors = errorMetric.values.get(label) || 0;
      const rate = total > 0 ? Math.round(((total - errors) / total) * 100) : 100;
      rateMetric.values.set(label, rate);
    }
  }

  /**
   * Record quota usage
   * @param {string} organizationId - Organization ID
   * @param {string} quotaType - Type of quota
   * @param {number} usagePercent - Usage percentage (0-100)
   */
  recordQuotaUsage(organizationId, quotaType, usagePercent) {
    const metric = this.metrics.get('quota_usage_percent');
    if (metric) {
      const label = `org="${organizationId}",quota_type="${quotaType}"`;
      metric.values.set(label, usagePercent);
    }
  }

  recordQuotaExceeded(organizationId, quotaType) {
    const metric = this.metrics.get('quota_exceeded_total');
    if (metric) {
      const label = `org="${organizationId}",quota_type="${quotaType}"`;
      const current = metric.values.get(label) || 0;
      metric.values.set(label, current + 1);
    }
  }

  recordQuotaReset(organizationId, quotaType) {
    const metric = this.metrics.get('quota_reset_total');
    if (metric) {
      const label = `org="${organizationId}",quota_type="${quotaType}"`;
      const current = metric.values.get(label) || 0;
      metric.values.set(label, current + 1);
    }
  }

  /**
   * Record circuit breaker state
   * @param {string} serviceName - Service name
   * @param {number} state - 0=CLOSED, 1=OPEN, 2=HALF_OPEN
   */
  recordCircuitBreakerState(serviceName, state) {
    const metric = this.metrics.get('circuit_breaker_state');
    if (metric) {
      const label = `service="${serviceName}"`;
      metric.values.set(label, state);
    }
  }

  recordCircuitBreakerFailure(serviceName) {
    const metric = this.metrics.get('circuit_breaker_failures_total');
    if (metric) {
      const label = `service="${serviceName}"`;
      const current = metric.values.get(label) || 0;
      metric.values.set(label, current + 1);
    }
  }

  recordCircuitBreakerRecovery(serviceName) {
    const metric = this.metrics.get('circuit_breaker_recoveries_total');
    if (metric) {
      const label = `service="${serviceName}"`;
      const current = metric.values.get(label) || 0;
      metric.values.set(label, current + 1);
    }
  }

  /**
   * Record background job metrics
   * @param {string} jobType - Type of job
   * @param {number} queueDepth - Current queue depth
   * @param {number} processingTimeMs - Processing time
   * @param {boolean} success - Whether job succeeded
   */
  recordJobMetrics(jobType, queueDepth, processingTimeMs, success) {
    // Queue depth
    const depthMetric = this.metrics.get('job_queue_depth');
    if (depthMetric) {
      const label = `job_type="${jobType}"`;
      depthMetric.values.set(label, queueDepth);
    }

    // Processing time
    const timeMetric = this.metrics.get('job_processing_time_ms');
    if (timeMetric) {
      const label = `job_type="${jobType}"`;
      if (!timeMetric.samples[label]) {
        timeMetric.samples[label] = [];
      }
      timeMetric.samples[label].push(processingTimeMs);
    }

    // Total processed
    const totalMetric = this.metrics.get('jobs_processed_total');
    if (totalMetric) {
      const label = `job_type="${jobType}"`;
      const current = totalMetric.values.get(label) || 0;
      totalMetric.values.set(label, current + 1);
    }

    // Failed jobs
    if (!success) {
      const failedMetric = this.metrics.get('jobs_failed_total');
      if (failedMetric) {
        const label = `job_type="${jobType}"`;
        const current = failedMetric.values.get(label) || 0;
        failedMetric.values.set(label, current + 1);
      }
    }
  }

  /**
   * Record deployment metrics
   * @param {string} functionName - Function being deployed
   * @param {number} durationSeconds - Deployment duration
   * @param {boolean} success - Whether deployment succeeded
   * @param {boolean} rolledBack - Whether deployment was rolled back
   */
  recordDeploymentMetrics(functionName, durationSeconds, success, rolledBack = false) {
    // Duration
    const durationMetric = this.metrics.get('deployment_duration_seconds');
    if (durationMetric) {
      const label = `function="${functionName}"`;
      if (!durationMetric.samples[label]) {
        durationMetric.samples[label] = [];
      }
      durationMetric.samples[label].push(durationSeconds);
    }

    // Rollbacks
    if (rolledBack) {
      const rollbackMetric = this.metrics.get('deployment_rollbacks_total');
      if (rollbackMetric) {
        const label = `function="${functionName}"`;
        const current = rollbackMetric.values.get(label) || 0;
        rollbackMetric.values.set(label, current + 1);
      }
    }

    // Success rate
    this.updateDeploymentSuccessRate(functionName, success);
  }

  updateDeploymentSuccessRate(functionName, success) {
    const rateMetric = this.metrics.get('deployment_success_rate');
    if (rateMetric) {
      const label = `function="${functionName}"`;
      // Simplified: just track last success/failure
      rateMetric.values.set(label, success ? 100 : 0);
    }
  }

  /**
   * Record HTTP request metrics
   * @param {string} method - HTTP method
   * @param {string} path - Request path
   * @param {number} statusCode - HTTP status code
   * @param {number} durationMs - Request duration
   */
  recordRequest(method, path, statusCode, durationMs) {
    // Total requests
    const totalMetric = this.metrics.get('requests_total');
    if (totalMetric) {
      const label = `method="${method}",path="${path}",status="${statusCode}"`;
      const current = totalMetric.values.get(label) || 0;
      totalMetric.values.set(label, current + 1);
    }

    // Duration
    const durationMetric = this.metrics.get('request_duration_ms');
    if (durationMetric) {
      const label = `method="${method}",path="${path}"`;
      if (!durationMetric.samples[label]) {
        durationMetric.samples[label] = [];
      }
      durationMetric.samples[label].push(durationMs);
    }
  }

  recordDatabaseOperation(operation, collectionName, success) {
    const metric = this.metrics.get('database_operations_total');
    if (metric) {
      const label = `operation="${operation}",collection="${collectionName}",success="${success}"`;
      const current = metric.values.get(label) || 0;
      metric.values.set(label, current + 1);
    }
  }

  recordCacheHit() {
    const metric = this.metrics.get('cache_hits_total');
    if (metric) {
      const current = metric.values.get('') || 0;
      metric.values.set('', current + 1);
    }
  }

  recordCacheMiss() {
    const metric = this.metrics.get('cache_misses_total');
    if (metric) {
      const current = metric.values.get('') || 0;
      metric.values.set('', current + 1);
    }
  }

  /**
   * Get all metrics as object for inspection
   */
  getAllMetrics() {
    const result = {};
    for (const [name, metric] of this.metrics.entries()) {
      result[name] = {
        type: metric.type,
        help: metric.help,
        values: Object.fromEntries(metric.values),
        samples: metric.samples,
      };
    }
    return result;
  }
}

/**
 * Convert metrics to Prometheus text format
 * @param {MetricsCollector} collector - Metrics collector instance
 * @returns {string} Prometheus formatted metrics
 */
export function exposeMetrics(collector) {
  let output = '';

  for (const [name, metric] of collector.metrics.entries()) {
    // Add HELP line
    output += `# HELP ${name} ${metric.help}\n`;
    // Add TYPE line
    output += `# TYPE ${name} ${metric.type}\n`;

    // Add metric values
    if (metric.type === 'histogram') {
      // For histograms, output percentiles and count
      for (const [labels, samples] of Object.entries(metric.samples)) {
        if (samples && samples.length > 0) {
          const sorted = [...samples].sort((a, b) => a - b);
          const p50 = sorted[Math.floor(sorted.length * 0.5)];
          const p95 = sorted[Math.floor(sorted.length * 0.95)];
          const p99 = sorted[Math.floor(sorted.length * 0.99)];
          const sum = sorted.reduce((a, b) => a + b, 0);
          const count = sorted.length;

          output += `${name}_bucket{${labels},le="50"} ${p50}\n`;
          output += `${name}_bucket{${labels},le="95"} ${p95}\n`;
          output += `${name}_bucket{${labels},le="99"} ${p99}\n`;
          output += `${name}_sum{${labels}} ${sum}\n`;
          output += `${name}_count{${labels}} ${count}\n`;
        }
      }
    } else {
      // For counters and gauges, output values directly
      for (const [labels, value] of metric.values.entries()) {
        if (labels) {
          output += `${name}{${labels}} ${value}\n`;
        } else {
          output += `${name} ${value}\n`;
        }
      }
    }

    output += '\n';
  }

  return output;
}

/**
 * Global metrics collector instance
 */
let globalCollector = null;

export function getMetricsCollector() {
  if (!globalCollector) {
    globalCollector = new MetricsCollector();
  }
  return globalCollector;
}

export function resetMetrics() {
  globalCollector = new MetricsCollector();
}

export { MetricsCollector };
