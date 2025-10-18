#!/usr/bin/env node

/**
 * Appwrite Complete Integration Setup Script
 * This script sets up all required collections, functions, and configurations
 * for full Appwrite integration with rate limiting, audit logging, and OAuth
 */

import { Client, Databases, Storage, ID } from 'node-appwrite';

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
const COLLECTIONS = {
  RECOGNITIONS: { id: 'recognitions', name: 'Recognitions' },
  USERS: { id: 'users', name: 'Users' },
  TEAMS: { id: 'teams', name: 'Teams' },
  ABUSE_FLAGS: { id: 'abuse-flags', name: 'Abuse Flags' },
  AUDIT_ENTRIES: { id: 'audit-entries', name: 'Audit Entries' },
  TELEMETRY_EVENTS: { id: 'telemetry-events', name: 'Telemetry Events' },
  RATE_LIMIT_BREACHES: { id: 'rate-limit-breaches', name: 'Rate Limit Breaches' },
};

const BUCKETS_CONFIG = {
  EVIDENCE: { id: 'evidence', name: 'Evidence Files', maxFileSize: 52428800 }, // 50MB
};

/**
 * Log with colors
 */
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
 * Create or get database
 */
async function setupDatabase() {
  try {
    log('info', `Setting up database: ${DATABASE_ID}`);

    // Try to get existing database
    try {
      await databases.get(DATABASE_ID);
      log('success', `Database already exists: ${DATABASE_ID}`);
    } catch (error) {
      if (error.code === 404) {
        // Database doesn't exist, create it
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
 * Create or get collection
 */
async function setupCollection(collectionKey) {
  try {
    const config = COLLECTIONS[collectionKey];
    log('info', `Setting up collection: ${config.id}`);

    // Try to get existing collection
    try {
      await databases.getCollection(DATABASE_ID, config.id);
      log('success', `Collection already exists: ${config.id}`);
      return;
    } catch (error) {
      if (error.code === 404) {
        // Collection doesn't exist, create it
        await databases.createCollection(
          DATABASE_ID,
          config.id,
          config.name
        );
        log('success', `Created collection: ${config.id}`);
      } else {
        throw error;
      }
    }
  } catch (error) {
    log('error', `Failed to setup collection: ${error.message}`);
    throw error;
  }
}

/**
 * Add attributes to collection
 */
async function addCollectionAttributes(collectionKey) {
  const config = COLLECTIONS[collectionKey];
  const attributes = getCollectionSchema(collectionKey);

  try {
    for (const attr of attributes) {
      try {
        // Try to get existing attribute
        await databases.getAttribute(DATABASE_ID, config.id, attr.key);
        log('info', `Attribute already exists: ${config.id}.${attr.key}`);
      } catch (error) {
        if (error.code === 404) {
          // Attribute doesn't exist, create it
          await createAttribute(DATABASE_ID, config.id, attr);
          log('success', `Created attribute: ${config.id}.${attr.key}`);
        } else {
          throw error;
        }
      }
    }
  } catch (error) {
    log('error', `Failed to add attributes to ${config.id}: ${error.message}`);
  }
}

/**
 * Create attribute based on type
 */
async function createAttribute(databaseId, collectionId, attr) {
  const { type, key, required = false, indexed = false, ...options } = attr;

  switch (type) {
    case 'string':
      await databases.createStringAttribute(
        databaseId,
        collectionId,
        key,
        options.size || 255,
        required,
        options.default,
        indexed
      );
      break;

    case 'email':
      await databases.createEmailAttribute(
        databaseId,
        collectionId,
        key,
        required,
        options.default,
        indexed
      );
      break;

    case 'datetime':
      await databases.createDatetimeAttribute(
        databaseId,
        collectionId,
        key,
        required,
        options.default,
        indexed
      );
      break;

    case 'integer':
      await databases.createIntegerAttribute(
        databaseId,
        collectionId,
        key,
        required,
        options.min,
        options.max,
        options.default,
        indexed
      );
      break;

    case 'float':
      await databases.createFloatAttribute(
        databaseId,
        collectionId,
        key,
        required,
        options.min,
        options.max,
        options.default,
        indexed
      );
      break;

    case 'boolean':
      await databases.createBooleanAttribute(
        databaseId,
        collectionId,
        key,
        required,
        options.default,
        indexed
      );
      break;

    case 'json':
      await databases.createJsonAttribute(
        databaseId,
        collectionId,
        key,
        required,
        options.default,
        indexed
      );
      break;

    default:
      throw new Error(`Unknown attribute type: ${type}`);
  }
}

/**
 * Get collection schema based on collection type
 */
function getCollectionSchema(collectionKey) {
  const schemas = {
    RECOGNITIONS: [
      { type: 'string', key: 'giverId', required: true, indexed: true },
      { type: 'string', key: 'giverName', required: true },
      { type: 'email', key: 'giverEmail', required: true, indexed: true },
      { type: 'string', key: 'recipientEmail', required: true, indexed: true, size: 255 },
      { type: 'string', key: 'reason', required: true, size: 2000 },
      { type: 'json', key: 'tags', required: false },
      { type: 'string', key: 'evidenceIds', required: false },
      { type: 'string', key: 'visibility', required: true, default: 'PRIVATE', indexed: true },
      { type: 'float', key: 'weight', required: true, default: 1.0 },
      { type: 'string', key: 'status', required: true, default: 'PENDING', indexed: true },
      { type: 'boolean', key: 'verified', required: false, default: false, indexed: true },
      { type: 'string', key: 'verifierId', required: false },
      { type: 'string', key: 'verificationNote', required: false },
      { type: 'datetime', key: 'verifiedAt', required: false, indexed: true },
      { type: 'datetime', key: 'createdAt', required: true, indexed: true },
      { type: 'datetime', key: 'updatedAt', required: true, indexed: true },
    ],
    USERS: [
      { type: 'string', key: 'email', required: true, indexed: true, size: 255 },
      { type: 'string', key: 'name', required: true, size: 255 },
      { type: 'string', key: 'role', required: true, default: 'USER', indexed: true },
      { type: 'string', key: 'department', required: false, size: 255 },
      { type: 'string', key: 'managerId', required: false, indexed: true },
      { type: 'datetime', key: 'createdAt', required: true, indexed: true },
      { type: 'datetime', key: 'updatedAt', required: true, indexed: true },
    ],
    ABUSE_FLAGS: [
      { type: 'string', key: 'recognitionId', required: true, indexed: true },
      { type: 'string', key: 'flagType', required: true, indexed: true },
      { type: 'string', key: 'severity', required: true, indexed: true },
      { type: 'string', key: 'description', required: true, size: 1000 },
      { type: 'string', key: 'status', required: true, default: 'PENDING', indexed: true },
      { type: 'string', key: 'reviewedBy', required: false, indexed: true },
      { type: 'string', key: 'reviewNotes', required: false, size: 1000 },
      { type: 'float', key: 'adjustedWeight', required: false },
      { type: 'datetime', key: 'createdAt', required: true, indexed: true },
      { type: 'datetime', key: 'updatedAt', required: true, indexed: true },
    ],
    AUDIT_ENTRIES: [
      { type: 'string', key: 'eventCode', required: true, indexed: true },
      { type: 'string', key: 'actorId', required: true, indexed: true },
      { type: 'string', key: 'targetId', required: false, indexed: true },
      { type: 'json', key: 'metadata', required: false },
      { type: 'string', key: 'ipAddress', required: false, indexed: true },
      { type: 'string', key: 'userAgent', required: false },
      { type: 'datetime', key: 'createdAt', required: true, indexed: true },
    ],
    TELEMETRY_EVENTS: [
      { type: 'string', key: 'eventType', required: true, indexed: true },
      { type: 'string', key: 'hashedUserId', required: true, indexed: true },
      { type: 'string', key: 'hashedTargetId', required: false, indexed: true },
      { type: 'json', key: 'metadata', required: false },
      { type: 'datetime', key: 'timestamp', required: true, indexed: true },
    ],
    RATE_LIMIT_BREACHES: [
      { type: 'string', key: 'limitKey', required: true, indexed: true },
      { type: 'string', key: 'limitType', required: true, indexed: true },
      { type: 'datetime', key: 'breachedAt', required: true, indexed: true },
      { type: 'datetime', key: 'resetAt', required: true },
      { type: 'json', key: 'metadata', required: false },
    ],
  };

  return schemas[collectionKey] || [];
}

/**
 * Setup storage bucket
 */
async function setupBucket(bucketKey) {
  try {
    const config = BUCKETS_CONFIG[bucketKey];
    log('info', `Setting up bucket: ${config.id}`);

    // Try to get existing bucket
    try {
      await storage.getBucket(config.id);
      log('success', `Bucket already exists: ${config.id}`);
    } catch (error) {
      if (error.code === 404) {
        // Bucket doesn't exist, create it
        await storage.createBucket(
          config.id,
          config.name,
          [], // Allowed file extensions (empty = all)
          config.maxFileSize,
          true // Enable encryption
        );
        log('success', `Created bucket: ${config.id}`);
      } else {
        throw error;
      }
    }
  } catch (error) {
    log('error', `Failed to setup bucket: ${error.message}`);
  }
}

/**
 * Main setup function
 */
async function main() {
  try {
    log('info', '🚀 Starting Appwrite complete integration setup...');
    log('info', `Endpoint: ${APPWRITE_ENDPOINT}`);
    log('info', `Project ID: ${APPWRITE_PROJECT_ID}`);
    console.log('');

    // Setup database
    await setupDatabase();
    console.log('');

    // Setup collections
    log('info', 'Setting up collections...');
    for (const collectionKey of Object.keys(COLLECTIONS)) {
      await setupCollection(collectionKey);
    }
    console.log('');

    // Add attributes to collections
    log('info', 'Adding collection attributes...');
    for (const collectionKey of Object.keys(COLLECTIONS)) {
      await addCollectionAttributes(collectionKey);
    }
    console.log('');

    // Setup storage buckets
    log('info', 'Setting up storage buckets...');
    for (const bucketKey of Object.keys(BUCKETS_CONFIG)) {
      await setupBucket(bucketKey);
    }
    console.log('');

    log('success', '✅ Appwrite integration setup completed successfully!');
    log('info', 'Collections created:');
    Object.values(COLLECTIONS).forEach(c => {
      console.log(`  • ${c.name} (${c.id})`);
    });
    log('info', 'Storage buckets created:');
    Object.values(BUCKETS_CONFIG).forEach(b => {
      console.log(`  • ${b.name} (${b.id})`);
    });
    console.log('');
    log('info', 'Next steps:');
    log('info', '1. Deploy Appwrite Functions: npm run build:api');
    log('info', '2. Configure Appwrite Function permissions');
    log('info', '3. Test OAuth integration: npm run dev');
    log('info', '4. Run integration tests: npm test:e2e');

  } catch (error) {
    log('error', `Setup failed: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
}

// Run setup
main();
