#!/usr/bin/env node

/**
 * Appwrite Bootstrap Script
 * 
 * This script initializes Appwrite with all required collections, buckets, and settings
 * for the Recognition app. Run this after setting up Appwrite with Google/Microsoft OAuth.
 * 
 * Usage:
 *   node scripts/bootstrap-appwrite.js
 *   
 * Environment Variables Required:
 *   APPWRITE_ENDPOINT - Appwrite API endpoint (e.g., https://appwrite.example.com/v1)
 *   APPWRITE_PROJECT_ID - Appwrite project ID
 *   APPWRITE_API_KEY - Appwrite API key
 *   DATABASE_ID - Database ID (default: "main")
 */

const { Client, Databases, Storage } = require('node-appwrite');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../.env.production') });
require('dotenv').config({ path: path.join(__dirname, '../.env.development') });
require('dotenv').config({ path: path.join(__dirname, '../apps/api/.env.development') });

// Configuration
const APPWRITE_ENDPOINT = process.env.APPWRITE_ENDPOINT || 'http://localhost/v1';
const APPWRITE_PROJECT_ID = process.env.APPWRITE_PROJECT_ID;
const APPWRITE_API_KEY = process.env.APPWRITE_API_KEY;
const DATABASE_ID = process.env.DATABASE_ID || 'main';

// Validate environment
if (!APPWRITE_PROJECT_ID || !APPWRITE_API_KEY) {
  console.error('❌ Error: Missing required environment variables');
  console.error('   APPWRITE_PROJECT_ID: ' + (APPWRITE_PROJECT_ID ? '✓' : '✗'));
  console.error('   APPWRITE_API_KEY: ' + (APPWRITE_API_KEY ? '✓' : '✗'));
  process.exit(1);
}

console.log('🚀 Appwrite Bootstrap Starting...');
console.log(`   Endpoint: ${APPWRITE_ENDPOINT}`);
console.log(`   Project: ${APPWRITE_PROJECT_ID}`);
console.log(`   Database: ${DATABASE_ID}`);

// Initialize Appwrite client
const client = new Client()
  .setEndpoint(APPWRITE_ENDPOINT)
  .setProject(APPWRITE_PROJECT_ID)
  .setKey(APPWRITE_API_KEY);

const databases = new Databases(client);
const storage = new Storage(client);

// Collection schemas
const COLLECTIONS = {
  users: {
    id: 'users',
    name: 'Users',
    attributes: [
      { name: 'email', type: 'string', required: true },
      { name: 'name', type: 'string', required: true },
      { name: 'avatar', type: 'string', required: false },
      { name: 'role', type: 'enum', enums: ['USER', 'MANAGER', 'ADMIN'], required: true, default: 'USER' },
      { name: 'department', type: 'string', required: false },
      { name: 'managerId', type: 'string', required: false },
      { name: 'createdAt', type: 'datetime', required: true },
      { name: 'updatedAt', type: 'datetime', required: true },
    ],
    indexes: [
      { name: 'email_idx', type: 'key', attributes: ['email'] },
      { name: 'role_idx', type: 'key', attributes: ['role'] },
    ]
  },

  recognitions: {
    id: 'recognitions',
    name: 'Recognitions',
    attributes: [
      { name: 'giverId', type: 'string', required: true },
      { name: 'giverName', type: 'string', required: true },
      { name: 'giverEmail', type: 'string', required: true },
      { name: 'recipientEmail', type: 'string', required: true },
      { name: 'tags', type: 'string', array: true, required: true },
      { name: 'reason', type: 'string', required: true },
      { name: 'visibility', type: 'enum', enums: ['PRIVATE', 'TEAM', 'PUBLIC'], required: true, default: 'PRIVATE' },
      { name: 'evidenceIds', type: 'string', array: true, required: false },
      { name: 'weight', type: 'float', required: true, default: 1.0 },
      { name: 'originalWeight', type: 'float', required: false },
      { name: 'status', type: 'enum', enums: ['PENDING', 'VERIFIED', 'REJECTED'], required: true, default: 'PENDING' },
      { name: 'verified', type: 'boolean', required: true, default: false },
      { name: 'verifierId', type: 'string', required: false },
      { name: 'verificationNote', type: 'string', required: false },
      { name: 'verifiedAt', type: 'datetime', required: false },
      { name: 'abuseFlags', type: 'integer', required: false, default: 0 },
      { name: 'createdAt', type: 'datetime', required: true },
      { name: 'updatedAt', type: 'datetime', required: true },
    ],
    indexes: [
      { name: 'giverId_idx', type: 'key', attributes: ['giverId'] },
      { name: 'recipientEmail_idx', type: 'key', attributes: ['recipientEmail'] },
      { name: 'createdAt_idx', type: 'key', attributes: ['createdAt'] },
      { name: 'status_idx', type: 'key', attributes: ['status'] },
    ]
  },

  audit_entries: {
    id: 'audit_entries',
    name: 'Audit Entries',
    attributes: [
      { name: 'eventCode', type: 'string', required: true },
      { name: 'actorId', type: 'string', required: true },
      { name: 'targetId', type: 'string', required: false },
      { name: 'metadata', type: 'string', required: false },
      { name: 'ipAddress', type: 'string', required: false },
      { name: 'userAgent', type: 'string', required: false },
      { name: 'createdAt', type: 'datetime', required: true },
    ],
    indexes: [
      { name: 'eventCode_idx', type: 'key', attributes: ['eventCode'] },
      { name: 'actorId_idx', type: 'key', attributes: ['actorId'] },
      { name: 'targetId_idx', type: 'key', attributes: ['targetId'] },
      { name: 'createdAt_idx', type: 'key', attributes: ['createdAt'] },
    ]
  },

  abuse_flags: {
    id: 'abuse_flags',
    name: 'Abuse Flags',
    attributes: [
      { name: 'recognitionId', type: 'string', required: true },
      { name: 'flagType', type: 'enum', enums: ['RECIPROCITY', 'FREQUENCY', 'CONTENT', 'EVIDENCE', 'WEIGHT_MANIPULATION', 'MANUAL'], required: true },
      { name: 'severity', type: 'enum', enums: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], required: true },
      { name: 'description', type: 'string', required: true },
      { name: 'detectionMethod', type: 'enum', enums: ['AUTOMATIC', 'REPORTED', 'MANUAL_REVIEW'], required: true },
      { name: 'flaggedBy', type: 'enum', enums: ['SYSTEM', 'USER', 'ADMIN'], required: true },
      { name: 'status', type: 'enum', enums: ['PENDING', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED'], required: true, default: 'PENDING' },
      { name: 'reviewedBy', type: 'string', required: false },
      { name: 'reviewedAt', type: 'datetime', required: false },
      { name: 'reviewNotes', type: 'string', required: false },
      { name: 'originalWeight', type: 'float', required: false },
      { name: 'adjustedWeight', type: 'float', required: false },
      { name: 'createdAt', type: 'datetime', required: true },
      { name: 'updatedAt', type: 'datetime', required: true },
    ],
    indexes: [
      { name: 'recognitionId_idx', type: 'key', attributes: ['recognitionId'] },
      { name: 'status_idx', type: 'key', attributes: ['status'] },
      { name: 'severity_idx', type: 'key', attributes: ['severity'] },
    ]
  },

  telemetry_events: {
    id: 'telemetry_events',
    name: 'Telemetry Events',
    attributes: [
      { name: 'eventType', type: 'string', required: true },
      { name: 'hashedUserId', type: 'string', required: true },
      { name: 'hashedTargetId', type: 'string', required: false },
      { name: 'metadata', type: 'string', required: false },
      { name: 'timestamp', type: 'datetime', required: true },
    ],
    indexes: [
      { name: 'eventType_idx', type: 'key', attributes: ['eventType'] },
      { name: 'hashedUserId_idx', type: 'key', attributes: ['hashedUserId'] },
      { name: 'timestamp_idx', type: 'key', attributes: ['timestamp'] },
    ]
  },

  rate_limit_breaches: {
    id: 'rate_limit_breaches',
    name: 'Rate Limit Breaches',
    attributes: [
      { name: 'limitKey', type: 'string', required: true },
      { name: 'limitType', type: 'string', required: true },
      { name: 'breachedAt', type: 'datetime', required: true },
      { name: 'resetAt', type: 'datetime', required: true },
      { name: 'metadata', type: 'string', required: false },
      { name: 'createdAt', type: 'datetime', required: true },
    ],
    indexes: [
      { name: 'limitType_idx', type: 'key', attributes: ['limitType'] },
      { name: 'createdAt_idx', type: 'key', attributes: ['createdAt'] },
    ]
  },
};

// Storage buckets
const BUCKETS = {
  evidence: {
    id: 'evidence',
    name: 'Evidence Files',
    permissions: [
      'create("users")',
      'read("any")',
      'update("users")',
      'delete("users")'
    ],
    fileSecurity: true,
  },
  exports: {
    id: 'exports',
    name: 'Exported Profiles',
    permissions: [
      'create("users")',
      'read("users")',
      'delete("users")'
    ],
    fileSecurity: true,
  },
};

/**
 * Create or update a collection
 */
async function createCollection(collectionConfig) {
  try {
    // Check if collection already exists
    try {
      await databases.getCollection(DATABASE_ID, collectionConfig.id);
      console.log(`   ℹ️  Collection "${collectionConfig.name}" already exists, skipping...`);
      return;
    } catch {
      // Collection doesn't exist, continue with creation
    }

    console.log(`   📝 Creating collection: ${collectionConfig.name}`);
    
    // Create collection
    await databases.createCollection(
      DATABASE_ID,
      collectionConfig.id,
      collectionConfig.name
    );

    console.log(`      ✓ Collection created`);

    // Add attributes
    for (const attr of collectionConfig.attributes) {
      try {
        if (attr.type === 'enum') {
          await databases.createEnumAttribute(
            DATABASE_ID,
            collectionConfig.id,
            attr.name,
            attr.enums,
            attr.required || false,
            attr.default
          );
        } else if (attr.type === 'datetime') {
          await databases.createDatetimeAttribute(
            DATABASE_ID,
            collectionConfig.id,
            attr.name,
            attr.required || false,
            attr.default
          );
        } else if (attr.type === 'float') {
          await databases.createFloatAttribute(
            DATABASE_ID,
            collectionConfig.id,
            attr.name,
            attr.required || false,
            attr.default
          );
        } else if (attr.type === 'integer') {
          await databases.createIntegerAttribute(
            DATABASE_ID,
            collectionConfig.id,
            attr.name,
            attr.required || false,
            attr.default
          );
        } else if (attr.type === 'boolean') {
          await databases.createBooleanAttribute(
            DATABASE_ID,
            collectionConfig.id,
            attr.name,
            attr.required || false,
            attr.default
          );
        } else {
          // string type with optional array
          if (attr.array) {
            await databases.createStringAttribute(
              DATABASE_ID,
              collectionConfig.id,
              attr.name,
              255, // size
              attr.required || false,
              null, // default
              true  // array
            );
          } else {
            await databases.createStringAttribute(
              DATABASE_ID,
              collectionConfig.id,
              attr.name,
              1024, // size
              attr.required || false,
              attr.default,
              false // array
            );
          }
        }
      } catch (err) {
        if (err.message.includes('already exists')) {
          // Attribute already exists, continue
        } else {
          console.error(`      ✗ Error creating attribute ${attr.name}:`, err.message);
        }
      }
    }

    console.log(`      ✓ Collection fully configured`);
  } catch (error) {
    console.error(`   ✗ Error creating collection "${collectionConfig.name}":`, error.message);
  }
}

/**
 * Create or update a storage bucket
 */
async function createBucket(bucketConfig) {
  try {
    // Check if bucket already exists
    try {
      await storage.getBucket(bucketConfig.id);
      console.log(`   ℹ️  Bucket "${bucketConfig.name}" already exists, skipping...`);
      return;
    } catch {
      // Bucket doesn't exist, continue with creation
    }

    console.log(`   📁 Creating bucket: ${bucketConfig.name}`);
    
    await storage.createBucket(
      bucketConfig.id,
      bucketConfig.name,
      bucketConfig.permissions || [],
      bucketConfig.fileSecurity || false
    );

    console.log(`      ✓ Bucket created`);
  } catch (error) {
    console.error(`   ✗ Error creating bucket "${bucketConfig.name}":`, error.message);
  }
}

/**
 * Main bootstrap function
 */
async function bootstrap() {
  try {
    console.log('\n📦 Setting up Database Collections...\n');
    
    // Create all collections
    for (const config of Object.values(COLLECTIONS)) {
      await createCollection(config);
    }

    console.log('\n📦 Setting up Storage Buckets...\n');
    
    // Create all buckets
    for (const config of Object.values(BUCKETS)) {
      await createBucket(config);
    }

    console.log('\n✅ Appwrite Bootstrap Complete!\n');
    console.log('Next steps:');
    console.log('  1. Verify all collections and buckets in Appwrite Console');
    console.log('  2. Deploy API functions: npm run build:api');
    console.log('  3. Start the development server: npm run dev');
    console.log('  4. Test authentication: http://localhost:3000/sign-in');
    console.log('  5. Seed test data: npm run dev:seed');
    console.log('');

  } catch (error) {
    console.error('\n❌ Bootstrap failed:', error.message);
    process.exit(1);
  }
}

// Run bootstrap
bootstrap();
