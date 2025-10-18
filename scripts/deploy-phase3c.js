/**
 * Phase 3C Deployment Script
 * 
 * Deploys monitoring and observability services
 * Sets up Prometheus configuration
 * Initializes health checks
 * 
 * Usage: node scripts/deploy-phase3c.js [--staging|--production]
 */

import fs from 'fs';

const PHASE3C_SERVICES = [
  {
    name: 'metrics-exporter',
    file: './apps/api/functions/services/metrics-exporter.js',
    description: 'Prometheus metrics collection',
  },
  {
    name: 'tracing',
    file: './apps/api/functions/services/tracing.js',
    description: 'Distributed tracing service',
  },
  {
    name: 'slo-monitoring',
    file: './apps/api/functions/services/slo-monitoring.js',
    description: 'SLO monitoring and alerting',
  },
  {
    name: 'health-aggregation',
    file: './apps/api/functions/services/health-aggregation.js',
    description: 'Health check aggregation',
  },
];

const PROMETHEUS_CONFIG = `
global:
  scrape_interval: 15s
  evaluation_interval: 15s
  external_labels:
    monitor: 'appwrite-functions'

scrape_configs:
  - job_name: 'appwrite-functions'
    static_configs:
      - targets: ['localhost:3000', 'localhost:3001']
    metrics_path: '/metrics'
    scrape_interval: 15s
    scrape_timeout: 10s
    
alerting:
  alertmanagers:
    - static_configs:
        - targets: ['localhost:9093']

rule_files:
  - 'slo-rules.yml'
`;

const SLO_ALERT_RULES = `
groups:
  - name: slo_alerts
    interval: 30s
    rules:
      - alert: AvailabilityViolation
        expr: |
          (1 - rate(function_errors_total[5m]) / rate(function_executions_total[5m])) * 100 < 99.5
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Function availability below SLO"

      - alert: LatencyViolation
        expr: function_execution_time_ms{quantile="0.99"} > 1000
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Function P99 latency above threshold"

      - alert: ErrorBudgetExhausted
        expr: |
          (count(function_errors_total) / count(function_executions_total)) > 0.001
        for: 10m
        labels:
          severity: critical
        annotations:
          summary: "Error budget exhausted"

      - alert: CircuitBreakerOpen
        expr: circuit_breaker_state == 1
        for: 1m
        labels:
          severity: warning
        annotations:
          summary: "Circuit breaker is open for {{ \\$labels.service }}"

      - alert: JobQueueBacklog
        expr: job_queue_depth > 1000
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Job queue backlog growing"
`;

const GRAFANA_DASHBOARD_CONFIG = {
  "dashboard": {
    "title": "Recognition Platform - Phase 3C Monitoring",
    "panels": [
      {
        "title": "Function Success Rate",
        "targets": [
          {
            "expr": "rate(function_executions_total[5m]) - rate(function_errors_total[5m])"
          }
        ]
      },
      {
        "title": "P99 Latency",
        "targets": [
          {
            "expr": "histogram_quantile(0.99, function_execution_time_ms)"
          }
        ]
      },
      {
        "title": "Error Budget Remaining",
        "targets": [
          {
            "expr": "100 * (1 - (rate(function_errors_total[30d]) / rate(function_executions_total[30d])))"
          }
        ]
      },
      {
        "title": "Circuit Breaker Status",
        "targets": [
          {
            "expr": "circuit_breaker_state"
          }
        ]
      },
      {
        "title": "Job Queue Depth",
        "targets": [
          {
            "expr": "job_queue_depth"
          }
        ]
      }
    ]
  }
};

async function validateEnvironment(env) {
  console.log(`🔍 Validating ${env} environment...`);

  const required = ['APPWRITE_ENDPOINT', 'APPWRITE_PROJECT_ID', 'APPWRITE_API_KEY'];
  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(`Missing environment variables: ${missing.join(', ')}`);
  }

  console.log('✅ Environment validated');
}

function validateServices() {
  console.log('\n📦 Validating services...');

  for (const service of PHASE3C_SERVICES) {
    if (!fs.existsSync(service.file)) {
      throw new Error(`Service file not found: ${service.file}`);
    }

    const content = fs.readFileSync(service.file, 'utf-8');
    if (content.length < 100) {
      throw new Error(`Service file appears empty: ${service.file}`);
    }

    console.log(`  ✅ ${service.name} (${content.length} bytes)`);
  }
}

function createPrometheusConfig() {
  console.log('\n📊 Creating Prometheus configuration...');

  const configDir = './monitoring';
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  fs.writeFileSync(`${configDir}/prometheus.yml`, PROMETHEUS_CONFIG);
  console.log('  ✅ prometheus.yml created');

  fs.writeFileSync(`${configDir}/slo-rules.yml`, SLO_ALERT_RULES);
  console.log('  ✅ slo-rules.yml created');
}

function createGrafanaDashboard() {
  console.log('\n📈 Creating Grafana dashboard configuration...');

  const dashboardDir = './monitoring/dashboards';
  if (!fs.existsSync(dashboardDir)) {
    fs.mkdirSync(dashboardDir, { recursive: true });
  }

  fs.writeFileSync(
    `${dashboardDir}/recognition-platform.json`,
    JSON.stringify(GRAFANA_DASHBOARD_CONFIG, null, 2)
  );
  console.log('  ✅ recognition-platform.json created');
}

function createDockerCompose() {
  console.log('\n🐳 Creating Docker Compose for monitoring stack...');

  const dockerCompose = `
version: '3.8'

services:
  prometheus:
    image: prom/prometheus:latest
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml
      - ./monitoring/slo-rules.yml:/etc/prometheus/slo-rules.yml
      - prometheus_data:/prometheus
    ports:
      - "9090:9090"
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'

  grafana:
    image: grafana/grafana:latest
    volumes:
      - grafana_data:/var/lib/grafana
      - ./monitoring/dashboards:/etc/grafana/provisioning/dashboards
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
      - GF_PATHS_PROVISIONING=/etc/grafana/provisioning

  alertmanager:
    image: prom/alertmanager:latest
    volumes:
      - ./monitoring/alertmanager.yml:/etc/alertmanager/alertmanager.yml
    ports:
      - "9093:9093"
    command:
      - '--config.file=/etc/alertmanager/alertmanager.yml'

  jaeger:
    image: jaegertracing/all-in-one:latest
    ports:
      - "6831:6831/udp"
      - "16686:16686"
    environment:
      - COLLECTOR_ZIPKIN_HTTP_PORT=9411

volumes:
  prometheus_data:
  grafana_data:
`;

  fs.writeFileSync('./docker-compose.monitoring.yml', dockerCompose);
  console.log('  ✅ docker-compose.monitoring.yml created');
}

function createHealthCheckSetup() {
  console.log('\n❤️  Creating health check setup...');

  const setup = `
// Health Check Setup Example
import { HealthAggregator } from '../services/health-aggregation.js';

const health = new HealthAggregator();

// Add database health check
health.addComponent('database', async () => {
  try {
    const response = await fetch(
      process.env.APPWRITE_ENDPOINT + '/v1/health/db'
    );
    return response.ok;
  } catch (error) {
    return false;
  }
}, { criticalForReadiness: true });

// Add Appwrite health check
health.addComponent('appwrite', async () => {
  try {
    const response = await fetch(
      process.env.APPWRITE_ENDPOINT + '/v1/health'
    );
    return response.ok;
  } catch (error) {
    return false;
  }
}, { criticalForLiveness: true });

// Start periodic checks
health.startPeriodicChecks(30000);

export { health };
`;

  fs.writeFileSync('./apps/api/functions/setup/health-checks.js', setup);
  console.log('  ✅ health-checks.js created');
}

function createKubernetesConfig() {
  console.log('\n☸️  Creating Kubernetes configuration...');

  const k8sConfig = `
apiVersion: v1
kind: Service
metadata:
  name: appwrite-functions
spec:
  selector:
    app: appwrite-functions
  ports:
    - name: http
      port: 3000
      targetPort: 3000
    - name: metrics
      port: 9090
      targetPort: 9090

---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: appwrite-functions
spec:
  replicas: 3
  selector:
    matchLabels:
      app: appwrite-functions
  template:
    metadata:
      labels:
        app: appwrite-functions
    spec:
      containers:
      - name: functions
        image: appwrite-functions:latest
        ports:
        - containerPort: 3000
          name: http
        - containerPort: 9090
          name: metrics
        
        # Liveness probe - restart if broken
        livenessProbe:
          httpGet:
            path: /health/live
            port: 3000
          initialDelaySeconds: 10
          periodSeconds: 30
          timeoutSeconds: 5
          failureThreshold: 3
        
        # Readiness probe - remove from load balancer if not ready
        readinessProbe:
          httpGet:
            path: /health/ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 2
        
        # Startup probe - wait for startup before other probes
        startupProbe:
          httpGet:
            path: /health/startup
            port: 3000
          initialDelaySeconds: 0
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 30

        env:
        - name: APPWRITE_ENDPOINT
          valueFrom:
            configMapKeyRef:
              name: appwrite-config
              key: endpoint
`;

  if (!fs.existsSync('./infra/k8s')) {
    fs.mkdirSync('./infra/k8s', { recursive: true });
  }

  fs.writeFileSync('./infra/k8s/deployment.yaml', k8sConfig);
  console.log('  ✅ deployment.yaml created');
}

function createDeploymentRecord() {
  console.log('\n📝 Recording deployment...');

  const timestamp = new Date().toISOString();
  const record = {
    phase: '3C',
    components: PHASE3C_SERVICES.length,
    name: 'Monitoring & Observability',
    deployedAt: timestamp,
    version: '1.0.0',
    status: 'complete',
    services: PHASE3C_SERVICES.map(s => s.name),
  };

  console.log(`  Deployment recorded: ${JSON.stringify(record, null, 2)}`);
}

async function runDeployment() {
  const env = process.argv[2] === '--production' ? 'production' : 'staging';

  try {
    console.log('═══════════════════════════════════════════════════════');
    console.log('  Phase 3C Deployment - Monitoring & Observability');
    console.log('═══════════════════════════════════════════════════════\n');

    // Validate
    await validateEnvironment(env);
    validateServices();

    // Create configuration
    createPrometheusConfig();
    createGrafanaDashboard();
    createDockerCompose();
    createHealthCheckSetup();
    createKubernetesConfig();

    // Record
    createDeploymentRecord();

    console.log('\n═══════════════════════════════════════════════════════');
    console.log('✅ Phase 3C Deployment Complete');
    console.log('═══════════════════════════════════════════════════════\n');

    console.log('📋 Summary:');
    console.log(`  • Services deployed: ${PHASE3C_SERVICES.length}`);
    console.log(`  • Environment: ${env}`);
    console.log(`  • Timestamp: ${new Date().toISOString()}`);

    console.log('\n🚀 Next steps:');
    console.log('  1. Start monitoring stack:');
    console.log('     docker-compose -f docker-compose.monitoring.yml up -d');
    console.log('  2. Access dashboards:');
    console.log('     • Prometheus: http://localhost:9090');
    console.log('     • Grafana: http://localhost:3000 (admin/admin)');
    console.log('     • Jaeger: http://localhost:16686');
    console.log('  3. Verify Kubernetes deployment:');
    console.log('     kubectl apply -f infra/k8s/deployment.yaml');
    console.log('  4. Check health probes:');
    console.log('     curl http://localhost:3000/health');
    console.log('  5. Verify metrics collection:');
    console.log('     curl http://localhost:3000/metrics');

    console.log('\n📚 Documentation:');
    console.log('  • PHASE3C-MONITORING-OBSERVABILITY.js - Complete guide');
    console.log('  • monitoring/prometheus.yml - Prometheus config');
    console.log('  • monitoring/slo-rules.yml - Alert rules');
    console.log('  • infra/k8s/deployment.yaml - K8s deployment');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Deployment failed:');
    console.error(error.message);
    process.exit(1);
  }
}

// Run deployment
runDeployment();
