/**
 * Circuit Breaker Pattern
 * Prevents cascading failures in external service calls
 *
 * Features:
 * - Three-state circuit (CLOSED, OPEN, HALF_OPEN)
 * - Automatic failure counting
 * - Exponential backoff retry
 * - Configurable thresholds
 * - State tracking and metrics
 * - Service health monitoring
 */

/**
 * Circuit Breaker States
 */
const CircuitState = {
  CLOSED: 'CLOSED', // Normal operation
  OPEN: 'OPEN', // Failures exceeded, reject requests
  HALF_OPEN: 'HALF_OPEN', // Testing if service recovered
};

/**
 * Circuit Breaker Implementation
 */
export class CircuitBreaker {
  constructor(options = {}) {
    this.name = options.name || 'default';
    this.failureThreshold = options.failureThreshold || 5;
    this.successThreshold = options.successThreshold || 2;
    this.timeout = options.timeout || 60000; // 1 minute
    this.backoffMultiplier = options.backoffMultiplier || 2;

    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
    this.nextAttemptTime = null;

    this.metrics = {
      totalRequests: 0,
      totalFailures: 0,
      totalSuccesses: 0,
      stateChanges: [],
      lastStateChange: new Date().toISOString(),
    };
  }

  /**
   * Call the protected service
   */
  async call(asyncFn, fallbackFn = null) {
    this.metrics.totalRequests++;

    // If circuit is open, reject immediately or use fallback
    if (this.state === CircuitState.OPEN) {
      if (this.shouldAttemptReset()) {
        this.setState(CircuitState.HALF_OPEN);
      } else if (fallbackFn) {
        console.warn(
          `Circuit breaker ${this.name} is OPEN, using fallback`
        );
        return fallbackFn();
      } else {
        throw new Error(
          `Circuit breaker ${this.name} is OPEN, service unavailable`
        );
      }
    }

    try {
      const result = await asyncFn();

      this.onSuccess();

      return result;
    } catch (error) {
      this.onFailure();

      if (fallbackFn) {
        console.warn(
          `Circuit breaker ${this.name} failed, using fallback: ${error.message}`
        );
        return fallbackFn();
      }

      throw error;
    }
  }

  /**
   * Handle successful call
   */
  onSuccess() {
    this.failureCount = 0;
    this.metrics.totalSuccesses++;

    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;

      if (this.successCount >= this.successThreshold) {
        this.setState(CircuitState.CLOSED);
      }
    }
  }

  /**
   * Handle failed call
   */
  onFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    this.metrics.totalFailures++;

    if (this.failureCount >= this.failureThreshold) {
      this.setState(CircuitState.OPEN);
    }
  }

  /**
   * Check if enough time has passed to attempt reset
   */
  shouldAttemptReset() {
    if (!this.lastFailureTime) return true;

    const timeSinceLastFailure = Date.now() - this.lastFailureTime;
    const backoffTime = this.timeout * Math.pow(this.backoffMultiplier, this.failureCount);

    return timeSinceLastFailure >= backoffTime;
  }

  /**
   * Change circuit state
   */
  setState(newState) {
    if (this.state === newState) return;

    const oldState = this.state;
    this.state = newState;

    // Reset counters based on new state
    if (newState === CircuitState.CLOSED) {
      this.failureCount = 0;
      this.successCount = 0;
    } else if (newState === CircuitState.HALF_OPEN) {
      this.successCount = 0;
    }

    // Record state change
    this.metrics.stateChanges.push({
      from: oldState,
      to: newState,
      timestamp: new Date().toISOString(),
      failureCount: this.failureCount,
    });

    this.metrics.lastStateChange = new Date().toISOString();

    console.log(
      `[CircuitBreaker: ${this.name}] State changed: ${oldState} → ${newState}`
    );
  }

  /**
   * Get circuit breaker status
   */
  getStatus() {
    return {
      name: this.name,
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      metrics: this.metrics,
      config: {
        failureThreshold: this.failureThreshold,
        successThreshold: this.successThreshold,
        timeout: this.timeout,
      },
    };
  }

  /**
   * Reset circuit breaker manually
   */
  reset() {
    this.setState(CircuitState.CLOSED);
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;

    console.log(`[CircuitBreaker: ${this.name}] Manually reset`);
  }

  /**
   * Get metrics
   */
  getMetrics() {
    const successRate =
      this.metrics.totalRequests > 0
        ? (this.metrics.totalSuccesses / this.metrics.totalRequests) * 100
        : 100;

    return {
      ...this.metrics,
      successRate: `${successRate.toFixed(2)}%`,
      state: this.state,
    };
  }
}

/**
 * Circuit Breaker Registry
 * Manages multiple circuit breakers
 */
export class CircuitBreakerRegistry {
  constructor() {
    this.breakers = new Map();
  }

  /**
   * Register or get circuit breaker
   */
  register(name, options) {
    if (!this.breakers.has(name)) {
      this.breakers.set(name, new CircuitBreaker({ ...options, name }));
    }

    return this.breakers.get(name);
  }

  /**
   * Get circuit breaker by name
   */
  get(name) {
    return this.breakers.get(name);
  }

  /**
   * Get all breakers status
   */
  getAllStatus() {
    const status = {};

    for (const [name, breaker] of this.breakers) {
      status[name] = breaker.getStatus();
    }

    return status;
  }

  /**
   * Reset all circuit breakers
   */
  resetAll() {
    for (const breaker of this.breakers.values()) {
      breaker.reset();
    }
  }

  /**
   * Get health of all breakers
   */
  getHealth() {
    const breakers = Array.from(this.breakers.values());

    const openCount = breakers.filter((b) => b.state === CircuitState.OPEN).length;
    const halfOpenCount = breakers.filter((b) => b.state === CircuitState.HALF_OPEN).length;
    const closedCount = breakers.filter((b) => b.state === CircuitState.CLOSED).length;

    return {
      total: breakers.length,
      closed: closedCount,
      halfOpen: halfOpenCount,
      open: openCount,
      healthy: openCount === 0,
      status: openCount > 0 ? 'DEGRADED' : 'HEALTHY',
    };
  }
}

/**
 * Pre-configured circuit breakers for common services
 */
export const DEFAULT_BREAKERS = {
  slack: {
    failureThreshold: 5,
    successThreshold: 3,
    timeout: 30000,
    backoffMultiplier: 2,
  },
  teams: {
    failureThreshold: 5,
    successThreshold: 3,
    timeout: 30000,
    backoffMultiplier: 2,
  },
  email: {
    failureThreshold: 3,
    successThreshold: 2,
    timeout: 60000,
    backoffMultiplier: 2,
  },
  database: {
    failureThreshold: 10,
    successThreshold: 5,
    timeout: 20000,
    backoffMultiplier: 1.5,
  },
  storage: {
    failureThreshold: 8,
    successThreshold: 4,
    timeout: 30000,
    backoffMultiplier: 2,
  },
};

/**
 * Global circuit breaker registry
 */
const globalRegistry = new CircuitBreakerRegistry();

/**
 * Initialize circuit breakers for services
 */
export function initializeCircuitBreakers() {
  for (const [serviceName, config] of Object.entries(DEFAULT_BREAKERS)) {
    globalRegistry.register(serviceName, config);
  }

  console.log('✅ Circuit breakers initialized for:', Object.keys(DEFAULT_BREAKERS));

  return globalRegistry;
}

/**
 * Get or create circuit breaker
 */
export function getCircuitBreaker(serviceName, options) {
  return globalRegistry.get(serviceName) || globalRegistry.register(serviceName, options);
}

/**
 * Example usage wrapper
 */
export async function callWithCircuitBreaker(serviceName, asyncFn, fallbackFn, options) {
  const breaker = getCircuitBreaker(serviceName, options);
  return breaker.call(asyncFn, fallbackFn);
}

/**
 * Get global health status
 */
export function getGlobalCircuitBreakerHealth() {
  return globalRegistry.getHealth();
}

/**
 * Get all circuit breaker metrics
 */
export function getAllCircuitBreakerMetrics() {
  const metrics = {};

  for (const [name, breaker] of globalRegistry.breakers) {
    metrics[name] = breaker.getMetrics();
  }

  return metrics;
}

export default {
  CircuitBreaker,
  CircuitBreakerRegistry,
  CircuitState,
  initializeCircuitBreakers,
  getCircuitBreaker,
  callWithCircuitBreaker,
  getGlobalCircuitBreakerHealth,
  getAllCircuitBreakerMetrics,
  DEFAULT_BREAKERS,
};
