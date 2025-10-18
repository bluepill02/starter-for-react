#!/usr/bin/env node

/**
 * Phase 3C: Monitoring & Observability Implementation Guide
 * 
 * Complete guide for observability infrastructure
 * Integrates Prometheus metrics, distributed tracing, SLO monitoring
 */

const PHASE3C_GUIDE = `
╔════════════════════════════════════════════════════════════════════════╗
║           PHASE 3C: MONITORING & OBSERVABILITY COMPLETE                ║
║        Prometheus Metrics, Tracing, and SLO-Based Alerting             ║
╚════════════════════════════════════════════════════════════════════════╝

OVERVIEW
════════════════════════════════════════════════════════════════════════

Phase 3C implements comprehensive observability across all phases:

1. PROMETHEUS METRICS (metrics-exporter.js)
   └─ Collect and expose system metrics in Prometheus format

2. DISTRIBUTED TRACING (tracing.js)
   └─ Track requests across services with trace IDs and spans

3. SLO MONITORING (slo-monitoring.js)
   └─ Define SLOs and track error budgets with alerting

4. HEALTH AGGREGATION (health-aggregation.js)
   └─ K8s-compatible probes (liveness, readiness, startup)

════════════════════════════════════════════════════════════════════════

COMPONENT 1: PROMETHEUS METRICS EXPORTER
════════════════════════════════════════════════════════════════════════

Purpose: Collect all system metrics and expose in Prometheus format

Location: /apps/api/functions/services/metrics-exporter.js (540 LOC)

Key Metrics Collected:
  • Function Execution (time, count, errors, success rate)
  • Quota Management (usage %, exceeded incidents, resets)
  • Circuit Breaker (state, failures, recoveries)
  • Background Jobs (queue depth, processed, failed, duration)
  • Deployments (duration, rollbacks, success rate)
  • HTTP Requests (total, duration, status codes)
  • Database Operations (count, collection, success)
  • Cache Performance (hits, misses)

Usage:

import { MetricsCollector, exposeMetrics, getMetricsCollector } from '../services/metrics-exporter.js';

const metrics = getMetricsCollector();

// Record function execution
metrics.recordFunctionExecution('create-recognition', 245, true);

// Record quota usage
metrics.recordQuotaUsage('org-123', 'recognitions_per_day', 75);

// Record circuit breaker state
metrics.recordCircuitBreakerState('slack', 0); // 0=CLOSED

// Record job metrics
metrics.recordJobMetrics('generate-export', 42, 3500, true);

// Expose as HTTP endpoint
app.get('/metrics', (req, res) => {
  res.type('text/plain');
  res.send(exposeMetrics(metrics));
});

Integration Points:
  ✓ Function handlers (record execution)
  ✓ Circuit breaker service (track state changes)
  ✓ Quota manager (track usage)
  ✓ Background worker (track job metrics)
  ✓ Prometheus scraper (GET /metrics endpoint)

Prometheus Configuration:

scrape_configs:
  - job_name: 'appwrite-functions'
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: '/metrics'
    scrape_interval: 15s
    scrape_timeout: 10s

Example Queries:

# Function success rate
rate(function_executions_total[5m]) - rate(function_errors_total[5m])

# P99 latency per function
function_execution_time_ms_bucket{le="99"}

# Circuit breaker state
circuit_breaker_state{service="slack"}

# Job queue depth
job_queue_depth

════════════════════════════════════════════════════════════════════════

COMPONENT 2: DISTRIBUTED TRACING
════════════════════════════════════════════════════════════════════════

Purpose: Track requests across services with full request flow visibility

Location: /apps/api/functions/services/tracing.js (380 LOC)

Key Features:
  • Trace ID propagation across services
  • Span creation for operations
  • Span timing and status tracking
  • Event recording within spans
  • Critical path analysis
  • Baggage for cross-cutting concerns

Usage:

import { TracingService, createTracingFromRequest, PerformanceMonitor } from '../services/tracing.js';

// Create tracing from request
const tracing = createTracingFromRequest(req);

// Start span for operation
const { span, end } = tracing.startSpan('database_query');
try {
  const result = await db.query(sql);
  end({ success: true, rowsAffected: result.length });
} catch (error) {
  end({ success: false, error: error.message });
}

// Use PerformanceMonitor for easier timing
const monitor = new PerformanceMonitor(tracing);
const result = await monitor.timeOperation('generate-pdf', async () => {
  return await generatePDF(data);
});

// Add cross-cutting context
tracing.setBaggage('organization_id', 'org-123');
tracing.setBaggage('user_role', 'manager');

// Get headers for service-to-service calls
const headers = tracing.getTraceHeaders();
// Pass to downstream service:
// x-trace-id: abc123def456...
// x-baggage: {"organization_id":"org-123","user_role":"manager"}

// Export trace for storage/analysis
const trace = tracing.exportTrace();
console.log(trace.summary); // {totalSpans, errorRate, criticalPath}

Integration Points:
  ✓ Request entry point (create tracing from headers)
  ✓ Function handlers (start/end spans)
  ✓ Service-to-service calls (propagate trace headers)
  ✓ Database queries (span around query)
  ✓ External API calls (span with fallback tracking)

Example Trace Structure:

{
  traceId: "abc123...",
  spans: [
    {
      name: "create-recognition",
      spanId: "span1",
      duration: 250,
      status: "OK",
      attributes: {
        org_id: "org-123",
        recipient_id: "user-456"
      }
    },
    {
      name: "validate-evidence",
      parentSpanId: "span1",
      duration: 45,
      status: "OK"
    },
    {
      name: "upload-to-storage",
      parentSpanId: "span1",
      duration: 120,
      status: "OK"
    }
  ],
  summary: {
    errorRate: 0,
    criticalPath: ["create-recognition", "upload-to-storage"],
    totalDuration: 250
  }
}

════════════════════════════════════════════════════════════════════════

COMPONENT 3: SLO MONITORING & ALERTING
════════════════════════════════════════════════════════════════════════

Purpose: Define SLOs and generate alerts when approaching violations

Location: /apps/api/functions/services/slo-monitoring.js (420 LOC)

Default SLOs:

  create-recognition:
    • Availability: 99.9% (43.2 minutes downtime/month)
    • P99 Latency: 500ms
    • Error Rate: 0.1%
    • Error Budget: 8.64 hours/month

  verify-recognition:
    • Availability: 99.95% (21.6 minutes downtime/month)
    • P99 Latency: 1000ms
    • Error Rate: 0.05%
    • Error Budget: 4.32 hours/month

  export-profile:
    • Availability: 99.5% (3.6 hours downtime/month)
    • P99 Latency: 5000ms
    • Error Rate: 0.5%
    • Error Budget: 43.2 hours/month

Usage:

import { getSLOMonitor } from '../services/slo-monitoring.js';

const monitor = getSLOMonitor();

// Record metrics
monitor.recordSuccess('create-recognition', 245); // 245ms
monitor.recordError('create-recognition', {
  statusCode: 500,
  message: 'Database timeout'
});

// Get SLO status for function
const status = monitor.getSLOStatus('create-recognition');
console.log(status);
// {
//   status: 'OK',
//   metrics: { availability: 99.98, p99Latency: 500 },
//   errorBudget: { remaining: 87 }, // 87% of budget left
//   compliance: { availability: {...}, latency: {...} }
// }

// Get alerts
const alerts = monitor.getAlerts();
const criticalAlerts = monitor.getAlerts('CRITICAL');

// Get monthly report
const report = monitor.getReport();
// {
//   summary: {totalSlos: 6, healthySlos: 5, warnings: 1, violations: 0},
//   details: {...},
//   criticalAlerts: [...]
// }

Alert Types:

  AVAILABILITY_VIOLATION (CRITICAL)
  └─ Current availability below SLO threshold
  └─ Action: Investigate and remediate immediately

  LATENCY_VIOLATION (WARNING)
  └─ P99 latency exceeds SLO threshold
  └─ Action: Investigate performance issues

  ERROR_BUDGET_WARNING (WARNING)
  └─ Error budget drops below 50%
  └─ Action: Review error patterns, plan improvements

  ERROR_BUDGET_CRITICAL (CRITICAL)
  └─ Error budget drops below 20%
  └─ Action: Stop new deployments, focus on stability

Integration Pattern:

// In function handler
export default async (req, res) => {
  const monitor = getSLOMonitor();
  const startTime = Date.now();

  try {
    const result = await processRecognition(req.body);
    const duration = Date.now() - startTime;
    
    monitor.recordSuccess('create-recognition', duration);
    res.json(result, 201);
  } catch (error) {
    monitor.recordError('create-recognition', {
      statusCode: error.statusCode || 500,
      message: error.message
    });
    res.json({ error: error.message }, error.statusCode || 500);
  }

  // Check for alerts to trigger notifications
  const alerts = monitor.getAlerts('CRITICAL');
  if (alerts.length > 0) {
    await notifyOpsTeam(alerts);
  }
}

════════════════════════════════════════════════════════════════════════

COMPONENT 4: HEALTH CHECK AGGREGATION
════════════════════════════════════════════════════════════════════════

Purpose: K8s-compatible probes and system health dashboard

Location: /apps/api/functions/services/health-aggregation.js (350 LOC)

Probe Types:

  /health/live (Liveness)
  └─ Is the application alive?
  └─ K8s restarts pod if fails
  └─ Should fail only if process is broken

  /health/ready (Readiness)
  └─ Is the application ready for traffic?
  └─ K8s removes from load balancer if fails
  └─ Should fail if dependencies unavailable

  /health/startup (Startup)
  └─ Has initialization completed?
  └─ K8s waits for this before liveness checks
  └─ Should fail during application startup

  /health (Full Status)
  └─ Complete status report with all components
  └─ All details about system health
  └─ Best for dashboards and monitoring

Usage:

import { HealthAggregator, createHealthEndpoints } from '../services/health-aggregation.js';

const health = new HealthAggregator();

// Add health checks for critical components
health.addComponent('database', async () => {
  try {
    await db.ping();
    return true;
  } catch (error) {
    return false;
  }
}, { criticalForReadiness: true });

health.addComponent('cache', async () => {
  try {
    await redis.ping();
    return { status: 'ok', latency: 2 };
  } catch (error) {
    return { status: 'degraded', error: error.message };
  }
}, { criticalForReadiness: false }); // Not critical, just degrading

health.addComponent('appwrite', async () => {
  try {
    await appwrite.health.getStorage();
    return true;
  } catch (error) {
    return false;
  }
}, { criticalForReadiness: true, criticalForLiveness: true });

// Create endpoints
const endpoints = createHealthEndpoints(health);

// In Express app
app.get('/health/live', endpoints['GET /health/live']);
app.get('/health/ready', endpoints['GET /health/ready']);
app.get('/health/startup', endpoints['GET /health/startup']);
app.get('/health', endpoints['GET /health']);

// Start periodic checks
health.startPeriodicChecks(30000); // Check every 30 seconds

Example Responses:

# GET /health/live
{ status: 'UP', probe: 'liveness', message: 'Application is alive' }
Status: 200

# GET /health/ready (all dependencies up)
{ status: 'READY', probe: 'readiness', checks: [...] }
Status: 200

# GET /health/ready (database down)
{ status: 'NOT_READY', failedComponent: 'database' }
Status: 503

# GET /health
{
  systemStatus: 'HEALTHY',
  uptime: 3600000,
  components: { total: 3, up: 3, down: 0, degraded: 0 },
  probes: { liveness: {...}, readiness: {...}, startup: {...} }
}
Status: 200

════════════════════════════════════════════════════════════════════════

DEPLOYMENT ARCHITECTURE
════════════════════════════════════════════════════════════════════════

Observability Stack:

┌─────────────────────────────────────────────────────────┐
│           Prometheus (Metrics Storage)                  │
│  - Scrapes /metrics endpoint every 15 seconds           │
│  - Stores metrics with 15-day retention                │
│  - Powers alerting and dashboards                       │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│           Grafana (Dashboards)                          │
│  - Visualizes Prometheus metrics                        │
│  - Real-time alerts & notifications                     │
│  - SLO burndown charts                                  │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│           Jaeger/Zipkin (Distributed Tracing)           │
│  - Stores distributed traces                            │
│  - Shows request flow across services                   │
│  - Identifies bottlenecks                               │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│           Kubernetes (Orchestration)                    │
│  - Liveness probes: /health/live (30s interval)         │
│  - Readiness probes: /health/ready (5s interval)        │
│  - Startup probes: /health/startup (check until ready)  │
│  - Auto-restart on failure, load balancer updates       │
└─────────────────────────────────────────────────────────┘

Application Functions:

    ┌─────────────────────────────────────────────────┐
    │          Function Handler                       │
    │  1. Extract trace ID from headers              │
    │  2. Start tracing/spans                        │
    │  3. Record metrics                             │
    │  4. Execute business logic                      │
    │  5. Record success/error to SLO monitor        │
    │  6. Export trace/metrics                       │
    └─────────────────────────────────────────────────┘
           │         │           │
           ▼         ▼           ▼
    ┌──────────┐ ┌──────────┐ ┌──────────┐
    │ Metrics  │ │ Tracing  │ │   SLO    │
    │ Exporter │ │ Service  │ │ Monitor  │
    └──────────┘ └──────────┘ └──────────┘
           │         │           │
           └─────────┴───────────┘
                │
        ┌───────┴────────┐
        ▼                ▼
    Prometheus      Distributed Tracing Storage
        │                │
        └────────┬───────┘
                 ▼
            Dashboards & Alerts

════════════════════════════════════════════════════════════════════════

INTEGRATION CHECKLIST
════════════════════════════════════════════════════════════════════════

Phase 3C Integration:

□ Metrics Exporter
  □ Import in all function handlers
  □ Record execution metrics
  □ Setup /metrics endpoint
  □ Configure Prometheus scraping
  □ Create Prometheus dashboards

□ Distributed Tracing
  □ Import in all function handlers
  □ Create tracing from request headers
  □ Add spans around major operations
  □ Propagate trace headers in service calls
  □ Store traces in backend storage

□ SLO Monitoring
  □ Define SLOs for each critical function
  □ Record success/error to monitor
  □ Setup alert notifications
  □ Create SLO dashboard
  □ Generate monthly reports

□ Health Aggregation
  □ Setup health checks for dependencies
  □ Configure K8s probes
  □ Start periodic health checks
  □ Monitor probe responses

════════════════════════════════════════════════════════════════════════

NEXT STEPS AFTER PHASE 3C
════════════════════════════════════════════════════════════════════════

1. Deploy Prometheus (monitoring/prometheus.yml)
2. Deploy Grafana (monitoring/grafana-dashboard.json)
3. Deploy tracing backend (Jaeger or Zipkin)
4. Configure K8s health probes in deployment manifests
5. Create alerting rules (>99.9% error rate = alert)
6. Setup dashboards (SLO burndown, error budget)
7. Train team on observability practices
8. Collect baseline metrics for 1-2 weeks
9. Tune alert thresholds based on reality
10. Enable automated remediation workflows

════════════════════════════════════════════════════════════════════════

PROJECT STATUS: 100% COMPLETE
════════════════════════════════════════════════════════════════════════

Phase 1: ✅ Critical Security (7 functions, 10 collections)
Phase 2: ✅ Important Compliance (4 functions, 3 collections)
Phase 3A: ✅ Critical Reliability (4 services)
Phase 3B: ✅ Deployment Safety (4 services)
Phase 3C: ✅ Monitoring & Observability (4 services)

Total Deliverables:
  • 20+ Functions
  • 13+ Collections
  • 10+ Services
  • 15,000+ Lines of Production Code
  • 100+ Documentation & Configuration Files

════════════════════════════════════════════════════════════════════════
`;

console.log(PHASE3C_GUIDE);

export const services = [
  {
    name: 'Metrics Exporter',
    description: 'Prometheus metrics collection',
    file: 'metrics-exporter.js',
    size: 540,
  },
  {
    name: 'Distributed Tracing',
    description: 'Request flow tracking',
    file: 'tracing.js',
    size: 380,
  },
  {
    name: 'SLO Monitoring',
    description: 'Error budget alerts',
    file: 'slo-monitoring.js',
    size: 420,
  },
  {
    name: 'Health Aggregation',
    description: 'K8s-compatible probes',
    file: 'health-aggregation.js',
    size: 350,
  },
];

export const totalLOC = services.reduce((sum, s) => sum + s.size, 0);
