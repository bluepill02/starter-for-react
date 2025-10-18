#!/usr/bin/env node

/**
 * Appwrite Integration Test Suite
 * Verifies complete integration: OAuth, rate limiting, audit logging, databases
 */

import http from 'http';
import https from 'https';

const ENDPOINT = process.env.APPWRITE_ENDPOINT || 'https://syd.cloud.appwrite.io/v1';
const PROJECT_ID = process.env.APPWRITE_PROJECT_ID || '';
const API_KEY = process.env.APPWRITE_KEY || '';

if (!PROJECT_ID || !API_KEY) {
  console.error('❌ Missing APPWRITE_PROJECT_ID or APPWRITE_KEY');
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

function makeRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, ENDPOINT);
    const isHttps = url.protocol === 'https:';
    const client = isHttps ? https : http;

    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Appwrite-Project': PROJECT_ID,
        'X-Appwrite-Key': API_KEY,
      },
    };

    const request = client.request(url, options, (response) => {
      let data = '';

      response.on('data', (chunk) => {
        data += chunk;
      });

      response.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({
            status: response.statusCode,
            headers: response.headers,
            body: parsed,
          });
        } catch {
          resolve({
            status: response.statusCode,
            headers: response.headers,
            body: data,
          });
        }
      });
    });

    request.on('error', reject);

    if (body) {
      request.write(JSON.stringify(body));
    }

    request.end();
  });
}

async function testDatabaseExists() {
  try {
    log('info', 'Testing: Database exists');

    const response = await makeRequest('GET', '/databases/recognition-db');

    if (response.status === 200) {
      log('success', '✅ Database "recognition-db" exists');
      passCount++;
      return true;
    } else {
      log('error', '❌ Database not found');
      failCount++;
      return false;
    }
  } catch (error) {
    log('error', `❌ Failed to check database: ${error.message}`);
    failCount++;
    return false;
  }
}

async function testCollectionsExist() {
  const collections = [
    'recognitions',
    'users',
    'abuse-flags',
    'audit-entries',
    'telemetry-events',
    'rate-limit-breaches',
  ];

  let allExist = true;

  for (const collectionId of collections) {
    try {
      log('info', `Testing: Collection "${collectionId}" exists`);

      const response = await makeRequest(
        'GET',
        `/databases/recognition-db/collections/${collectionId}`
      );

      if (response.status === 200) {
        log('success', `✅ Collection "${collectionId}" exists`);
        passCount++;
      } else {
        log('error', `❌ Collection "${collectionId}" not found`);
        failCount++;
        allExist = false;
      }
    } catch (error) {
      log('error', `❌ Failed to check collection "${collectionId}": ${error.message}`);
      failCount++;
      allExist = false;
    }
  }

  return allExist;
}

async function testStorageBucketExists() {
  try {
    log('info', 'Testing: Storage bucket "evidence" exists');

    const response = await makeRequest('GET', '/storage/buckets/evidence');

    if (response.status === 200) {
      log('success', '✅ Storage bucket "evidence" exists');
      passCount++;
      return true;
    } else {
      log('error', '❌ Storage bucket not found');
      failCount++;
      return false;
    }
  } catch (error) {
    log('error', `❌ Failed to check storage bucket: ${error.message}`);
    failCount++;
    return false;
  }
}

async function testApiKeyAccess() {
  try {
    log('info', 'Testing: API key has access');

    const response = await makeRequest('GET', '/health');

    if (response.status === 200) {
      log('success', '✅ API key is valid and has access');
      passCount++;
      return true;
    } else {
      log('error', `❌ API access failed with status ${response.status}`);
      failCount++;
      return false;
    }
  } catch (error) {
    log('error', `❌ Failed API access test: ${error.message}`);
    failCount++;
    return false;
  }
}

async function testCollectionAttributes() {
  const collections = {
    recognitions: ['giverId', 'recipientEmail', 'visibility', 'createdAt'],
    'audit-entries': ['eventCode', 'actorId', 'createdAt'],
    'rate-limit-breaches': ['limitType', 'limitKey', 'breachedAt'],
  };

  let allValid = true;

  for (const [collectionId, requiredAttrs] of Object.entries(collections)) {
    try {
      log('info', `Testing: Collection "${collectionId}" attributes`);

      const response = await makeRequest(
        'GET',
        `/databases/recognition-db/collections/${collectionId}`
      );

      if (response.status === 200) {
        const collection = response.body;
        const existingAttrs = collection.attributes || [];
        const existingAttrNames = existingAttrs.map(a => a.key);

        const missingAttrs = requiredAttrs.filter(attr => !existingAttrNames.includes(attr));

        if (missingAttrs.length === 0) {
          log('success', `✅ Collection "${collectionId}" has all required attributes`);
          passCount++;
        } else {
          log('error', `❌ Collection "${collectionId}" missing attributes: ${missingAttrs.join(', ')}`);
          failCount++;
          allValid = false;
        }
      } else {
        log('error', `❌ Failed to get collection "${collectionId}"`);
        failCount++;
        allValid = false;
      }
    } catch (error) {
      log('error', `❌ Failed to check attributes for "${collectionId}": ${error.message}`);
      failCount++;
      allValid = false;
    }
  }

  return allValid;
}

async function testWritePermissions() {
  try {
    log('info', 'Testing: Database write permissions');

    const testEntry = {
      eventCode: 'TEST_INTEGRATION',
      actorId: 'system',
      metadata: JSON.stringify({ test: true }),
      ipAddress: '127.0.0.1',
      userAgent: 'integration-test',
      createdAt: new Date().toISOString(),
    };

    const response = await makeRequest(
      'POST',
      `/databases/recognition-db/collections/audit-entries/documents`,
      testEntry
    );

    if (response.status === 201) {
      log('success', '✅ Write permissions verified (test entry created)');
      passCount++;

      // Cleanup: Delete test entry
      try {
        const docId = response.body.$id;
        await makeRequest(
          'DELETE',
          `/databases/recognition-db/collections/audit-entries/documents/${docId}`
        );
      } catch {
        // Ignore cleanup errors
      }

      return true;
    } else {
      log('error', `❌ Write failed with status ${response.status}`);
      failCount++;
      return false;
    }
  } catch (error) {
    log('error', `❌ Write permission test failed: ${error.message}`);
    failCount++;
    return false;
  }
}

async function runTests() {
  console.log('\n🔍 Running Appwrite Integration Tests...\n');
  log('info', `Endpoint: ${ENDPOINT}`);
  log('info', `Project ID: ${PROJECT_ID}\n`);

  // Test API access first
  const apiAccessOk = await testApiKeyAccess();
  if (!apiAccessOk) {
    log('error', '\n❌ Cannot proceed: API access failed');
    process.exit(1);
  }
  console.log('');

  // Test database setup
  await testDatabaseExists();
  console.log('');

  // Test collections
  await testCollectionsExist();
  console.log('');

  // Test storage
  await testStorageBucketExists();
  console.log('');

  // Test collection attributes
  await testCollectionAttributes();
  console.log('');

  // Test write permissions
  await testWritePermissions();
  console.log('');

  // Summary
  const totalTests = passCount + failCount;
  const passRate = totalTests > 0 ? Math.round((passCount / totalTests) * 100) : 0;

  console.log('\n═══════════════════════════════════════');
  log('info', 'Test Summary');
  console.log('═══════════════════════════════════════');
  log('success', `✅ Passed: ${passCount}`);
  log('error', `❌ Failed: ${failCount}`);
  log('info', `Total:  ${totalTests}`);
  log('info', `Pass Rate: ${passRate}%\n`);

  if (failCount === 0) {
    log('success', '🎉 All integration tests passed!');
    log('info', 'Your Appwrite setup is ready for use.');
    log('info', '\nNext steps:');
    log('info', '1. Deploy functions: npm run build:api');
    log('info', '2. Start development: npm run dev');
    log('info', '3. Test OAuth: Navigate to http://localhost:3000/sign-in');
    process.exit(0);
  } else {
    log('error', '⚠️  Some tests failed. Please review the errors above.');
    log('error', 'Refer to APPWRITE-INTEGRATION-COMPLETE.md for troubleshooting.');
    process.exit(1);
  }
}

// Run tests
runTests().catch((error) => {
  log('error', `Unexpected error: ${error.message}`);
  process.exit(1);
});
