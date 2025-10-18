#!/usr/bin/env node

/**
 * Appwrite Phase 1 Schema Migration Script
 * Adds new fields for override functionality, user preferences, and compliance
 * 
 * New Fields:
 * - recognitions: overriddenBy, overrideTimestamp, overrideJustification, overrideReason, previousStatus
 * - users: emailOptIn, shareOptIn, notificationFrequency, recognitionTypes, preferenceUpdatedAt
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
      defaultValue  // default
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
 * Add Phase 1 schema updates
 */
async function addPhase1SchemaUpdates() {
  log('info', 'Adding Phase 1 schema updates...');

  // === RECOGNITIONS COLLECTION ===
  log('info', 'Updating recognitions collection...');
  // Admin override fields
  await createStringAttr('recognitions', 'overriddenBy', 255, false);
  await createDatetimeAttr('recognitions', 'overrideTimestamp', false);
  await createStringAttr('recognitions', 'overrideJustification', 1000, false);
  await createStringAttr('recognitions', 'overrideReason', 255, false);
  await createStringAttr('recognitions', 'previousStatus', 255, false);
  
  // Additional fields for better tracking
  await createStringAttr('recognitions', 'verifiedBy', 255, false);
  await createDatetimeAttr('recognitions', 'verifiedAt', false);
  await createStringAttr('recognitions', 'recipientId', 255, true);
  await createStringAttr('recognitions', 'weight', 255, false);
  await createStringAttr('recognitions', 'evidenceIds', 2000, false);

  // === USERS COLLECTION ===
  log('info', 'Updating users collection...');
  // Privacy preferences
  await createBooleanAttr('users', 'emailOptIn', true);
  await createBooleanAttr('users', 'shareOptIn', false);
  await createStringAttr('users', 'notificationFrequency', 50, false);
  await createStringAttr('users', 'recognitionTypes', 500, false);
  await createDatetimeAttr('users', 'preferenceUpdatedAt', false);

  // === AUDIT ENTRIES COLLECTION ===
  log('info', 'Updating audit-entries collection...');
  // Enhanced audit fields
  await createStringAttr('audit-entries', 'metadata', 5000, false);
  await createStringAttr('audit-entries', 'previousValue', 2000, false);
  await createStringAttr('audit-entries', 'newValue', 2000, false);

  // === RECOGNITION ARCHIVES COLLECTION (for data retention) ===
  log('info', 'Setting up recognition-archives collection...');
  try {
    await databases.getCollection(DATABASE_ID, 'recognition-archives');
    log('success', 'Collection recognition-archives already exists');
  } catch (error) {
    if (error.code === 404) {
      try {
        await databases.createCollection(
          DATABASE_ID,
          'recognition-archives',
          'Recognition Archives'
        );
        log('success', 'Created collection: recognition-archives');
      } catch (createError) {
        log('error', `Failed to create recognition-archives: ${createError.message}`);
      }
    }
  }

  // Add archive collection attributes
  await createStringAttr('recognition-archives', 'giverId', 255, true);
  await createStringAttr('recognition-archives', 'recipientId', 255, true);
  await createStringAttr('recognition-archives', 'reason', 2000, false);
  await createStringAttr('recognition-archives', 'status', 255, false);
  await createDatetimeAttr('recognition-archives', 'createdAt', true);
  await createDatetimeAttr('recognition-archives', 'archivedAt', true);
  await createStringAttr('recognition-archives', 'archivedReason', 255, false);
}

/**
 * Verify schema updates
 */
async function verifySchemaUpdates() {
  log('info', 'Verifying schema updates...');

  const collectionsToCheck = [
    { id: 'recognitions', fields: ['overriddenBy', 'overrideTimestamp', 'verifiedBy', 'recipientId'] },
    { id: 'users', fields: ['emailOptIn', 'shareOptIn', 'notificationFrequency'] },
    { id: 'audit-entries', fields: ['metadata', 'previousValue'] },
    { id: 'recognition-archives', fields: ['archivedAt', 'archivedReason'] },
  ];

  for (const collection of collectionsToCheck) {
    try {
      const collectionData = await databases.getCollection(DATABASE_ID, collection.id);
      const attributes = collectionData.attributes || [];
      const attributeKeys = attributes.map((attr) => attr.key);

      log('info', `Collection "${collection.id}" attributes:`);
      for (const field of collection.fields) {
        if (attributeKeys.includes(field)) {
          log('success', `  ✓ ${field}`);
        } else {
          log('warn', `  ✗ ${field} (not found)`);
        }
      }
    } catch (error) {
      log('error', `Failed to verify collection ${collection.id}: ${error.message}`);
    }
  }
}

/**
 * Main migration function
 */
async function main() {
  try {
    log('info', 'Starting Phase 1 Schema Migration...');
    log('info', `Endpoint: ${APPWRITE_ENDPOINT}`);
    log('info', `Project ID: ${APPWRITE_PROJECT_ID}`);

    // Add Phase 1 schema updates
    await addPhase1SchemaUpdates();

    // Verify updates
    await verifySchemaUpdates();

    log('success', 'Phase 1 schema migration completed successfully!');
    log('info', 'Next steps:');
    log('info', '1. Verify all fields in Appwrite console');
    log('info', '2. Deploy Phase 1 functions: npm run deploy:functions');
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
