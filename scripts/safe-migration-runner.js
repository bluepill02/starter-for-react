/**
 * Safe Migration Runner
 * Framework for safe, reversible database schema migrations
 * 
 * Features:
 * - Dry-run validation before execution
 * - Automatic backup creation
 * - Transaction-like behavior with rollback
 * - Migration state tracking
 * - Verification steps post-migration
 * - Detailed migration logs
 */

import fs from 'fs';
import path from 'path';
import { Client, Databases } from 'node-appwrite';

const client = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT)
  .setProject(process.env.APPWRITE_PROJECT_ID)
  .setKey(process.env.APPWRITE_KEY);

const databases = new Databases(client);

const DATABASE_ID = process.env.DATABASE_ID || 'recognition-db';
const MIGRATIONS_DIR = process.env.MIGRATIONS_DIR || './migrations';
const BACKUP_DIR = process.env.BACKUP_DIR || './backups';

/**
 * Ensure required directories exist
 */
function ensureDirectories() {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    fs.mkdirSync(MIGRATIONS_DIR, { recursive: true });
  }
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
}

/**
 * Migration state tracker (in-memory or file-based)
 */
class MigrationState {
  constructor() {
    this.stateFile = path.join(BACKUP_DIR, 'migration-state.json');
    this.state = this.loadState();
  }

  loadState() {
    try {
      if (fs.existsSync(this.stateFile)) {
        return JSON.parse(fs.readFileSync(this.stateFile, 'utf-8'));
      }
    } catch (error) {
      console.warn('Could not load migration state:', error.message);
    }
    return {
      completed: [],
      pending: [],
      failed: [],
    };
  }

  saveState() {
    fs.writeFileSync(this.stateFile, JSON.stringify(this.state, null, 2));
  }

  markCompleted(migrationName) {
    if (!this.state.completed.includes(migrationName)) {
      this.state.completed.push(migrationName);
      this.state.pending = this.state.pending.filter((m) => m !== migrationName);
      this.saveState();
    }
  }

  markFailed(migrationName, error) {
    this.state.failed.push({
      name: migrationName,
      error: error.message,
      timestamp: new Date().toISOString(),
    });
    this.saveState();
  }

  isCompleted(migrationName) {
    return this.state.completed.includes(migrationName);
  }
}

/**
 * Create backup of collection before migration
 */
async function backupCollection(collectionName) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFile = path.join(BACKUP_DIR, `${collectionName}-${timestamp}.json`);

  try {
    const documents = await databases.listDocuments(DATABASE_ID, collectionName);
    
    const backup = {
      collection: collectionName,
      timestamp: new Date().toISOString(),
      documentCount: documents.total,
      documents: documents.documents,
    };

    fs.writeFileSync(backupFile, JSON.stringify(backup, null, 2));

    return {
      success: true,
      backupFile,
      documentCount: documents.total,
    };
  } catch (error) {
    console.error(`Backup failed for ${collectionName}:`, error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Restore collection from backup
 */
async function restoreCollection(backupFile) {
  try {
    const backup = JSON.parse(fs.readFileSync(backupFile, 'utf-8'));
    const { collection, documents } = backup;

    let restored = 0;

    for (const doc of documents) {
      try {
        await databases.createDocument(DATABASE_ID, collection, doc.$id, doc);
        restored++;
      } catch (error) {
        if (!error.message?.includes('already exists')) {
          throw error;
        }
      }
    }

    return {
      success: true,
      collection,
      restored,
      total: documents.length,
    };
  } catch (error) {
    console.error('Restore failed:', error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Dry-run a migration to validate it
 */
export async function dryRunMigration(migrationName, migrationFn) {
  console.log(`🔍 Starting dry-run for migration: ${migrationName}`);

  try {
    const context = {
      dryRun: true,
      changes: [],
      warnings: [],
      errors: [],
    };

    await migrationFn(context, databases, DATABASE_ID);

    const success = context.errors.length === 0;

    return {
      success,
      dryRun: true,
      migrationName,
      changes: context.changes,
      warnings: context.warnings,
      errors: context.errors,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    return {
      success: false,
      dryRun: true,
      migrationName,
      error: error.message,
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Execute a migration with backup and rollback capability
 */
export async function executeMigration(migrationName, migrationFn, options = {}) {
  const {
    backupCollections = [],
    verifyFn = null,
    dryRun = false,
    skipBackup = false,
  } = options;

  ensureDirectories();

  const state = new MigrationState();

  // Check if already completed
  if (state.isCompleted(migrationName)) {
    console.log(`✅ Migration already completed: ${migrationName}`);
    return {
      success: true,
      migrationName,
      message: 'Migration already completed',
      skipped: true,
    };
  }

  console.log(`\n📋 Starting migration: ${migrationName}`);
  console.log(`   Dry-run: ${dryRun}`);

  const startTime = Date.now();
  const backups = [];

  try {
    // Step 1: Dry-run validation
    const dryRunResult = await dryRunMigration(migrationName, migrationFn);
    if (!dryRunResult.success) {
      throw new Error(`Dry-run failed: ${dryRunResult.errors?.[0] || dryRunResult.error}`);
    }
    console.log(`✅ Dry-run passed (${dryRunResult.changes?.length || 0} changes)`);

    // Step 2: Create backups
    if (!skipBackup && backupCollections.length > 0) {
      console.log(`🔄 Creating backups for ${backupCollections.length} collections...`);
      for (const collectionName of backupCollections) {
        const backup = await backupCollection(collectionName);
        if (backup.success) {
          backups.push(backup);
          console.log(`   ✅ Backed up ${collectionName} (${backup.documentCount} docs)`);
        } else {
          console.warn(`   ⚠️  Backup failed for ${collectionName}`);
        }
      }
    }

    // Step 3: Execute migration
    if (!dryRun) {
      console.log(`🚀 Executing migration...`);
      const context = {
        dryRun: false,
        changes: [],
        warnings: [],
        errors: [],
      };

      await migrationFn(context, databases, DATABASE_ID);

      if (context.errors.length > 0) {
        throw new Error(`Migration errors: ${context.errors.join(', ')}`);
      }

      console.log(`   ✅ Executed (${context.changes?.length || 0} changes)`);

      // Step 4: Verification
      if (verifyFn) {
        console.log(`🔍 Running verification...`);
        const verifyResult = await verifyFn(databases, DATABASE_ID);
        
        if (!verifyResult.success) {
          throw new Error(`Verification failed: ${verifyResult.message}`);
        }
        console.log(`   ✅ Verification passed`);
      }

      // Step 5: Mark as completed
      state.markCompleted(migrationName);
    }

    const duration = Date.now() - startTime;

    console.log(`\n✅ Migration completed successfully in ${duration}ms`);

    return {
      success: true,
      migrationName,
      duration,
      dryRun,
      backups,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    const duration = Date.now() - startTime;

    console.error(`\n❌ Migration failed: ${error.message}`);
    state.markFailed(migrationName, error);

    // Step 6: Rollback if not dry-run
    if (!dryRun && backups.length > 0) {
      console.log(`🔙 Rolling back from backups...`);
      for (const backup of backups) {
        const restoreResult = await restoreCollection(backup.backupFile);
        if (restoreResult.success) {
          console.log(`   ✅ Restored ${restoreResult.collection}`);
        } else {
          console.error(`   ❌ Restore failed for ${backup.backupFile}`);
        }
      }
    }

    return {
      success: false,
      migrationName,
      error: error.message,
      duration,
      dryRun,
      rolledBack: !dryRun && backups.length > 0,
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Run pending migrations in sequence
 */
export async function runMigrations(migrations, options = {}) {
  console.log(`\n${'='.repeat(60)}`);
  console.log('🚀 MIGRATION RUNNER');
  console.log(`${'='.repeat(60)}`);

  const results = [];
  const { dryRun = false, stopOnError = true } = options;

  for (const migration of migrations) {
    try {
      const result = await executeMigration(
        migration.name,
        migration.fn,
        {
          ...migration.options,
          dryRun,
        }
      );

      results.push(result);

      if (!result.success && stopOnError) {
        break;
      }
    } catch (error) {
      console.error(`Fatal error in migration ${migration.name}:`, error);
      results.push({
        success: false,
        migrationName: migration.name,
        error: error.message,
      });

      if (stopOnError) {
        break;
      }
    }
  }

  // Print summary
  const successful = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  console.log(`\n${'='.repeat(60)}`);
  console.log(`📊 MIGRATION SUMMARY`);
  console.log(`   ✅ Successful: ${successful}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log(`${'='.repeat(60)}\n`);

  return {
    success: failed === 0,
    total: results.length,
    successful,
    failed,
    results,
  };
}

export default {
  dryRunMigration,
  executeMigration,
  runMigrations,
  backupCollection,
  restoreCollection,
  MigrationState,
};
