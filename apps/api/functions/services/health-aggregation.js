/**
 * Health Check Aggregation Service
 * 
 * Combines health checks from Phase 3A with Phase 3B metrics
 * Provides comprehensive system health dashboard
 * K8s-compatible liveness, readiness, and startup probes
 * 
 * Usage:
 *   import { HealthAggregator, startHealthServer } from '../services/health-aggregation.js';
 *   
 *   const health = new HealthAggregator();
 *   health.addComponent('database', dbHealthCheck);
 *   health.addComponent('cache', cacheHealthCheck);
 *   
 *   // K8s endpoints
 *   GET /health/live    - Liveness probe
 *   GET /health/ready   - Readiness probe
 *   GET /health/startup - Startup probe
 *   GET /health/full    - Full status report
 */

const COMPONENT_STATUS = {
  UP: 'UP',
  DOWN: 'DOWN',
  DEGRADED: 'DEGRADED',
  STARTING: 'STARTING',
  STOPPING: 'STOPPING',
};

const PROBE_TYPE = {
  LIVENESS: 'liveness',
  READINESS: 'readiness',
  STARTUP: 'startup',
};

class HealthCheck {
  constructor(name, checkFn, options = {}) {
    this.name = name;
    this.checkFn = checkFn;
    this.timeout = options.timeout || 5000;
    this.criticalForReadiness = options.criticalForReadiness !== false;
    this.criticalForLiveness = options.criticalForLiveness || false;
    this.lastStatus = COMPONENT_STATUS.STARTING;
    this.lastCheck = null;
    this.lastError = null;
  }

  async run() {
    try {
      const startTime = Date.now();
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Health check timeout')), this.timeout)
      );

      const result = await Promise.race([this.checkFn(), timeoutPromise]);
      const duration = Date.now() - startTime;

      this.lastCheck = Date.now();
      this.lastError = null;

      // Determine status from result
      if (result === true) {
        this.lastStatus = COMPONENT_STATUS.UP;
      } else if (result === false) {
        this.lastStatus = COMPONENT_STATUS.DOWN;
      } else if (result.status === 'degraded') {
        this.lastStatus = COMPONENT_STATUS.DEGRADED;
      } else {
        this.lastStatus = COMPONENT_STATUS.UP;
      }

      return {
        name: this.name,
        status: this.lastStatus,
        duration,
        timestamp: this.lastCheck,
        details: result,
      };
    } catch (error) {
      this.lastStatus = COMPONENT_STATUS.DOWN;
      this.lastCheck = Date.now();
      this.lastError = error.message;

      return {
        name: this.name,
        status: COMPONENT_STATUS.DOWN,
        error: error.message,
        timestamp: this.lastCheck,
      };
    }
  }

  getStatus() {
    return {
      name: this.name,
      status: this.lastStatus,
      lastCheck: this.lastCheck,
      error: this.lastError,
    };
  }
}

class HealthAggregator {
  constructor() {
    this.components = new Map();
    this.startTime = Date.now();
    this.isReady = false;
    this.checksInterval = null;
  }

  addComponent(name, checkFn, options = {}) {
    const check = new HealthCheck(name, checkFn, options);
    this.components.set(name, check);
    return this;
  }

  async runAllChecks() {
    const results = [];
    for (const check of this.components.values()) {
      const result = await check.run();
      results.push(result);
    }
    return results;
  }

  /**
   * Liveness Probe: Is the application alive and responding?
   * K8s restarts pod if this fails
   */
  async getLivenessStatus() {
    const criticalChecks = Array.from(this.components.values())
      .filter(c => c.criticalForLiveness);

    if (criticalChecks.length === 0) {
      // All checks pass if no critical ones
      return {
        status: 'UP',
        probe: PROBE_TYPE.LIVENESS,
        message: 'Application is alive',
        timestamp: Date.now(),
      };
    }

    for (const check of criticalChecks) {
      if (check.lastStatus === COMPONENT_STATUS.DOWN) {
        return {
          status: 'DOWN',
          probe: PROBE_TYPE.LIVENESS,
          message: `Critical component down: ${check.name}`,
          failedComponent: check.name,
          timestamp: Date.now(),
        };
      }
    }

    return {
      status: 'UP',
      probe: PROBE_TYPE.LIVENESS,
      message: 'Application is alive',
      timestamp: Date.now(),
    };
  }

  /**
   * Readiness Probe: Is the application ready to accept traffic?
   * K8s removes pod from load balancer if this fails
   */
  async getReadinessStatus() {
    const results = [];

    for (const check of this.components.values()) {
      if (!check.criticalForReadiness) continue;

      const status = check.getStatus();

      if (status.status === COMPONENT_STATUS.DOWN) {
        return {
          status: 'NOT_READY',
          probe: PROBE_TYPE.READINESS,
          message: `Service not ready - ${check.name} is down`,
          failedComponent: check.name,
          failedChecks: results.filter(r => r.status === COMPONENT_STATUS.DOWN),
          timestamp: Date.now(),
        };
      }

      results.push(status);
    }

    const readyTime = Date.now() - this.startTime;

    return {
      status: 'READY',
      probe: PROBE_TYPE.READINESS,
      message: 'Application is ready to accept traffic',
      uptime: readyTime,
      checks: results,
      timestamp: Date.now(),
    };
  }

  /**
   * Startup Probe: Has the application finished initializing?
   * K8s waits for this before running liveness checks
   */
  async getStartupStatus() {
    const uptime = Date.now() - this.startTime;
    const minStartupTime = 5000; // 5 seconds minimum

    if (uptime < minStartupTime) {
      return {
        status: 'STARTING',
        probe: PROBE_TYPE.STARTUP,
        message: 'Application is starting up',
        uptime,
        progress: Math.round((uptime / minStartupTime) * 100),
        timestamp: Date.now(),
      };
    }

    // Run readiness check as part of startup
    const readinessStatus = await this.getReadinessStatus();

    if (readinessStatus.status === 'NOT_READY') {
      return {
        status: 'STARTING',
        probe: PROBE_TYPE.STARTUP,
        message: 'Application is starting, waiting for dependencies',
        uptime,
        failedComponent: readinessStatus.failedComponent,
        timestamp: Date.now(),
      };
    }

    this.isReady = true;

    return {
      status: 'READY',
      probe: PROBE_TYPE.STARTUP,
      message: 'Application startup complete',
      uptime,
      timestamp: Date.now(),
    };
  }

  /**
   * Full Status Report: All components detailed
   */
  async getFullStatus() {
    const results = await this.runAllChecks();
    const liveness = await this.getLivenessStatus();
    const readiness = await this.getReadinessStatus();
    const startup = await this.getStartupStatus();

    const upStatus = results.filter(r => r.status === COMPONENT_STATUS.UP).length;
    const downStatus = results.filter(r => r.status === COMPONENT_STATUS.DOWN).length;
    const degradedStatus = results.filter(r => r.status === COMPONENT_STATUS.DEGRADED).length;

    return {
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.startTime,
      systemStatus: this.getOverallStatus(liveness, readiness),
      probes: {
        liveness,
        readiness,
        startup,
      },
      components: {
        total: results.length,
        up: upStatus,
        down: downStatus,
        degraded: degradedStatus,
        details: results,
      },
      metrics: {
        serviceUptime: Date.now() - this.startTime,
        lastCheck: Date.now(),
      },
    };
  }

  getOverallStatus(liveness, readiness) {
    if (liveness.status === 'DOWN') return 'CRITICAL';
    if (readiness.status === 'NOT_READY') return 'DEGRADED';
    return 'HEALTHY';
  }

  /**
   * Start periodic health checks
   */
  startPeriodicChecks(intervalMs = 30000) {
    if (this.checksInterval) {
      clearInterval(this.checksInterval);
    }

    this.checksInterval = setInterval(async () => {
      await this.runAllChecks();
    }, intervalMs);

    // Run initial check
    this.runAllChecks();
  }

  stopPeriodicChecks() {
    if (this.checksInterval) {
      clearInterval(this.checksInterval);
      this.checksInterval = null;
    }
  }

  /**
   * Get minimal status for fast endpoint (K8s probes)
   */
  getQuickStatus() {
    const liveness = this.components.values().some(c => 
      c.criticalForLiveness && c.lastStatus === COMPONENT_STATUS.DOWN
    );

    return {
      alive: !liveness,
      ready: this.isReady,
      uptime: Date.now() - this.startTime,
    };
  }
}

/**
 * Express-like middleware for health endpoints
 */
export function createHealthEndpoints(aggregator) {
  return {
    'GET /health/live': async (req, res) => {
      const status = await aggregator.getLivenessStatus();
      const statusCode = status.status === 'UP' ? 200 : 503;
      res.status(statusCode).json(status);
    },

    'GET /health/ready': async (req, res) => {
      const status = await aggregator.getReadinessStatus();
      const statusCode = status.status === 'READY' ? 200 : 503;
      res.status(statusCode).json(status);
    },

    'GET /health/startup': async (req, res) => {
      const status = await aggregator.getStartupStatus();
      const statusCode = status.status === 'READY' ? 200 : 503;
      res.status(statusCode).json(status);
    },

    'GET /health': async (req, res) => {
      const status = await aggregator.getFullStatus();
      const statusCode = status.systemStatus === 'HEALTHY' ? 200 : 503;
      res.status(statusCode).json(status);
    },

    'GET /health/quick': (req, res) => {
      const status = aggregator.getQuickStatus();
      res.status(status.alive ? 200 : 503).json(status);
    },
  };
}

/**
 * Global health aggregator
 */
let globalAggregator = null;

export function getHealthAggregator() {
  if (!globalAggregator) {
    globalAggregator = new HealthAggregator();
  }
  return globalAggregator;
}

export { HealthAggregator, HealthCheck, COMPONENT_STATUS, PROBE_TYPE };
