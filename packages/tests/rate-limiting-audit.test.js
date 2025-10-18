/**
 * Rate Limiting and Audit Logging Tests
 * Comprehensive test suite for rate limiter and audit logger services
 */

// Mock node-appwrite before requiring services
jest.mock('node-appwrite', () => ({
  ID: {
    unique: () => 'mock-id-' + Math.random().toString(36).substr(2, 9),
  },
  Databases: jest.fn(),
}));

const rateLimiter = require('../../apps/api/functions/services/rate-limiter');
const auditLogger = require('../../apps/api/functions/services/audit-logger');

describe('Rate Limiter Service', () => {
  beforeEach(() => {
    // Reset rate limiter before each test
    // Note: In a real test, we'd need to clear the internal store
  });

  describe('checkRateLimit', () => {
    test('should allow request when under limit', async () => {
      const result = await rateLimiter.checkRateLimit(
        'test_key_1',
        'recognition_daily'
      );

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(10); // 10 max - 0 used (increments after check)
      expect(result.retryAfter).toBeUndefined();
    });

    test('should deny request when limit exceeded', async () => {
      const limitKey = 'test_key_2';
      const config = rateLimiter.RateLimitConfigs.recognition_daily;

      // Make requests up to the limit
      for (let i = 0; i < config.maxAttempts; i++) {
        const result = await rateLimiter.checkRateLimit(limitKey, 'recognition_daily');
        expect(result.allowed).toBe(true);
      }

      // Next request should be denied
      const result = await rateLimiter.checkRateLimit(limitKey, 'recognition_daily');
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.retryAfter).toBeGreaterThan(0);
    });

    test('should track remaining requests accurately', async () => {
      const limitKey = 'test_key_3';

      // remaining = maxAttempts - count (BEFORE incrementing)
      // Call 1: count=0, remaining = 10 - 0 = 10, then count++
      // Call 2: count=1, remaining = 10 - 1 = 9, then count++
      // etc.
      for (let i = 0; i < 5; i++) {
        const result = await rateLimiter.checkRateLimit(limitKey, 'recognition_daily');
        expect(result.remaining).toBe(10 - i); // Remaining before this increment
      }
    });

    test('should include reset time in response', async () => {
      const result = await rateLimiter.checkRateLimit(
        'test_key_4',
        'recognition_daily'
      );

      expect(result.resetAt).toBeDefined();
      expect(typeof result.resetAt).toBe('number');
      expect(result.resetAt).toBeGreaterThan(Date.now());
    });

    test('should handle different rate limit types', async () => {
      const testCases = [
        { type: 'auth_signin', maxAttempts: 5 },
        { type: 'auth_signup', maxAttempts: 3 },
        { type: 'export_profile', maxAttempts: 5 },
      ];

      for (const testCase of testCases) {
        const result = await rateLimiter.checkRateLimit(
          `test_${testCase.type}`,
          testCase.type
        );

        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(testCase.maxAttempts); // After first increment
      }
    });

    test('should throw error for unknown rate limit type', async () => {
      await expect(
        rateLimiter.checkRateLimit('test_key', 'unknown_type')
      ).rejects.toThrow('Unknown rate limit type');
    });

    test('should include metadata in response', async () => {
      const result = await rateLimiter.checkRateLimit(
        'test_key_5',
        'recognition_daily'
      );

      expect(result.metadata).toBeDefined();
      expect(result.metadata.limitType).toBe('recognition_daily');
      expect(result.metadata.limitKey).toBe('test_key_5');
      expect(result.metadata.maxAttempts).toBe(10);
    });
  });

  describe('resetRateLimit', () => {
    test('should reset rate limit counter', async () => {
      const limitKey = 'test_reset_key';

      // Use some requests
      await rateLimiter.checkRateLimit(limitKey, 'recognition_daily');
      await rateLimiter.checkRateLimit(limitKey, 'recognition_daily');

      let status = rateLimiter.getRateLimitStatus(limitKey, 'recognition_daily');
      expect(status.count).toBe(2);

      // Reset
      rateLimiter.resetRateLimit(limitKey);

      // Should be reset
      const result = await rateLimiter.checkRateLimit(limitKey, 'recognition_daily');
      expect(result.remaining).toBe(10); // After reset and first increment
    });
  });

  describe('getRateLimitStatus', () => {
    test('should return current status', async () => {
      const limitKey = 'test_status_key';

      // Make some requests
      for (let i = 0; i < 3; i++) {
        await rateLimiter.checkRateLimit(limitKey, 'recognition_daily');
      }

      const status = rateLimiter.getRateLimitStatus(limitKey, 'recognition_daily');

      expect(status).not.toBeNull();
      expect(status.count).toBe(3);
      expect(status.remaining).toBe(7);
      expect(status.resetAt).toBeDefined();
    });

    test('should return null for unknown limit key', () => {
      const status = rateLimiter.getRateLimitStatus('nonexistent_key', 'recognition_daily');
      expect(status).toBeNull();
    });

    test('should return null for unknown limit type', () => {
      const status = rateLimiter.getRateLimitStatus('test_key', 'unknown_type');
      expect(status).toBeNull();
    });
  });

  describe('checkRateLimitMiddleware', () => {
    test('should return allowed result when under limit', async () => {
      const result = await rateLimiter.checkRateLimitMiddleware(
        'recognition_daily',
        'test_middleware_1'
      );

      expect(result.allowed).toBe(true);
      expect(result.statusCode).toBe(200);
      expect(result.headers['X-RateLimit-Limit']).toBe('10');
      expect(result.headers['X-RateLimit-Remaining']).toBe('10'); // After first increment
      expect(result.headers['X-RateLimit-Reset']).toBeDefined();
    });

    test('should include Retry-After header when rate limited', async () => {
      const limitKey = 'test_middleware_2';
      const config = rateLimiter.RateLimitConfigs.recognition_daily;

      // Exhaust limit
      for (let i = 0; i < config.maxAttempts; i++) {
        await rateLimiter.checkRateLimitMiddleware('recognition_daily', limitKey);
      }

      // Next request should include Retry-After
      const result = await rateLimiter.checkRateLimitMiddleware(
        'recognition_daily',
        limitKey
      );

      expect(result.allowed).toBe(false);
      expect(result.statusCode).toBe(429);
      expect(result.headers['Retry-After']).toBeDefined();
      expect(result.body.error).toContain('Rate limit exceeded');
    });
  });
});

describe('Audit Logger Service', () => {
  describe('hashUserId', () => {
    test('should hash user ID consistently', () => {
      const userId = 'user_123';
      const hash1 = auditLogger.hashUserId(userId);
      const hash2 = auditLogger.hashUserId(userId);

      expect(hash1).toBe(hash2);
      expect(hash1.length).toBeLessThanOrEqual(16);
    });

    test('should return SYSTEM for null/undefined', () => {
      expect(auditLogger.hashUserId(null)).toBe('SYSTEM');
      expect(auditLogger.hashUserId(undefined)).toBe('SYSTEM');
    });

    test('should not expose user ID in hash', () => {
      const userId = 'user_123';
      const hash = auditLogger.hashUserId(userId);

      expect(hash).not.toContain(userId);
      expect(hash).not.toContain('user');
      expect(hash).not.toContain('123');
    });

    test('should produce different hashes for different users', () => {
      const hash1 = auditLogger.hashUserId('user_1');
      const hash2 = auditLogger.hashUserId('user_2');

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('detectSuspiciousPatterns', () => {
    test('should detect rapid auth failures', () => {
      const entries = [];
      for (let i = 0; i < 6; i++) {
        entries.push({
          eventCode: auditLogger.AuditEventCodes.AUTH_SIGNIN_FAILED,
          createdAt: new Date(Date.now() - i * 1000).toISOString(),
        });
      }

      const patterns = auditLogger.detectSuspiciousPatterns(entries);
      expect(patterns).toContainEqual(
        expect.objectContaining({
          type: 'RAPID_AUTH_FAILURES',
          severity: 'HIGH',
        })
      );
    });

    test('should detect rate limit breaches', () => {
      const entries = [];
      for (let i = 0; i < 4; i++) {
        entries.push({
          eventCode: auditLogger.AuditEventCodes.RATE_LIMIT_BREACH,
          createdAt: new Date(Date.now() - i * 1000).toISOString(),
        });
      }

      const patterns = auditLogger.detectSuspiciousPatterns(entries);
      expect(patterns).toContainEqual(
        expect.objectContaining({
          type: 'RATE_LIMIT_BREACHES',
          severity: 'MEDIUM',
        })
      );
    });

    test('should detect unusual volume', () => {
      const entries = [];
      for (let i = 0; i < 25; i++) {
        entries.push({
          eventCode: auditLogger.AuditEventCodes.RECOGNITION_CREATED,
          createdAt: new Date(Date.now() - i * 1000).toISOString(),
        });
      }

      const patterns = auditLogger.detectSuspiciousPatterns(entries);
      expect(patterns).toContainEqual(
        expect.objectContaining({
          type: 'UNUSUAL_VOLUME',
          severity: 'MEDIUM',
        })
      );
    });

    test('should return empty array for clean activity', () => {
      const entries = [
        {
          eventCode: auditLogger.AuditEventCodes.RECOGNITION_CREATED,
          createdAt: new Date().toISOString(),
        },
        {
          eventCode: auditLogger.AuditEventCodes.AUTH_SIGNIN_SUCCESS,
          createdAt: new Date().toISOString(),
        },
      ];

      const patterns = auditLogger.detectSuspiciousPatterns(entries);
      expect(patterns.length).toBe(0);
    });

    test('should return empty array for null/empty input', () => {
      expect(auditLogger.detectSuspiciousPatterns(null)).toEqual([]);
      expect(auditLogger.detectSuspiciousPatterns([])).toEqual([]);
    });
  });

  describe('AuditEventCodes', () => {
    test('should have all required event codes', () => {
      const requiredCodes = [
        'RECOGNITION_CREATED',
        'RECOGNITION_VERIFIED',
        'AUTH_SIGNIN_SUCCESS',
        'AUTH_SIGNIN_FAILED',
        'ADMIN_OVERRIDE',
        'ABUSE_FLAGGED',
        'RATE_LIMIT_BREACH',
      ];

      requiredCodes.forEach(code => {
        expect(auditLogger.AuditEventCodes[code]).toBeDefined();
      });
    });

    test('should have unique event codes', () => {
      const codes = Object.values(auditLogger.AuditEventCodes);
      const uniqueCodes = new Set(codes);

      expect(codes.length).toBe(uniqueCodes.size);
    });
  });
});

describe('Rate Limiting and Audit Integration', () => {
  test('should generate rate limit headers correctly', async () => {
    const result = await rateLimiter.checkRateLimitMiddleware(
      'recognition_daily',
      'integration_test'
    );

    expect(result.headers['X-RateLimit-Limit']).toBe('10');
    expect(result.headers['X-RateLimit-Remaining']).toBe('10'); // After first increment
    expect(result.headers['X-RateLimit-Reset']).toMatch(/^\d+$/);
  });

  test('should handle authentication rate limiting', async () => {
    const clientIp = '192.168.1.1';
    const limitKey = `auth_signin:${clientIp}`;
    const config = rateLimiter.RateLimitConfigs.auth_signin;

    // Should allow up to 5 attempts
    for (let i = 0; i < config.maxAttempts; i++) {
      const result = await rateLimiter.checkRateLimit(limitKey, 'auth_signin');
      expect(result.allowed).toBe(true);
    }

    // 6th attempt should fail
    const result = await rateLimiter.checkRateLimit(limitKey, 'auth_signin');
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  test('should handle export rate limiting', async () => {
    const userId = 'user_export_test';
    const limitKey = `export_profile:${userId}`;

    // Should allow 5 exports per day
    for (let i = 0; i < 5; i++) {
      const result = await rateLimiter.checkRateLimit(limitKey, 'export_profile');
      expect(result.allowed).toBe(true);
    }

    // 6th export should fail
    const result = await rateLimiter.checkRateLimit(limitKey, 'export_profile');
    expect(result.allowed).toBe(false);
  });
});

describe('Performance Tests', () => {
  test('rate limit check should be fast', async () => {
    const start = Date.now();
    
    for (let i = 0; i < 1000; i++) {
      await rateLimiter.checkRateLimit(`perf_test_${i}`, 'recognition_daily');
    }

    const duration = Date.now() - start;
    expect(duration).toBeLessThan(1000); // Should complete in less than 1 second
  });

  test('suspicious pattern detection should handle large datasets', () => {
    const entries = [];
    for (let i = 0; i < 1000; i++) {
      entries.push({
        eventCode: auditLogger.AuditEventCodes.RECOGNITION_CREATED,
        createdAt: new Date(Date.now() - i * 1000).toISOString(),
      });
    }

    const start = Date.now();
    const patterns = auditLogger.detectSuspiciousPatterns(entries);
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(100); // Should detect patterns quickly
    expect(patterns.length).toBeGreaterThan(0);
  });
});
