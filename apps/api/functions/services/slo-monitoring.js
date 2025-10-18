/**
 * SLO Monitoring & Alerting Service
 * 
 * Defines Service Level Objectives and tracks error budgets
 * Generates alerts when approaching SLO violations
 * Calculates availability metrics
 * 
 * Usage:
 *   import { SLOMonitor, DEFAULT_SLOS } from '../services/slo-monitoring.js';
 *   
 *   const monitor = new SLOMonitor();
 *   monitor.recordSuccess('create-recognition', 245);
 *   monitor.recordError('create-recognition', { statusCode: 500 });
 *   
 *   const alerts = monitor.getAlerts();
 *   const health = monitor.getSLOStatus();
 */

const DEFAULT_SLOS = {
  'create-recognition': {
    name: 'Create Recognition',
    availability: 99.9, // 99.9% uptime
    latency_p99: 500, // 500ms
    errorRate: 0.001, // 0.1%
    errorBudgetMs: 8640000, // ~2.4 hours per month
  },
  'verify-recognition': {
    name: 'Verify Recognition',
    availability: 99.95,
    latency_p99: 1000,
    errorRate: 0.0005,
    errorBudgetMs: 4320000, // ~1.2 hours per month
  },
  'export-profile': {
    name: 'Export Profile',
    availability: 99.5,
    latency_p99: 5000,
    errorRate: 0.005,
    errorBudgetMs: 43200000, // ~12 hours per month
  },
  'create-shareable-link': {
    name: 'Create Shareable Link',
    availability: 99.95,
    latency_p99: 200,
    errorRate: 0.0005,
    errorBudgetMs: 4320000,
  },
  'delete-recognition': {
    name: 'Delete Recognition',
    availability: 99.9,
    latency_p99: 300,
    errorRate: 0.001,
    errorBudgetMs: 8640000,
  },
  'get-audit-export': {
    name: 'Get Audit Export',
    availability: 99.5,
    latency_p99: 3000,
    errorRate: 0.005,
    errorBudgetMs: 43200000,
  },
};

class SLOMetrics {
  constructor(sloDefinition) {
    this.definition = sloDefinition;
    this.successCount = 0;
    this.errorCount = 0;
    this.latencies = [];
    this.errors = [];
    this.windowStart = Date.now();
  }

  recordSuccess(latencyMs) {
    this.successCount++;
    this.latencies.push(latencyMs);
  }

  recordError(error) {
    this.errorCount++;
    this.errors.push({
      timestamp: Date.now(),
      statusCode: error.statusCode,
      message: error.message,
    });
  }

  getTotalRequests() {
    return this.successCount + this.errorCount;
  }

  getErrorRate() {
    const total = this.getTotalRequests();
    return total === 0 ? 0 : this.errorCount / total;
  }

  getAvailability() {
    const total = this.getTotalRequests();
    if (total === 0) return 100;
    return ((this.successCount / total) * 100);
  }

  getLatencyPercentile(percentile) {
    if (this.latencies.length === 0) return 0;
    const sorted = [...this.latencies].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  getP99Latency() {
    return this.getLatencyPercentile(99);
  }

  getP95Latency() {
    return this.getLatencyPercentile(95);
  }

  getP50Latency() {
    return this.getLatencyPercentile(50);
  }

  resetWindow() {
    this.windowStart = Date.now();
    this.successCount = 0;
    this.errorCount = 0;
    this.latencies = [];
    this.errors = [];
  }

  getMetrics() {
    return {
      totalRequests: this.getTotalRequests(),
      successCount: this.successCount,
      errorCount: this.errorCount,
      errorRate: this.getErrorRate(),
      availability: this.getAvailability(),
      p99Latency: this.getP99Latency(),
      p95Latency: this.getP95Latency(),
      p50Latency: this.getP50Latency(),
      recentErrors: this.errors.slice(-5),
    };
  }
}

class SLOMonitor {
  constructor(customSlos = null) {
    this.slos = customSlos || { ...DEFAULT_SLOS };
    this.metrics = new Map();
    this.alerts = [];
    this.monthStart = this.getMonthStart();
    this.errorBudgetUsed = new Map();

    // Initialize tracking for each SLO
    for (const [key, slo] of Object.entries(this.slos)) {
      this.metrics.set(key, new SLOMetrics(slo));
      this.errorBudgetUsed.set(key, 0);
    }
  }

  recordSuccess(functionName, latencyMs) {
    const metrics = this.metrics.get(functionName);
    if (metrics) {
      metrics.recordSuccess(latencyMs);
      this.checkSLOCompliance(functionName);
    }
  }

  recordError(functionName, error) {
    const metrics = this.metrics.get(functionName);
    if (metrics) {
      metrics.recordError(error);
      this.errorBudgetUsed.set(
        functionName,
        (this.errorBudgetUsed.get(functionName) || 0) + 1
      );
      this.checkSLOCompliance(functionName);
    }
  }

  checkSLOCompliance(functionName) {
    const slo = this.slos[functionName];
    const metrics = this.metrics.get(functionName);

    if (!slo || !metrics) return;

    const currentMetrics = metrics.getMetrics();

    // Check availability
    if (currentMetrics.availability < slo.availability) {
      this.addAlert({
        severity: 'CRITICAL',
        functionName,
        type: 'availability',
        message: `Availability ${currentMetrics.availability.toFixed(2)}% below SLO ${slo.availability}%`,
        threshold: slo.availability,
        current: currentMetrics.availability,
      });
    } else if (currentMetrics.availability < slo.availability + 0.5) {
      this.addAlert({
        severity: 'WARNING',
        functionName,
        type: 'availability',
        message: `Availability approaching SLO threshold`,
        threshold: slo.availability,
        current: currentMetrics.availability,
      });
    }

    // Check P99 latency
    if (currentMetrics.p99Latency > slo.latency_p99) {
      this.addAlert({
        severity: 'WARNING',
        functionName,
        type: 'latency',
        message: `P99 latency ${currentMetrics.p99Latency}ms exceeds SLO ${slo.latency_p99}ms`,
        threshold: slo.latency_p99,
        current: currentMetrics.p99Latency,
      });
    }

    // Check error budget
    const budgetRemaining = this.getErrorBudgetRemaining(functionName);
    if (budgetRemaining < 0.2) {
      this.addAlert({
        severity: 'CRITICAL',
        functionName,
        type: 'error_budget',
        message: `Error budget exhausted (${(budgetRemaining * 100).toFixed(1)}% remaining)`,
        threshold: 1.0,
        current: 1 - budgetRemaining,
      });
    } else if (budgetRemaining < 0.5) {
      this.addAlert({
        severity: 'WARNING',
        functionName,
        type: 'error_budget',
        message: `Error budget low (${(budgetRemaining * 100).toFixed(1)}% remaining)`,
        threshold: 0.5,
        current: 1 - budgetRemaining,
      });
    }
  }

  addAlert(alert) {
    // Deduplicate alerts
    const exists = this.alerts.some(a =>
      a.functionName === alert.functionName &&
      a.type === alert.type &&
      a.severity === alert.severity
    );

    if (!exists) {
      this.alerts.push({
        ...alert,
        timestamp: Date.now(),
        id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      });
    }
  }

  getErrorBudgetRemaining(functionName) {
    const slo = this.slos[functionName];
    const metrics = this.metrics.get(functionName);

    if (!slo || !metrics) return 0;

    const totalRequests = metrics.getTotalRequests();
    const allowedErrors = totalRequests * slo.errorRate;
    const actualErrors = metrics.errorCount;

    return Math.max(0, (allowedErrors - actualErrors) / Math.max(1, allowedErrors));
  }

  getErrorBudgetPercentage(functionName) {
    return Math.round(this.getErrorBudgetRemaining(functionName) * 100);
  }

  getSLOStatus(functionName = null) {
    if (functionName) {
      return this.getSLOStatusForFunction(functionName);
    }

    // Return status for all functions
    const status = {};
    for (const fn of this.slos.keys()) {
      status[fn] = this.getSLOStatusForFunction(fn);
    }
    return status;
  }

  getSLOStatusForFunction(functionName) {
    const slo = this.slos[functionName];
    const metrics = this.metrics.get(functionName);

    if (!slo || !metrics) return null;

    const currentMetrics = metrics.getMetrics();
    const budgetRemaining = this.getErrorBudgetRemaining(functionName);
    const budgetPercentage = Math.round(budgetRemaining * 100);

    const status = currentMetrics.availability >= slo.availability ? 'OK' : 'VIOLATED';

    return {
      functionName,
      sloName: slo.name,
      status,
      metrics: currentMetrics,
      slo: {
        availability: slo.availability,
        latency_p99: slo.latency_p99,
        errorRate: slo.errorRate,
      },
      errorBudget: {
        remaining: budgetPercentage,
        status: budgetPercentage > 50 ? 'HEALTHY' : budgetPercentage > 20 ? 'WARNING' : 'CRITICAL',
      },
      compliance: {
        availability: {
          current: currentMetrics.availability.toFixed(2),
          target: slo.availability,
          compliant: currentMetrics.availability >= slo.availability,
        },
        latency: {
          current: currentMetrics.p99Latency,
          target: slo.latency_p99,
          compliant: currentMetrics.p99Latency <= slo.latency_p99,
        },
        errorRate: {
          current: (currentMetrics.errorRate * 100).toFixed(3),
          target: (slo.errorRate * 100).toFixed(3),
          compliant: currentMetrics.errorRate <= slo.errorRate,
        },
      },
    };
  }

  getAlerts(severity = null) {
    if (severity) {
      return this.alerts.filter(a => a.severity === severity);
    }
    return this.alerts;
  }

  clearAlerts() {
    this.alerts = [];
  }

  clearAlertsForFunction(functionName) {
    this.alerts = this.alerts.filter(a => a.functionName !== functionName);
  }

  getMonthStart() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }

  resetMonthlyMetrics() {
    const newMonthStart = this.getMonthStart();
    if (newMonthStart > this.monthStart) {
      this.monthStart = newMonthStart;
      this.errorBudgetUsed.clear();
      for (const [key] of Object.entries(this.slos)) {
        this.errorBudgetUsed.set(key, 0);
      }
    }
  }

  getReport() {
    this.resetMonthlyMetrics();

    const allStatus = this.getSLOStatus();
    const violatedSlos = [];
    const warningSlos = [];
    const healthySlos = [];

    for (const status of Object.values(allStatus)) {
      if (status.status === 'VIOLATED') {
        violatedSlos.push({
          functionName: status.sloName,
          availability: status.metrics.availability.toFixed(2),
          target: status.slo.availability,
        });
      } else if (status.errorBudget.status === 'WARNING') {
        warningSlos.push({
          functionName: status.sloName,
          budgetRemaining: status.errorBudget.remaining,
        });
      } else {
        healthySlos.push({
          functionName: status.sloName,
          availability: status.metrics.availability.toFixed(2),
          budgetRemaining: status.errorBudget.remaining,
        });
      }
    }

    return {
      timestamp: new Date().toISOString(),
      monthStart: this.monthStart.toISOString(),
      summary: {
        totalSlos: Object.keys(this.slos).length,
        healthySlos: healthySlos.length,
        warningSlos: warningSlos.length,
        violatedSlos: violatedSlos.length,
      },
      details: {
        healthy: healthySlos,
        warnings: warningSlos,
        violations: violatedSlos,
      },
      alerts: {
        total: this.alerts.length,
        critical: this.alerts.filter(a => a.severity === 'CRITICAL').length,
        warnings: this.alerts.filter(a => a.severity === 'WARNING').length,
      },
      criticalAlerts: this.alerts
        .filter(a => a.severity === 'CRITICAL')
        .slice(0, 5),
    };
  }

  /**
   * Export for monitoring/dashboard
   */
  export() {
    return {
      slos: this.slos,
      status: this.getSLOStatus(),
      alerts: this.getAlerts(),
      report: this.getReport(),
    };
  }
}

export { SLOMonitor, SLOMetrics, DEFAULT_SLOS };

/**
 * Global SLO monitor instance
 */
let globalMonitor = null;

export function getSLOMonitor(customSlos = null) {
  if (!globalMonitor) {
    globalMonitor = new SLOMonitor(customSlos);
  }
  return globalMonitor;
}

export function resetSLOMonitor() {
  globalMonitor = null;
}
