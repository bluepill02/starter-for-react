/**
 * Quota Management Service
 * Prevents noisy neighbor problems via per-organization quotas
 *
 * Features:
 * - Per-organization quotas (recognitions, storage, API calls)
 * - Real-time quota enforcement
 * - Quota reset scheduling (daily, monthly)
 * - Usage tracking and reporting
 * - Overage handling (soft/hard limits)
 * - Quota analytics
 */

import { Client, Databases, ID } from 'appwrite';

const client = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT)
  .setProject(process.env.APPWRITE_PROJECT_ID)
  .setKey(process.env.APPWRITE_KEY);

const databases = new Databases(client);

const DATABASE_ID = process.env.DATABASE_ID || 'recognition-db';

/**
 * Default quota limits per organization
 */
export const DEFAULT_QUOTAS = {
  recognitions_per_day: 1000,
  recognitions_per_month: 25000,
  storage_gb_per_month: 100,
  api_calls_per_hour: 10000,
  exports_per_day: 50,
  shareable_links_per_day: 200,
  team_members: 500,
  custom_domains: 10,
};

/**
 * Quota tracker for organizations
 */
export class QuotaManager {
  constructor(organizationId, quotas = DEFAULT_QUOTAS) {
    this.organizationId = organizationId;
    this.quotas = quotas;
    this.usage = {};
    this.resetTimes = {};
  }

  /**
   * Check if action is within quota
   */
  async canPerformAction(actionType, amount = 1) {
    const quota = this.quotas[actionType];

    if (!quota) {
      console.warn(`Unknown quota type: ${actionType}`);
      return { allowed: true, reason: 'unknown_quota_type' };
    }

    // Fetch current usage from database
    const currentUsage = await this.getUsage(actionType);
    const newTotal = currentUsage + amount;

    if (newTotal > quota) {
      return {
        allowed: false,
        reason: 'quota_exceeded',
        quota,
        current: currentUsage,
        requested: amount,
        remaining: Math.max(0, quota - currentUsage),
      };
    }

    return {
      allowed: true,
      quota,
      current: currentUsage,
      requested: amount,
      remaining: quota - newTotal,
    };
  }

  /**
   * Record usage of an action
   */
  async recordUsage(actionType, amount = 1) {
    try {
      const currentUsage = await this.getUsage(actionType);
      const newUsage = currentUsage + amount;

      // Store in database
      await this.storeUsage(actionType, newUsage);

      return {
        success: true,
        actionType,
        previousUsage: currentUsage,
        newUsage,
        recorded: new Date().toISOString(),
      };
    } catch (error) {
      console.error(`Failed to record usage for ${actionType}:`, error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get current usage for an action type
   */
  async getUsage(actionType) {
    try {
      // Check in-memory cache first
      if (this.usage[actionType] !== undefined) {
        return this.usage[actionType];
      }

      // Fetch from database
      const usageKey = `${this.organizationId}:${actionType}`;

      try {
        const document = await databases.getDocument(
          DATABASE_ID,
          'quota-usage',
          usageKey
        );

        this.usage[actionType] = document.used || 0;
        return this.usage[actionType];
      } catch (error) {
        if (error.code === 404) {
          // No record yet, usage is 0
          return 0;
        }
        throw error;
      }
    } catch (error) {
      console.error(`Failed to get usage for ${actionType}:`, error.message);
      return 0;
    }
  }

  /**
   * Store usage to database
   */
  async storeUsage(actionType, amount) {
    const usageKey = `${this.organizationId}:${actionType}`;

    try {
      await databases.updateDocument(
        DATABASE_ID,
        'quota-usage',
        usageKey,
        {
          organizationId: this.organizationId,
          actionType,
          used: amount,
          limit: this.quotas[actionType],
          lastUpdated: new Date().toISOString(),
          percentage: (amount / this.quotas[actionType]) * 100,
        }
      );
    } catch (error) {
      if (error.code === 404) {
        // Create new document
        await databases.createDocument(
          DATABASE_ID,
          'quota-usage',
          usageKey,
          {
            organizationId: this.organizationId,
            actionType,
            used: amount,
            limit: this.quotas[actionType],
            createdAt: new Date().toISOString(),
            lastUpdated: new Date().toISOString(),
            percentage: (amount / this.quotas[actionType]) * 100,
          }
        );
      } else {
        throw error;
      }
    }
  }

  /**
   * Reset quota for an action type
   */
  async resetQuota(actionType) {
    try {
      const usageKey = `${this.organizationId}:${actionType}`;

      await databases.updateDocument(
        DATABASE_ID,
        'quota-usage',
        usageKey,
        {
          used: 0,
          resetAt: new Date().toISOString(),
        }
      );

      // Clear in-memory cache
      delete this.usage[actionType];

      return {
        success: true,
        actionType,
        resetAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error(`Failed to reset quota for ${actionType}:`, error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get organization quota status
   */
  async getStatus() {
    const status = {
      organizationId: this.organizationId,
      quotas: {},
      timestamp: new Date().toISOString(),
    };

    for (const [quotaType, limit] of Object.entries(this.quotas)) {
      const used = await this.getUsage(quotaType);
      const percentage = (used / limit) * 100;

      status.quotas[quotaType] = {
        limit,
        used,
        remaining: Math.max(0, limit - used),
        percentage: percentage.toFixed(2),
        status: percentage >= 100 ? 'EXCEEDED' : percentage >= 80 ? 'WARNING' : 'OK',
      };
    }

    return status;
  }

  /**
   * Get quota alerts (near or exceeded limits)
   */
  async getAlerts() {
    const alerts = [];
    const status = await this.getStatus();

    for (const [quotaType, usage] of Object.entries(status.quotas)) {
      const percentage = parseFloat(usage.percentage);

      if (percentage >= 100) {
        alerts.push({
          type: 'EXCEEDED',
          quotaType,
          usage: usage.used,
          limit: usage.limit,
          severity: 'CRITICAL',
        });
      } else if (percentage >= 80) {
        alerts.push({
          type: 'WARNING',
          quotaType,
          usage: usage.used,
          limit: usage.limit,
          percentage,
          severity: 'HIGH',
        });
      }
    }

    return alerts;
  }

  /**
   * Request quota increase
   */
  async requestIncrease(quotaType, newLimit, reason = '') {
    try {
      const requestId = ID.unique();

      await databases.createDocument(
        DATABASE_ID,
        'quota-increase-requests',
        requestId,
        {
          organizationId: this.organizationId,
          quotaType,
          currentLimit: this.quotas[quotaType],
          requestedLimit: newLimit,
          reason,
          status: 'PENDING',
          requestedAt: new Date().toISOString(),
        }
      );

      return {
        success: true,
        requestId,
        status: 'PENDING',
        message: 'Quota increase request submitted for review',
      };
    } catch (error) {
      console.error('Failed to create quota increase request:', error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  }
}

/**
 * Global quota manager registry
 */
const quotaManagerRegistry = new Map();

/**
 * Get or create quota manager for organization
 */
export function getQuotaManager(organizationId, quotas = DEFAULT_QUOTAS) {
  if (!quotaManagerRegistry.has(organizationId)) {
    quotaManagerRegistry.set(organizationId, new QuotaManager(organizationId, quotas));
  }

  return quotaManagerRegistry.get(organizationId);
}

/**
 * Quota enforcement middleware
 */
export async function quotaEnforcementMiddleware(req, quotaType) {
  const organizationId = req.headers['x-organization-id'];

  if (!organizationId) {
    return {
      allowed: true,
      reason: 'no_organization_id',
      message: 'Quota enforcement skipped',
    };
  }

  const manager = getQuotaManager(organizationId);
  const canPerform = await manager.canPerformAction(quotaType, 1);

  return canPerform;
}

/**
 * Record quota usage middleware
 */
export async function recordQuotaUsageMiddleware(organizationId, quotaType, amount = 1) {
  if (!organizationId) {
    return { success: true, recorded: false, reason: 'no_organization_id' };
  }

  const manager = getQuotaManager(organizationId);
  return manager.recordUsage(quotaType, amount);
}

/**
 * Batch reset quotas (e.g., daily/monthly reset job)
 */
export async function batchResetQuotas(resetType = 'daily') {
  const quotasToReset =
    resetType === 'daily'
      ? [
          'recognitions_per_day',
          'api_calls_per_hour',
          'exports_per_day',
          'shareable_links_per_day',
        ]
      : resetType === 'monthly'
        ? [
            'recognitions_per_month',
            'storage_gb_per_month',
          ]
        : [];

  console.log(`🔄 Batch resetting ${resetType} quotas...`);

  const results = {
    type: resetType,
    timestamp: new Date().toISOString(),
    success: 0,
    failed: 0,
    errors: [],
  };

  try {
    // Fetch all organizations with usage records
    const usageRecords = await databases.listDocuments(DATABASE_ID, 'quota-usage');

    const organizationIds = new Set();

    for (const record of usageRecords.documents) {
      if (quotasToReset.includes(record.actionType)) {
        organizationIds.add(record.organizationId);
      }
    }

    // Reset quotas for each organization
    for (const orgId of organizationIds) {
      const manager = getQuotaManager(orgId);

      for (const quotaType of quotasToReset) {
        try {
          await manager.resetQuota(quotaType);
          results.success++;
        } catch (error) {
          results.failed++;
          results.errors.push({
            organizationId: orgId,
            quotaType,
            error: error.message,
          });
        }
      }
    }

    console.log(`✅ Batch reset complete: ${results.success} success, ${results.failed} failed`);
  } catch (error) {
    console.error('Batch reset failed:', error.message);
    results.errors.push({ general: error.message });
  }

  return results;
}

/**
 * Generate quota usage report
 */
export async function generateQuotaReport(organizationId) {
  const manager = getQuotaManager(organizationId);
  const status = await manager.getStatus();
  const alerts = await manager.getAlerts();

  return {
    organizationId,
    generatedAt: new Date().toISOString(),
    status,
    alerts,
    summary: {
      totalQuotas: Object.keys(manager.quotas).length,
      exceededCount: alerts.filter((a) => a.type === 'EXCEEDED').length,
      warningCount: alerts.filter((a) => a.type === 'WARNING').length,
      allClear: alerts.length === 0,
    },
  };
}

export default {
  QuotaManager,
  DEFAULT_QUOTAS,
  getQuotaManager,
  quotaEnforcementMiddleware,
  recordQuotaUsageMiddleware,
  batchResetQuotas,
  generateQuotaReport,
};
