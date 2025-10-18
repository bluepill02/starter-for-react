/**
 * Compliance Policy Manager
 * Manages organization-level compliance policies and controls
 * 
 * Features:
 * - Data retention policies
 * - Evidence requirements per role
 * - Verification requirements
 * - Export restrictions
 * - User consent tracking
 * - Policy version history
 */

import { Client, Databases } from 'node-appwrite';
import { createAuditLog } from '../services/audit-logger.js';

const client = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT)
  .setProject(process.env.APPWRITE_PROJECT_ID)
  .setKey(process.env.APPWRITE_KEY);

const databases = new Databases(client);

const DATABASE_ID = process.env.DATABASE_ID || 'recognition-db';

/**
 * Default compliance policies
 */
const DEFAULT_POLICIES = {
  dataRetention: {
    recognitionDays: 365,
    auditDays: 2555, // 7 years
    telemetryDays: 90,
  },
  evidenceRequirements: {
    user: {
      required: false,
      maxSize: 10485760, // 10MB
    },
    manager: {
      required: false,
      maxSize: 52428800, // 50MB
    },
    hr: {
      required: true,
      maxSize: 52428800,
    },
  },
  verificationRequirements: {
    enabled: true,
    requiredFor: ['hr_feedback', 'promotion_feedback'],
    maxDaysForVerification: 7,
  },
  exportRestrictions: {
    allowPdfExport: true,
    allowCsvExport: true,
    requiresApproval: false,
    anonymizeForHr: true,
  },
  userConsent: {
    requireEmailConsent: true,
    requireShareConsent: true,
    requireAnalyticsConsent: false,
  },
};

/**
 * Create or update compliance policy
 * 
 * Usage:
 * POST /functions/compliance-policy-manager
 * Headers: x-appwrite-user-id, x-appwrite-user-role
 * Body: {
 *   organizationId: string,
 *   policyType: "dataRetention" | "evidenceRequirements" | "verificationRequirements" | "exportRestrictions" | "userConsent",
 *   policy: { ... },
 *   enforcedAt?: ISO date string,
 *   requiresApproval?: boolean
 * }
 */
export default async function handler(req, context) {
  try {
    // Extract user ID and role
    const userId = req.headers['x-appwrite-user-id'];
    const userRole = req.headers['x-appwrite-user-role'] || 'user';

    if (!userId) {
      return context.res.json(
        {
          error: 'Unauthorized',
          code: 'UNAUTHORIZED',
        },
        401
      );
    }

    // Role check: only admins can manage policies
    if (userRole !== 'admin') {
      await createAuditLog({
        eventCode: 'POLICY_UPDATE_DENIED',
        actorId: userId,
        metadata: {
          reason: 'Insufficient permissions',
          userRole,
        },
      });

      return context.res.json(
        {
          error: 'Only admins can manage compliance policies',
          code: 'PERMISSION_DENIED',
        },
        403
      );
    }

    // Parse request
    const body = typeof req.bodyJson === 'string'
      ? JSON.parse(req.bodyJson)
      : req.bodyJson;

    const {
      organizationId,
      policyType,
      policy,
      enforcedAt,
      requiresApproval = false,
    } = body;

    // Validation
    if (!organizationId || !policyType || !policy) {
      return context.res.json(
        {
          error: 'organizationId, policyType, and policy are required',
          code: 'VALIDATION_ERROR',
        },
        400
      );
    }

    const validPolicyTypes = [
      'dataRetention',
      'evidenceRequirements',
      'verificationRequirements',
      'exportRestrictions',
      'userConsent',
    ];

    if (!validPolicyTypes.includes(policyType)) {
      return context.res.json(
        {
          error: `policyType must be one of: ${validPolicyTypes.join(', ')}`,
          code: 'INVALID_POLICY_TYPE',
        },
        400
      );
    }

    // Get or create compliance policy document
    const policyId = `policy-${organizationId}`;
    let policyDocument;

    try {
      policyDocument = await databases.getDocument(
        DATABASE_ID,
        'compliance-policies',
        policyId
      );
    } catch (error) {
      if (error.code === 404) {
        // Create new policy document with defaults
        policyDocument = {
          $id: policyId,
          organizationId,
          ...DEFAULT_POLICIES,
          createdBy: userId,
          createdAt: new Date().toISOString(),
          versions: [],
        };
      } else {
        throw error;
      }
    }

    // Store previous version
    const previousPolicy = { ...policyDocument[policyType] };

    // Update policy
    policyDocument[policyType] = policy;
    policyDocument.updatedBy = userId;
    policyDocument.updatedAt = new Date().toISOString();

    // Add version entry
    if (!policyDocument.versions) {
      policyDocument.versions = [];
    }

    policyDocument.versions.push({
      policyType,
      previousPolicy,
      newPolicy: policy,
      changedBy: userId,
      changedAt: new Date().toISOString(),
      requiresApproval,
      approvalStatus: requiresApproval ? 'pending' : 'approved',
      enforcedAt: enforcedAt || new Date().toISOString(),
    });

    // Keep last 50 versions
    policyDocument.versions = policyDocument.versions.slice(-50);

    // Create or update policy document
    try {
      await databases.createDocument(
        DATABASE_ID,
        'compliance-policies',
        policyId,
        policyDocument
      );
    } catch (error) {
      if (error.code === 409 || error.message?.includes('already exists')) {
        // Document exists, update it
        await databases.updateDocument(
          DATABASE_ID,
          'compliance-policies',
          policyId,
          policyDocument
        );
      } else if (error.code === 404) {
        // Collection doesn't exist, create it
        await databases.createCollection(
          DATABASE_ID,
          'compliance-policies',
          'Compliance Policies'
        );
        await databases.createDocument(
          DATABASE_ID,
          'compliance-policies',
          policyId,
          policyDocument
        );
      } else {
        throw error;
      }
    }

    // Log policy update
    await createAuditLog({
      eventCode: 'COMPLIANCE_POLICY_UPDATED',
      actorId: userId,
      targetId: organizationId,
      metadata: {
        policyType,
        previousPolicy,
        newPolicy: policy,
        requiresApproval,
        approvalStatus: requiresApproval ? 'pending' : 'approved',
        enforcedAt: enforcedAt || new Date().toISOString(),
      },
    });

    return context.res.json(
      {
        success: true,
        message: `${policyType} policy updated successfully`,
        policy: {
          organizationId,
          policyType,
          currentPolicy: policy,
          requiresApproval,
          approvalStatus: requiresApproval ? 'pending' : 'approved',
          updatedAt: policyDocument.updatedAt,
          enforceAt: enforcedAt || new Date().toISOString(),
        },
      },
      200
    );
  } catch (error) {
    console.error('Error managing compliance policy:', error);

    const userId = req.headers['x-appwrite-user-id'];
    if (userId) {
      await createAuditLog({
        eventCode: 'COMPLIANCE_POLICY_UPDATE_FAILED',
        actorId: userId,
        metadata: {
          error: error.message,
        },
      });
    }

    return context.res.json(
      {
        error: 'Failed to update compliance policy',
        code: 'UPDATE_FAILED',
        details: error.message,
      },
      500
    );
  }
}
