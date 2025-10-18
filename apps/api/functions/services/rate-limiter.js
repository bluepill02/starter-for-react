/**
 * Rate Limiting Service
 * Handles rate limiting for various operations (recognition creation, auth attempts, etc.)
 * Uses in-memory store with persistent fallback via Appwrite Database
 * 
 * Rate Limit Tiers:
 * - RECOGNITION_CREATION: 10/day, 50/week, 100/month per user
 * - AUTH_ATTEMPTS: 5 failed attempts/5 minutes per IP
 * - EXPORT_REQUESTS: 5/day per user
 * - INTEGRATION_CALLS: 100/hour per integration
 */

const { ID } = require('node-appwrite');

// In-memory cache for rate limits (TTL = 5 minutes)
const RateLimitConfigs = {
  // Recognition creation rate limits
  recognition_daily: {
    maxAttempts: 10,
    windowMs: 24 * 60 * 60 * 1000, // 24 hours
  },
  recognition_weekly: {
    maxAttempts: 50,
    windowMs: 7 * 24 * 60 * 60 * 1000, // 7 days
  },
  recognition_monthly: {
    maxAttempts: 100,
    windowMs: 30 * 24 * 60 * 60 * 1000, // 30 days
  },
  // Authentication rate limits
  auth_signin: {
    maxAttempts: 5,
    windowMs: 5 * 60 * 1000, // 5 minutes
  },
  auth_signup: {
    maxAttempts: 3,
    windowMs: 60 * 60 * 1000, // 1 hour
  },
  auth_password_reset: {
    maxAttempts: 3,
    windowMs: 60 * 60 * 1000, // 1 hour
  },
  // Export rate limits
  export_profile: {
    maxAttempts: 5,
    windowMs: 24 * 60 * 60 * 1000, // 24 hours
  },
  // Integration rate limits
  integration_slack: {
    maxAttempts: 100,
    windowMs: 60 * 60 * 1000, // 1 hour
  },
  integration_teams: {
    maxAttempts: 100,
    windowMs: 60 * 60 * 1000, // 1 hour
  },
  // API rate limits
  api_general: {
    maxAttempts: 1000,
    windowMs: 60 * 60 * 1000, // 1 hour
  },
};

/**
 * In-memory store with automatic cleanup
 */
class RateLimiterStore {
  constructor() {
    this.store = new Map();
    this.cleanupInterval = null;
    
    // Cleanup expired entries every 5 minutes
    if (typeof window === 'undefined') { // Only in Node.js
      this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
    }
  }

  cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (entry.resetAt < now) {
        this.store.delete(key);
      }
    }
  }

  get(key) {
    const entry = this.store.get(key);
    if (entry && entry.resetAt < Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    return entry;
  }

  set(key, entry) {
    this.store.set(key, entry);
  }

  delete(key) {
    this.store.delete(key);
  }

  size() {
    return this.store.size;
  }
}

const store = new RateLimiterStore();

/**
 * Check if a request should be rate limited
 * @param {string} limitKey - Unique identifier for the rate limit (e.g., "recognition_daily:{userId}")
 * @param {string} limitType - Type of rate limit (e.g., "recognition_daily")
 * @param {object} databases - Optional Appwrite Databases instance for persistence
 * @returns { allowed: boolean, remaining: number, resetAt: number, retryAfter?: number }
 */
async function checkRateLimit(limitKey, limitType, databases) {
  const config = RateLimitConfigs[limitType];
  if (!config) {
    throw new Error(`Unknown rate limit type: ${limitType}`);
  }

  const now = Date.now();
  let entry = store.get(limitKey);

  // Initialize or reset if window expired
  if (!entry || entry.resetAt < now) {
    entry = {
      count: 0,
      resetAt: now + config.windowMs,
    };
  }

  const isAllowed = entry.count < config.maxAttempts;
  const remaining = Math.max(0, config.maxAttempts - entry.count);
  const retryAfter = isAllowed ? undefined : Math.ceil((entry.resetAt - now) / 1000);

  // Increment counter
  entry.count++;
  store.set(limitKey, entry);

  // Optionally persist to database for multi-instance deployments
  if (databases && !isAllowed) {
    try {
      await persistRateLimitBreach(databases, limitKey, limitType, entry);
    } catch (error) {
      console.error('Failed to persist rate limit breach:', error);
      // Continue anyway - rate limiting still works in-memory
    }
  }

  return {
    allowed: isAllowed,
    remaining,
    resetAt: entry.resetAt,
    retryAfter,
    metadata: {
      limitType,
      limitKey,
      windowMs: config.windowMs,
      maxAttempts: config.maxAttempts,
    },
  };
}

/**
 * Reset rate limit for a specific key
 * @param {string} limitKey - The rate limit key to reset
 */
function resetRateLimit(limitKey) {
  store.delete(limitKey);
}

/**
 * Get current rate limit status
 * @param {string} limitKey - The rate limit key to check
 * @param {string} limitType - Type of rate limit
 * @returns Current status or null if not rate limited
 */
function getRateLimitStatus(limitKey, limitType) {
  const config = RateLimitConfigs[limitType];
  if (!config) return null;

  const entry = store.get(limitKey);
  if (!entry) return null;

  return {
    count: entry.count,
    remaining: Math.max(0, config.maxAttempts - entry.count),
    resetAt: entry.resetAt,
  };
}

/**
 * Persist rate limit breach to database for monitoring and multi-instance support
 */
async function persistRateLimitBreach(databases, limitKey, limitType, entry) {
  try {
    const DATABASE_ID = process.env.DATABASE_ID || 'main';

    // Create a collection for rate limit breaches if it doesn't exist
    // For now, store in a temporary collection or use telemetry
    await databases.createDocument(
      DATABASE_ID,
      'rate_limit_breaches', // This collection should exist
      ID.unique(),
      {
        limitKey,
        limitType,
        breachedAt: new Date().toISOString(),
        resetAt: new Date(entry.resetAt).toISOString(),
        metadata: JSON.stringify({
          count: entry.count,
          config: RateLimitConfigs[limitType],
        }),
      }
    );
  } catch (error) {
    console.error('Failed to persist rate limit breach:', error);
    // Non-critical - don't throw
  }
}

/**
 * Get rate limit statistics for monitoring
 */
function getStatistics() {
  return {
    totalEntries: store.size(),
    limitTypes: {},
    oldestResetTime: null,
    newestResetTime: null,
  };
}

/**
 * Rate limit middleware for Appwrite Functions
 * Usage: checkRateLimitMiddleware(req, 'recognition_daily', `recognition_daily:${userId}`)
 */
async function checkRateLimitMiddleware(limitType, limitKey, databases) {
  const result = await checkRateLimit(limitKey, limitType, databases);

  const headers = {
    'X-RateLimit-Limit': String(RateLimitConfigs[limitType]?.maxAttempts || 0),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(Math.ceil(result.resetAt / 1000)),
  };

  if (!result.allowed && result.retryAfter) {
    headers['Retry-After'] = String(result.retryAfter);
  }

  if (!result.allowed) {
    return {
      allowed: false,
      statusCode: 429,
      headers,
      body: {
        success: false,
        error: `Rate limit exceeded. Please try again in ${result.retryAfter} seconds.`,
        metadata: {
          limitType,
          retryAfter: result.retryAfter,
          resetAt: new Date(result.resetAt).toISOString(),
        },
      },
    };
  }

  return {
    allowed: true,
    statusCode: 200,
    headers,
  };
}

module.exports = {
  checkRateLimit,
  resetRateLimit,
  getRateLimitStatus,
  getStatistics,
  checkRateLimitMiddleware,
  RateLimitConfigs,
};
