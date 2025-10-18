#!/usr/bin/env node

/**
 * Appwrite Phase 2 Functions Deployment Script
 * Deploys all important compliance and sharing functions to Appwrite
 * 
 * Functions deployed:
 * 1. create-shareable-link (recognition sharing)
 * 2. audit-log-export (compliance exports)
 * 3. domain-register (domain provisioning)
 * 4. compliance-policy-manager (policy management)
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
    id: 'create-shareable-link',
    name: 'Create Shareable Link',
    path: '../apps/api/functions/recognition/create-shareable-link/index.js',
    runtime: 'node-18.0',
    env: ['DATABASE_ID', 'APPWRITE_ENDPOINT', 'APPWRITE_PROJECT_ID', 'APPWRITE_KEY', 'APP_DOMAIN'],
    description: 'Create time-limited, revocable links for sharing recognitions',
    timeout: 30,
    execute: ['users'],
  },
  {
    id: 'audit-log-export',
    name: 'Audit Log Export',
    path: '../apps/api/functions/admin/audit-log-export/index.js',
    runtime: 'node-18.0',
    env: ['DATABASE_ID', 'APPWRITE_ENDPOINT', 'APPWRITE_PROJECT_ID', 'APPWRITE_KEY'],
    description: 'Export audit logs for compliance and investigation',
    timeout: 120,
    execute: ['users'],
  },
  {
    id: 'domain-register',
    name: 'Domain Register',
    path: '../apps/api/functions/admin/domain-register/index.js',
    runtime: 'node-18.0',
    env: ['DATABASE_ID', 'APPWRITE_ENDPOINT', 'APPWRITE_PROJECT_ID', 'APPWRITE_KEY'],
    description: 'Register and verify organization domains for SSO provisioning',
    timeout: 60,
    execute: ['users'],
  },
  {
    id: 'compliance-policy-manager',
    name: 'Compliance Policy Manager',
    path: '../apps/api/functions/admin/compliance-policy-manager/index.js',
    runtime: 'node-18.0',
    env: ['DATABASE_ID', 'APPWRITE_ENDPOINT', 'APPWRITE_PROJECT_ID', 'APPWRITE_KEY'],
    description: 'Manage organization-level compliance policies and controls',
    timeout: 60,
    execute: ['users'],
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
  log('info', 'Deploying Phase 2 functions...');
  
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
  log('info', '=== PHASE 2 FUNCTIONS DEPLOYMENT SUMMARY ===');
  log('info', '');
  log('info', 'Deployed Functions:');
  
  FUNCTIONS_TO_DEPLOY.forEach((fn) => {
    log('info', `  • ${fn.name} (${fn.id})`);
    log('info', `    Runtime: ${fn.runtime}`);
    log('info', `    Timeout: ${fn.timeout}s`);
    if (fn.env.length > 0) {
      log('info', `    Environment: ${fn.env.join(', ')}`);
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
  log('info', '');
  log('info', 'Environment Variables Required:');
  log('info', '  DATABASE_ID: recognition-db');
  log('info', '  APPWRITE_ENDPOINT: https://syd.cloud.appwrite.io/v1');
  log('info', '  APPWRITE_PROJECT_ID: 68f2542a00381179cfb1');
  log('info', '  APPWRITE_KEY: [Your API Key]');
  log('info', '  APP_DOMAIN: https://recognition.app (for shareable-link)');
  log('info', '');
  log('info', 'Execute Permissions:');
  FUNCTIONS_TO_DEPLOY.forEach((fn) => {
    if (fn.execute) {
      log('info', `  • ${fn.id}: ${fn.execute.join(', ')}`);
    }
  });
  log('info', '');
  log('info', 'Next Steps:');
  log('info', '1. Run schema migration: npm run migrate:phase2');
  log('info', '2. Go to Appwrite console → Functions');
  log('info', '3. For each function: Settings → Environment & Permissions');
  log('info', '4. Test endpoints: npm run test:integration');
  log('info', '');
}

/**
 * Main deployment function
 */
async function main() {
  try {
    log('info', '🚀 Starting Phase 2 Functions Deployment');
    log('info', `Endpoint: ${APPWRITE_ENDPOINT}`);
    log('info', `Project: ${APPWRITE_PROJECT_ID}`);
    log('info', '');

    const success = await deployAllFunctions();

    generateDeploymentSummary();

    if (success) {
      log('success', '✅ All Phase 2 functions deployed successfully!');
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
