#!/usr/bin/env node

/**
 * Appwrite Phase 2 Schema Migration Script
 * Adds new collections and fields for opt-outs, sharing, policies
 * 
 * New Collections:
 * - recognition-shares: Shareable links with access tracking
 * - domains: Organization domain configurations
 * - compliance-policies: Organization compliance policies
 * 
 * Updated Collections:
 * - users: Add shareable link preferences
 */

import { Client, Databases } from 'node-appwrite';

const APPWRITE_ENDPOINT = process.env.APPWRITE_ENDPOINT || 'https://syd.cloud.appwrite.io/v1';
const APPWRITE_PROJECT_ID = process.env.APPWRITE_PROJECT_ID || '';
const APPWRITE_KEY = process.env.APPWRITE_KEY || '';

if (!APPWRITE_PROJECT_ID || !APPWRITE_KEY) {
  console.error('❌ Missing APPWRITE_PROJECT_ID or APPWRITE_KEY');
  process.exit(1);
}

const client = new Client()
  .setEndpoint(APPWRITE_ENDPOINT)
  .setProject(APPWRITE_PROJECT_ID)
  .setKey(APPWRITE_KEY);

const databases = new Databases(client);
const DATABASE_ID = 'recognition-db';

function log(level, message) {
  const colors = {
    info: '\x1b[36m',    // cyan
    success: '\x1b[32m', // green
    warn: '\x1b[33m',    // yellow
    error: '\x1b[31m',   // red
    reset: '\x1b[0m',
  };

  const color = colors[level] || colors.info;
  console.log(`${color}[${level.toUpperCase()}]${colors.reset} ${message}`);
}

/**
 * Create string attribute safely
 */
async function createStringAttr(collectionId, key, size = 255, indexed = false) {
  try {
    await databases.createStringAttribute(
      DATABASE_ID,
      collectionId,
      key,
      size,
      false,  // required
      null,   // default
      indexed // indexed
    );
    log('success', `Created attribute: ${collectionId}.${key}`);
  } catch (error) {
    if (error.message?.includes('already exists')) {
      log('warn', `Attribute already exists: ${collectionId}.${key}`);
    } else {
      log('error', `Failed to create ${collectionId}.${key}: ${error.message}`);
    }
  }
}

/**
 * Create boolean attribute safely
 */
async function createBooleanAttr(collectionId, key, defaultValue = false) {
  try {
    await databases.createBooleanAttribute(
      DATABASE_ID,
      collectionId,
      key,
      false,  // required
      defaultValue
    );
    log('success', `Created attribute: ${collectionId}.${key}`);
  } catch (error) {
    if (error.message?.includes('already exists')) {
      log('warn', `Attribute already exists: ${collectionId}.${key}`);
    } else {
      log('error', `Failed to create ${collectionId}.${key}: ${error.message}`);
    }
  }
}

/**
 * Create datetime attribute safely
 */
async function createDatetimeAttr(collectionId, key, indexed = false) {
  try {
    await databases.createDatetimeAttribute(
      DATABASE_ID,
      collectionId,
      key,
      false,  // required
      null,   // default
      indexed // indexed
    );
    log('success', `Created attribute: ${collectionId}.${key}`);
  } catch (error) {
    if (error.message?.includes('already exists')) {
      log('warn', `Attribute already exists: ${collectionId}.${key}`);
    } else {
      log('error', `Failed to create ${collectionId}.${key}: ${error.message}`);
    }
  }
}

/**
 * Create integer attribute safely
 */
async function createIntegerAttr(collectionId, key, indexed = false) {
  try {
    await databases.createIntegerAttribute(
      DATABASE_ID,
      collectionId,
      key,
      false,  // required
      null,   // default
      indexed // indexed
    );
    log('success', `Created attribute: ${collectionId}.${key}`);
  } catch (error) {
    if (error.message?.includes('already exists')) {
      log('warn', `Attribute already exists: ${collectionId}.${key}`);
    } else {
      log('error', `Failed to create ${collectionId}.${key}: ${error.message}`);
    }
  }
}

/**
 * Create collection safely
 */
async function createCollection(collectionId, name) {
  try {
    await databases.getCollection(DATABASE_ID, collectionId);
    log('success', `Collection already exists: ${collectionId}`);
  } catch (error) {
    if (error.code === 404) {
      try {
        await databases.createCollection(DATABASE_ID, collectionId, name);
        log('success', `Created collection: ${collectionId}`);
      } catch (createError) {
        log('error', `Failed to create ${collectionId}: ${createError.message}`);
      }
    }
  }
}

/**
 * Add Phase 2 schema updates
 */
async function addPhase2SchemaUpdates() {
  log('info', 'Adding Phase 2 schema updates...');

  // === RECOGNITION SHARES COLLECTION ===
  log('info', 'Setting up recognition-shares collection...');
  await createCollection('recognition-shares', 'Recognition Shares');
  await createStringAttr('recognition-shares', 'recognitionId', 255, true);
  await createStringAttr('recognition-shares', 'createdBy', 255, true);
  await createStringAttr('recognition-shares', 'shareToken', 255, true);
  await createStringAttr('recognition-shares', 'shareLink', 500, false);
  await createIntegerAttr('recognition-shares', 'ttlDays', false);
  await createDatetimeAttr('recognition-shares', 'expiresAt', true);
  await createBooleanAttr('recognition-shares', 'hasPassword', false);
  await createBooleanAttr('recognition-shares', 'includeVerifier', true);
  await createBooleanAttr('recognition-shares', 'isRevoked', false);
  await createIntegerAttr('recognition-shares', 'accessCount', false);
  await createDatetimeAttr('recognition-shares', 'lastAccessedAt', false);
  await createDatetimeAttr('recognition-shares', 'createdAt', true);

  // === DOMAINS COLLECTION ===
  log('info', 'Setting up domains collection...');
  await createCollection('domains', 'Organization Domains');
  await createStringAttr('domains', 'domain', 255, true);
  await createStringAttr('domains', 'organizationName', 500, false);
  await createStringAttr('domains', 'registeredBy', 255, false);
  await createDatetimeAttr('domains', 'registeredAt', true);
  await createStringAttr('domains', 'verificationMethod', 50, false);
  await createStringAttr('domains', 'verificationToken', 500, false);
  await createBooleanAttr('domains', 'isVerified', false);
  await createDatetimeAttr('domains', 'verifiedAt', false);
  await createBooleanAttr('domains', 'ssoEnabled', false);
  await createStringAttr('domains', 'ssoConfig', 2000, false);
  await createStringAttr('domains', 'emailRestriction', 255, false);
  await createStringAttr('domains', 'allowedRoles', 500, false);
  await createBooleanAttr('domains', 'isActive', false);
  await createStringAttr('domains', 'metadata', 2000, false);

  // === COMPLIANCE POLICIES COLLECTION ===
  log('info', 'Setting up compliance-policies collection...');
  await createCollection('compliance-policies', 'Compliance Policies');
  await createStringAttr('compliance-policies', 'organizationId', 255, true);
  await createStringAttr('compliance-policies', 'createdBy', 255, false);
  await createStringAttr('compliance-policies', 'updatedBy', 255, false);
  await createDatetimeAttr('compliance-policies', 'createdAt', false);
  await createDatetimeAttr('compliance-policies', 'updatedAt', false);
  // Policy fields (stored as JSON strings)
  await createStringAttr('compliance-policies', 'dataRetention', 2000, false);
  await createStringAttr('compliance-policies', 'evidenceRequirements', 2000, false);
  await createStringAttr('compliance-policies', 'verificationRequirements', 2000, false);
  await createStringAttr('compliance-policies', 'exportRestrictions', 2000, false);
  await createStringAttr('compliance-policies', 'userConsent', 2000, false);
  await createStringAttr('compliance-policies', 'versions', 5000, false);

  // === UPDATE USERS COLLECTION ===
  log('info', 'Updating users collection...');
  await createBooleanAttr('users', 'canCreateShareableLinks', true);
  await createBooleanAttr('users', 'canExportAuditLogs', false);
  await createBooleanAttr('users', 'canManagePolicies', false);
  await createStringAttr('users', 'domainId', 255, false);
  await createDatetimeAttr('users', 'lastLoginAt', false);
}

/**
 * Main migration function
 */
async function main() {
  try {
    log('info', 'Starting Phase 2 Schema Migration...');
    log('info', `Endpoint: ${APPWRITE_ENDPOINT}`);
    log('info', `Project ID: ${APPWRITE_PROJECT_ID}`);

    // Add Phase 2 schema updates
    await addPhase2SchemaUpdates();

    log('success', 'Phase 2 schema migration completed successfully!');
    log('info', 'New collections created:');
    log('info', '  • recognition-shares - Shareable links with access tracking');
    log('info', '  • domains - Organization domain configurations');
    log('info', '  • compliance-policies - Organization compliance policies');
    log('info', '');
    log('info', 'Next steps:');
    log('info', '1. Verify all fields in Appwrite console');
    log('info', '2. Deploy Phase 2 functions: npm run deploy:functions:phase2');
    log('info', '3. Run integration tests: npm run test:integration');
  } catch (error) {
    log('error', `Migration failed: ${error.message}`);
    process.exit(1);
  }
}

main().catch(error => {
  log('error', error.message);
  process.exit(1);
});
