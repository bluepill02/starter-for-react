#!/usr/bin/env node

/**
 * Appwrite Complete Integration Setup Script (V2 - Fixed)
 * This script sets up all required collections for the Recognition app
 */

import { Client, Databases, Storage } from 'node-appwrite';

// Configuration from environment
const APPWRITE_ENDPOINT = process.env.APPWRITE_ENDPOINT || 'https://syd.cloud.appwrite.io/v1';
const APPWRITE_PROJECT_ID = process.env.APPWRITE_PROJECT_ID || '';
const APPWRITE_KEY = process.env.APPWRITE_KEY || '';

if (!APPWRITE_PROJECT_ID || !APPWRITE_KEY) {
  console.error('❌ Missing APPWRITE_PROJECT_ID or APPWRITE_KEY');
  console.error('Please set these environment variables or update .env.development.example');
  process.exit(1);
}

// Initialize Appwrite client
const client = new Client()
  .setEndpoint(APPWRITE_ENDPOINT)
  .setProject(APPWRITE_PROJECT_ID)
  .setKey(APPWRITE_KEY);

const databases = new Databases(client);
const storage = new Storage(client);

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
 * Setup database
 */
async function setupDatabase() {
  try {
    log('info', `Setting up database: ${DATABASE_ID}`);
    try {
      await databases.get(DATABASE_ID);
      log('success', `Database already exists: ${DATABASE_ID}`);
    } catch (error) {
      if (error.code === 404) {
        await databases.create(DATABASE_ID, DATABASE_ID);
        log('success', `Created database: ${DATABASE_ID}`);
      } else {
        throw error;
      }
    }
  } catch (error) {
    log('error', `Failed to setup database: ${error.message}`);
    throw error;
  }
}

/**
 * Create collection with basic schema
 */
async function setupCollection(collectionId, collectionName) {
  try {
    log('info', `Setting up collection: ${collectionId}`);
    try {
      await databases.getCollection(DATABASE_ID, collectionId);
      log('success', `Collection already exists: ${collectionId}`);
    } catch (error) {
      if (error.code === 404) {
        await databases.createCollection(DATABASE_ID, collectionId, collectionName);
        log('success', `Created collection: ${collectionId}`);
      } else {
        throw error;
      }
    }
  } catch (error) {
    log('error', `Failed to create collection ${collectionId}: ${error.message}`);
  }
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
 * Create email attribute safely
 */
async function createEmailAttr(collectionId, key, indexed = false) {
  try {
    await databases.createEmailAttribute(
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
 * Setup all collections and their attributes
 */
async function setupCollections() {
  // Create collections
  log('info', 'Setting up collections...');
  await setupCollection('recognitions', 'Recognition Records');
  await setupCollection('users', 'User Profiles');
  await setupCollection('teams', 'Teams');
  await setupCollection('abuse-flags', 'Abuse Flags');
  await setupCollection('audit-entries', 'Audit Entries');
  await setupCollection('telemetry-events', 'Telemetry Events');
  await setupCollection('rate-limit-breaches', 'Rate Limit Breaches');

  // Add attributes to recognitions
  log('info', 'Adding attributes to recognitions...');
  await createStringAttr('recognitions', 'giverId', 255, true);
  await createStringAttr('recognitions', 'giverName');
  await createEmailAttr('recognitions', 'giverEmail', true);
  await createStringAttr('recognitions', 'recipientEmail', 255, true);
  await createStringAttr('recognitions', 'recipientName');
  await createStringAttr('recognitions', 'reason');
  await createStringAttr('recognitions', 'tags', 500);
  await createStringAttr('recognitions', 'visibility');
  await createStringAttr('recognitions', 'status');
  await createDatetimeAttr('recognitions', 'createdAt', true);
  await createDatetimeAttr('recognitions', 'updatedAt');

  // Add attributes to users
  log('info', 'Adding attributes to users...');
  await createEmailAttr('users', 'email', true);
  await createStringAttr('users', 'name');
  await createStringAttr('users', 'role');
  await createStringAttr('users', 'department');
  await createStringAttr('users', 'managerId');
  await createDatetimeAttr('users', 'createdAt', true);

  // Add attributes to abuse-flags
  log('info', 'Adding attributes to abuse-flags...');
  await createStringAttr('abuse-flags', 'recognitionId', 255, true);
  await createStringAttr('abuse-flags', 'flagType');
  await createStringAttr('abuse-flags', 'severity');
  await createStringAttr('abuse-flags', 'description');
  await createStringAttr('abuse-flags', 'status');
  await createDatetimeAttr('abuse-flags', 'createdAt', true);

  // Add attributes to audit-entries
  log('info', 'Adding attributes to audit-entries...');
  await createStringAttr('audit-entries', 'eventCode', 255, true);
  await createStringAttr('audit-entries', 'actorId', 255, true);
  await createStringAttr('audit-entries', 'targetId');
  await createStringAttr('audit-entries', 'ipAddress');
  await createStringAttr('audit-entries', 'userAgent');
  await createDatetimeAttr('audit-entries', 'createdAt', true);

  // Add attributes to telemetry-events
  log('info', 'Adding attributes to telemetry-events...');
  await createStringAttr('telemetry-events', 'eventType', 255, true);
  await createStringAttr('telemetry-events', 'hashedUserId', 255, true);
  await createStringAttr('telemetry-events', 'hashedTargetId');
  await createDatetimeAttr('telemetry-events', 'timestamp', true);

  // Add attributes to rate-limit-breaches
  log('info', 'Adding attributes to rate-limit-breaches...');
  await createStringAttr('rate-limit-breaches', 'limitType', 255, true);
  await createStringAttr('rate-limit-breaches', 'limitKey');
  await createDatetimeAttr('rate-limit-breaches', 'breachedAt', true);
  await createDatetimeAttr('rate-limit-breaches', 'resetAt');
}

/**
 * Setup storage bucket
 */
async function setupStorageBucket() {
  try {
    log('info', 'Setting up storage bucket: evidence');
    try {
      await storage.getBucket('evidence');
      log('success', 'Storage bucket "evidence" already exists');
    } catch (error) {
      if (error.code === 404) {
        // Create bucket with proper parameters
        // Note: Appwrite Storage bucket doesn't have fileSecurity parameter
        await storage.createBucket('evidence', 'Evidence Files', [], 52428800, []);
        log('success', 'Created storage bucket: evidence');
      } else {
        throw error;
      }
    }
  } catch (error) {
    log('error', `Failed to setup storage bucket: ${error.message}`);
  }
}

/**
 * Main setup function
 */
async function main() {
  try {
    log('info', 'Starting Appwrite complete integration setup...');
    log('info', `Endpoint: ${APPWRITE_ENDPOINT}`);
    log('info', `Project ID: ${APPWRITE_PROJECT_ID}`);

    // Setup database and collections
    await setupDatabase();
    await setupCollections();
    await setupStorageBucket();

    log('success', 'Appwrite integration setup completed successfully!');
    log('info', 'Next steps:');
    log('info', '1. Run: npm run appwrite:test');
    log('info', '2. Verify all collections in Appwrite console');
    log('info', '3. Deploy functions: npm run build:api');
    log('info', '4. Start development: npm run dev:all');
  } catch (error) {
    log('error', `Setup failed: ${error.message}`);
    process.exit(1);
  }
}

// Run main function
main().catch(error => {
  log('error', error.message);
  process.exit(1);
});
