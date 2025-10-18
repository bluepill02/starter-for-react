/**
 * Domain Provisioning Service
 * Manages organization domains and single sign-on configurations
 * 
 * Features:
 * - Domain registration and verification
 * - SSO configuration per domain (SAML, OAuth)
 * - Email domain restrictions
 * - Bulk user provisioning from domain
 * - Admin controls per domain
 */

import { Client, Databases, ID } from 'node-appwrite';
import { createAuditLog } from '../services/audit-logger.js';

const client = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT)
  .setProject(process.env.APPWRITE_PROJECT_ID)
  .setKey(process.env.APPWRITE_KEY);

const databases = new Databases(client);

const DATABASE_ID = process.env.DATABASE_ID || 'recognition-db';

/**
 * Validate domain format
 */
function isValidDomain(domain) {
  const domainRegex = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;
  return domainRegex.test(domain);
}

/**
 * Generate DNS verification token
 */
function generateVerificationToken() {
  return `appwrite-verification-${Date.now()}-${Math.random().toString(36).substring(7)}`;
}

/**
 * Register organization domain
 * 
 * Usage:
 * POST /functions/domain-register
 * Headers: x-appwrite-user-id, x-appwrite-user-role
 * Body: {
 *   domain: "company.com",
 *   organizationName: "Company Name",
 *   verificationMethod: "dns" | "email", (default: dns)
 *   ssoConfig?: {
 *     type: "saml" | "oauth",
 *     entityId?: string (for SAML),
 *     acsUrl?: string (for SAML),
 *   }
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

    // Role check: only admins can register domains
    if (userRole !== 'admin') {
      await createAuditLog({
        eventCode: 'DOMAIN_REGISTER_DENIED',
        actorId: userId,
        metadata: {
          reason: 'Insufficient permissions',
          userRole,
        },
      });

      return context.res.json(
        {
          error: 'Only admins can register domains',
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
      domain,
      organizationName,
      verificationMethod = 'dns',
      ssoConfig,
    } = body;

    // Validation
    if (!domain || !organizationName) {
      return context.res.json(
        {
          error: 'domain and organizationName are required',
          code: 'VALIDATION_ERROR',
        },
        400
      );
    }

    if (!isValidDomain(domain)) {
      return context.res.json(
        {
          error: 'Invalid domain format',
          code: 'INVALID_DOMAIN',
        },
        400
      );
    }

    if (!['dns', 'email'].includes(verificationMethod)) {
      return context.res.json(
        {
          error: 'verificationMethod must be "dns" or "email"',
          code: 'INVALID_VERIFICATION_METHOD',
        },
        400
      );
    }

    // Check if domain already registered
    const existingDomains = await databases.listDocuments(DATABASE_ID, 'domains');
    const domainExists = existingDomains.documents.some((d) => d.domain === domain);

    if (domainExists) {
      return context.res.json(
        {
          error: 'Domain already registered',
          code: 'DOMAIN_EXISTS',
        },
        400
      );
    }

    // Generate verification token
    const verificationToken = generateVerificationToken();

    // Create domain record
    const domainId = ID.unique();
    const domainRecord = {
      $id: domainId,
      domain,
      organizationName,
      registeredBy: userId,
      registeredAt: new Date().toISOString(),
      verificationMethod,
      verificationToken,
      isVerified: false,
      verifiedAt: null,
      ssoEnabled: !!ssoConfig,
      ssoConfig: ssoConfig || {},
      emailRestriction: `@${domain}`,
      allowedRoles: ['user', 'manager'],
      isActive: false,
      metadata: {
        createdAt: new Date().toISOString(),
        adminCount: 0,
        userCount: 0,
      },
    };

    // Store domain record
    try {
      await databases.createDocument(DATABASE_ID, 'domains', domainId, domainRecord);
    } catch (error) {
      if (error.code === 404) {
        // Domains collection doesn't exist, create it
        await databases.createCollection(
          DATABASE_ID,
          'domains',
          'Organization Domains'
        );
        await databases.createDocument(DATABASE_ID, 'domains', domainId, domainRecord);
      } else {
        throw error;
      }
    }

    // Log domain registration
    await createAuditLog({
      eventCode: 'DOMAIN_REGISTERED',
      actorId: userId,
      targetId: domainId,
      metadata: {
        domain,
        organizationName,
        verificationMethod,
        ssoEnabled: !!ssoConfig,
      },
    });

    // Prepare verification instructions based on method
    let verificationInstructions = {};

    if (verificationMethod === 'dns') {
      verificationInstructions = {
        type: 'dns',
        record: {
          type: 'TXT',
          name: `_appwrite-verification.${domain}`,
          value: verificationToken,
          ttl: 3600,
        },
        instructions:
          'Add the above DNS TXT record to your domain. This will be checked automatically.',
      };
    } else {
      verificationInstructions = {
        type: 'email',
        message: `A verification email will be sent to admin@${domain}. Click the link to verify.`,
      };
    }

    return context.res.json(
      {
        success: true,
        domain: {
          id: domainId,
          domain,
          organizationName,
          isVerified: false,
          verificationMethod,
        },
        verification: verificationInstructions,
        message: `Domain registered. Please complete verification via ${verificationMethod}.`,
      },
      200
    );
  } catch (error) {
    console.error('Error registering domain:', error);

    const userId = req.headers['x-appwrite-user-id'];
    if (userId) {
      await createAuditLog({
        eventCode: 'DOMAIN_REGISTER_FAILED',
        actorId: userId,
        metadata: {
          error: error.message,
        },
      });
    }

    return context.res.json(
      {
        error: 'Failed to register domain',
        code: 'REGISTER_FAILED',
        details: error.message,
      },
      500
    );
  }
}
