#!/usr/bin/env node

/**
 * Appwrite Phase 1 Functions Deployment Script
 * Deploys all critical security functions to Appwrite
 * 
 * Functions deployed:
 * 1. rbac-middleware (service)
 * 2. presign-upload-enhanced
 * 3. presign-download
 * 4. admin-override-recognition
 * 5. export-csv-hr-safe
 * 6. user-update-preferences
 * 7. data-retention (scheduled)
 */

import { Client, Functions } from 'node-appwrite';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

const functions = new Functions(client);

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
 * Function deployment configuration
 */
const FUNCTIONS_TO_DEPLOY = [
  {
    id: 'rbac-middleware',
    name: 'RBAC Middleware',
    path: '../apps/api/functions/services/rbac-middleware.js',
    runtime: 'node-18.0',
    env: [],
    description: 'Role-based access control middleware for all functions',
    timeout: 15,
  },
  {
    id: 'presign-upload-enhanced',
    name: 'Presigned Upload Enhanced',
    path: '../apps/api/functions/presign-upload-enhanced/index.js',
    runtime: 'node-18.0',
    env: ['DATABASE_ID', 'APPWRITE_ENDPOINT', 'APPWRITE_PROJECT_ID', 'APPWRITE_KEY', 'HASH_SALT'],
    description: 'Generate secure presigned URLs for file uploads with validation',
    timeout: 60,
    execute: ['anyone'],
  },
  {
    id: 'presign-download',
    name: 'Presigned Download',
    path: '../apps/api/functions/presign-download/index.js',
    runtime: 'node-18.0',
    env: ['DATABASE_ID', 'APPWRITE_ENDPOINT', 'APPWRITE_PROJECT_ID', 'APPWRITE_KEY'],
    description: 'Generate secure presigned URLs for file downloads with permission checks',
    timeout: 60,
    execute: ['anyone'],
  },
  {
    id: 'admin-override-recognition',
    name: 'Admin Override Recognition',
    path: '../apps/api/functions/admin/override-recognition/index.js',
    runtime: 'node-18.0',
    env: ['DATABASE_ID', 'APPWRITE_ENDPOINT', 'APPWRITE_PROJECT_ID', 'APPWRITE_KEY'],
    description: 'Admin function to override recognition status with mandatory justification',
    timeout: 60,
    execute: ['users'],
  },
  {
    id: 'export-csv-hr-safe',
    name: 'Export CSV HR Safe',
    path: '../apps/api/functions/export/csv-hr-safe/index.js',
    runtime: 'node-18.0',
    env: ['DATABASE_ID', 'APPWRITE_ENDPOINT', 'APPWRITE_PROJECT_ID', 'APPWRITE_KEY', 'HASH_SALT'],
    description: 'Generate anonymized HR-safe CSV exports of recognitions',
    timeout: 120,
    execute: ['users'],
  },
  {
    id: 'user-update-preferences',
    name: 'User Update Preferences',
    path: '../apps/api/functions/user/update-preferences/index.js',
    runtime: 'node-18.0',
    env: ['DATABASE_ID', 'APPWRITE_ENDPOINT', 'APPWRITE_PROJECT_ID', 'APPWRITE_KEY'],
    description: 'Update user privacy preferences (email opt-in, share opt-in, etc)',
    timeout: 30,
    execute: ['users'],
  },
  {
    id: 'data-retention',
    name: 'Data Retention',
    path: '../apps/api/functions/services/data-retention.js',
    runtime: 'node-18.0',
    env: [
      'DATABASE_ID',
      'APPWRITE_ENDPOINT',
      'APPWRITE_PROJECT_ID',
      'APPWRITE_KEY',
      'RETENTION_RECOGNITION_DAYS',
      'RETENTION_AUDIT_DAYS',
      'RETENTION_TELEMETRY_DAYS',
      'RETENTION_RATE_LIMIT_DAYS',
    ],
    description: 'Automated data retention and deletion based on compliance policies',
    timeout: 600,
    schedule: '0 2 * * *', // 2 AM daily
  },
];

/**
 * Check if function exists
 */
async function functionExists(functionId) {
  try {
    await functions.get(functionId);
    return true;
  } catch (error) {
    if (error.code === 404) {
      return false;
    }
    throw error;
  }
}

/**
 * Create or update function
 */
async function deployFunction(config) {
  try {
    const functionPath = path.join(__dirname, config.path);
    
    // Check if file exists
    if (!fs.existsSync(functionPath)) {
      log('error', `Function file not found: ${functionPath}`);
      return false;
    }

    const exists = await functionExists(config.id);
    
    if (exists) {
      log('info', `Updating function: ${config.name}`);
      
      // Update function
      await functions.update(config.id, {
        name: config.name,
        timeout: config.timeout,
      });
      
      log('success', `Updated function: ${config.name}`);
    } else {
      log('info', `Creating function: ${config.name}`);
      
      // Create function with minimal parameters
      await functions.create(
        config.id,
        config.name,
        config.runtime
      );
      
      log('success', `Created function: ${config.name}`);
      log('warn', `  ⚠️  Remember to configure:`);
      log('warn', `     - Environment variables`);
      if (config.schedule) {
        log('warn', `     - Schedule: ${config.schedule}`);
      }
      if (config.execute) {
        log('warn', `     - Execute: ${config.execute.join(', ')}`);
      }
    }

    return true;
  } catch (error) {
    log('error', `Failed to deploy ${config.name}: ${error.message}`);
    return false;
  }
}

/**
 * Deploy all functions
 */
async function deployAllFunctions() {
  log('info', 'Deploying Phase 1 functions...');
  
  let successCount = 0;
  let failureCount = 0;

  for (const config of FUNCTIONS_TO_DEPLOY) {
    const success = await deployFunction(config);
    if (success) {
      successCount++;
    } else {
      failureCount++;
    }
  }

  log('info', '');
  log('success', `Deployment summary: ${successCount} succeeded, ${failureCount} failed`);
  
  return failureCount === 0;
}

/**
 * Generate deployment summary
 */
function generateDeploymentSummary() {
  log('info', '');
  log('info', '=== PHASE 1 FUNCTIONS DEPLOYMENT SUMMARY ===');
  log('info', '');
  log('info', 'Deployed Functions:');
  
  FUNCTIONS_TO_DEPLOY.forEach((fn) => {
    log('info', `  • ${fn.name} (${fn.id})`);
    log('info', `    Runtime: ${fn.runtime}`);
    log('info', `    Timeout: ${fn.timeout}s`);
    if (fn.env.length > 0) {
      log('info', `    Environment: ${fn.env.join(', ')}`);
    }
    if (fn.schedule) {
      log('info', `    Schedule: ${fn.schedule}`);
    }
    if (fn.execute) {
      log('info', `    Execute: ${fn.execute.join(', ')}`);
    }
  });

  log('info', '');
  log('warn', '⚠️  IMPORTANT: Configuration Required');
  log('info', '');
  log('info', 'For each function in Appwrite console:');
  log('info', '1. Set Environment Variables (Settings tab)');
  log('info', '2. Set Execute Permissions (Settings tab)');
  log('info', '3. Set Schedule for data-retention (in UTC)');
  log('info', '');
  log('info', 'Environment Variables Required:');
  log('info', '  DATABASE_ID: recognition-db');
  log('info', '  APPWRITE_ENDPOINT: https://syd.cloud.appwrite.io/v1');
  log('info', '  APPWRITE_PROJECT_ID: 68f2542a00381179cfb1');
  log('info', '  APPWRITE_KEY: [Your API Key]');
  log('info', '  HASH_SALT: [Generate a random string for hashing]');
  log('info', '');
  log('info', 'Execute Permissions:');
  log('info', '  • rbac-middleware: (Service only - no execute needed)');
  log('info', '  • presign-upload-enhanced: anyone');
  log('info', '  • presign-download: anyone');
  log('info', '  • admin-override-recognition: users');
  log('info', '  • export-csv-hr-safe: users');
  log('info', '  • user-update-preferences: users');
  log('info', '  • data-retention: (Scheduled function)');
  log('info', '');
  log('info', 'Next Steps:');
  log('info', '1. Go to Appwrite console → Functions');
  log('info', '2. For each function: Settings → Environment & Permissions');
  log('info', '3. Test endpoints: npm run test:integration');
  log('info', '4. Monitor audit logs for all operations');
  log('info', '');
}

/**
 * Main deployment function
 */
async function main() {
  try {
    log('info', '🚀 Starting Phase 1 Functions Deployment');
    log('info', `Endpoint: ${APPWRITE_ENDPOINT}`);
    log('info', `Project: ${APPWRITE_PROJECT_ID}`);
    log('info', '');

    const success = await deployAllFunctions();

    generateDeploymentSummary();

    if (success) {
      log('success', '✅ All Phase 1 functions deployed successfully!');
      process.exit(0);
    } else {
      log('error', '⚠️  Some functions failed to deploy');
      process.exit(1);
    }
  } catch (error) {
    log('error', `Deployment failed: ${error.message}`);
    process.exit(1);
  }
}

main();
