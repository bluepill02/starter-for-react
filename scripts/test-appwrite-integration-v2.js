#!/usr/bin/env node

/**
 * Appwrite Integration Test Suite (V2 - Using SDK)
 * Verifies complete integration: databases, collections, storage
 */

import { Client, Databases, Storage } from 'node-appwrite';

const ENDPOINT = process.env.APPWRITE_ENDPOINT || 'https://syd.cloud.appwrite.io/v1';
const PROJECT_ID = process.env.APPWRITE_PROJECT_ID || '';
const API_KEY = process.env.APPWRITE_KEY || '';

if (!PROJECT_ID || !API_KEY) {
  console.error('Missing APPWRITE_PROJECT_ID or APPWRITE_KEY');
  process.exit(1);
}

let passCount = 0;
let failCount = 0;

function log(level, message) {
  const colors = {
    info: '\x1b[36m',
    success: '\x1b[32m',
    error: '\x1b[31m',
    warn: '\x1b[33m',
    reset: '\x1b[0m',
  };

  const color = colors[level] || colors.info;
  console.log(`${color}[${level.toUpperCase()}]${colors.reset} ${message}`);
}

function pass(message) {
  passCount++;
  log('success', `✅ ${message}`);
}

function fail(message) {
  failCount++;
  log('error', `❌ ${message}`);
}

// Initialize Appwrite client
const client = new Client()
  .setEndpoint(ENDPOINT)
  .setProject(PROJECT_ID)
  .setKey(API_KEY);

const databases = new Databases(client);
const storage = new Storage(client);

const DATABASE_ID = 'recognition-db';
const COLLECTIONS = [
  'recognitions',
  'users',
  'teams',
  'abuse-flags',
  'audit-entries',
  'telemetry-events',
  'rate-limit-breaches',
];

/**
 * Test: Database exists
 */
async function testDatabaseExists() {
  try {
    log('info', 'Testing: Database exists');
    const db = await databases.get(DATABASE_ID);
    if (db && db.$id === DATABASE_ID) {
      pass(`Database "${DATABASE_ID}" exists`);
    } else {
      fail(`Database "${DATABASE_ID}" not found`);
    }
  } catch (error) {
    fail(`Database check failed: ${error.message}`);
  }
}

/**
 * Test: Collections exist
 */
async function testCollectionsExist() {
  for (const collectionId of COLLECTIONS) {
    try {
      log('info', `Testing: Collection "${collectionId}" exists`);
      const collection = await databases.getCollection(DATABASE_ID, collectionId);
      if (collection && collection.$id === collectionId) {
        pass(`Collection "${collectionId}" exists`);
      } else {
        fail(`Collection "${collectionId}" not found`);
      }
    } catch (error) {
      fail(`Collection "${collectionId}" check failed: ${error.message}`);
    }
  }
}

/**
 * Test: Storage bucket exists
 */
async function testStorageBucketExists() {
  try {
    log('info', 'Testing: Storage bucket "evidence" exists');
    const bucket = await storage.getBucket('evidence');
    if (bucket && bucket.$id === 'evidence') {
      pass('Storage bucket "evidence" exists');
    } else {
      fail('Storage bucket "evidence" not found');
    }
  } catch (error) {
    if (error.code === 404) {
      fail('Storage bucket "evidence" not found - you may need to create it manually');
    } else {
      fail(`Storage bucket check failed: ${error.message}`);
    }
  }
}

/**
 * Test: Write to collection
 */
async function testWritePermissions() {
  try {
    log('info', 'Testing: Write permissions to "users" collection');
    const testUserId = `test-user-${Date.now()}`;
    
    const result = await databases.createDocument(
      DATABASE_ID,
      'users',
      testUserId,
      {
        email: `test-${Date.now()}@example.com`,
        name: 'Test User',
        role: 'user',
        department: 'Engineering',
      }
    );

    if (result && result.$id === testUserId) {
      pass('Write permissions verified - test document created');
      
      // Clean up - delete test document
      try {
        await databases.deleteDocument(DATABASE_ID, 'users', testUserId);
        log('info', 'Cleaned up test document');
      } catch (cleanupError) {
        log('warn', `Could not delete test document: ${cleanupError.message}`);
      }
    } else {
      fail('Write test failed - document not created properly');
    }
  } catch (error) {
    fail(`Write permissions test failed: ${error.message}`);
  }
}

/**
 * Main test runner
 */
async function main() {
  try {
    log('info', 'Starting Appwrite Integration Tests...\n');
    log('info', `Endpoint: ${ENDPOINT}`);
    log('info', `Project ID: ${PROJECT_ID}\n`);

    // Run tests
    await testDatabaseExists();
    await testCollectionsExist();
    await testStorageBucketExists();
    await testWritePermissions();

    // Print summary
    console.log('\n' + '='.repeat(50));
    log('info', `Tests completed:`);
    log('success', `✅ Passed: ${passCount}`);
    if (failCount > 0) {
      log('error', `❌ Failed: ${failCount}`);
    } else {
      log('success', `❌ Failed: ${failCount}`);
    }
    
    const total = passCount + failCount;
    const passRate = total > 0 ? Math.round((passCount / total) * 100) : 0;
    log('info', `Pass Rate: ${passRate}%`);
    console.log('='.repeat(50) + '\n');

    if (failCount === 0) {
      log('success', 'All integration tests passed!');
      process.exit(0);
    } else {
      log('warn', 'Some tests failed. Review the output above.');
      process.exit(1);
    }
  } catch (error) {
    log('error', `Fatal error: ${error.message}`);
    process.exit(1);
  }
}

// Run main
main().catch(error => {
  log('error', error.message);
  process.exit(1);
});
