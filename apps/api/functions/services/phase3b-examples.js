/**
 * Phase 3B Example Implementations
 * Real-world patterns for using deployment safety services
 */

// ============================================================================
// Example 1: Blue-Green Deployment in Function Update Workflow
// ============================================================================

export async function exampleBlueGreenDeployment() {
  const { executeBlueGreenDeployment } = await import('../services/blue-green-deployment.js');
  const fs = require('fs');

  // Load new function code
  const newCode = fs.readFileSync('./apps/api/functions/create-recognition/index.js', 'utf-8');

  // Execute blue-green deployment
  const result = await executeBlueGreenDeployment(
    'create-recognition',
    newCode,
    process.env.APPWRITE_ENDPOINT,
    {
      skipHealthCheck: false,
      autoRollback: true,
    }
  );

  if (result.success) {
    console.log('✅ Deployment successful');
    console.log(`   Active environment: ${result.state.blue.status}`);
    console.log(`   Standby environment: ${result.state.green.status}`);
    return {
      status: 'deployed',
      environment: result.state.blue.status,
      timestamp: new Date().toISOString(),
    };
  } else {
    console.log('❌ Deployment failed - automatic rollback executed');
    return {
      status: 'rolled_back',
      reason: result.error,
      timestamp: new Date().toISOString(),
    };
  }
}

// ============================================================================
// Example 2: Protected External Call with Circuit Breaker
// ============================================================================

export async function exampleCircuitBreakerProtection(recognition) {
  const { callWithCircuitBreaker } = await import('../services/circuit-breaker.js');

  // Send recognition to Slack with fallback
  const slackResponse = await callWithCircuitBreaker(
    'slack',
    async () => {
      // Primary: Call Slack
      return fetch(process.env.SLACK_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `🎉 New Recognition from ${recognition.giver_name}`,
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `*${recognition.title}*\n${recognition.reason}`,
              },
            },
          ],
        }),
      });
    },
    async () => {
      // Fallback: Log locally if Slack is down
      console.log('⚠️  Slack unavailable, storing notification locally:', recognition);
      return {
        fallback: true,
        stored_locally: true,
        timestamp: new Date().toISOString(),
      };
    }
  );

  return slackResponse;
}

// ============================================================================
// Example 3: Quota-Enforced Recognition Creation
// ============================================================================

export async function exampleQuotaEnforcedRecognition(req, res) {
  const {
    quotaEnforcementMiddleware,
    recordQuotaUsageMiddleware,
  } = await import('../services/quota-management.js');

  const orgId = req.headers['x-organization-id'];
  const { title, reason, evidenceIds } = req.body;

  // 1. Check quota before processing
  const quotaCheck = await quotaEnforcementMiddleware(req, 'recognitions_per_day');

  if (!quotaCheck.allowed) {
    return res.json(
      {
        error: 'Daily recognition quota exceeded',
        quota: {
          limit: quotaCheck.quota,
          used: quotaCheck.current,
          remaining: quotaCheck.remaining,
          resets_at: quotaCheck.resetAt,
        },
        upgrade_info: 'Contact admin to request higher quota',
      },
      429
    );
  }

  // 2. Create recognition (business logic)
  const recognition = {
    id: generateId(),
    org_id: orgId,
    title,
    reason,
    evidenceIds,
    created_at: new Date().toISOString(),
    status: 'pending_verification',
  };

  // Store in database
  await saveRecognition(recognition);

  // 3. Record quota usage after successful creation
  await recordQuotaUsageMiddleware(orgId, 'recognitions_per_day', 1);

  // 4. Send Slack notification with circuit breaker
  const slackNotification = await exampleCircuitBreakerProtection(recognition);

  return res.json(
    {
      success: true,
      recognition: {
        id: recognition.id,
        status: recognition.status,
      },
      quota_remaining: quotaCheck.remaining - 1,
      notification_sent: slackNotification.fallback !== true,
    },
    201
  );
}

// ============================================================================
// Example 4: Background Job for Profile Export
// ============================================================================

export async function exampleBackgroundJobExport(req, res) {
  const { enqueueJob } = await import('../services/background-worker.js');

  const { recognitionIds, format = 'pdf', includeEvidence = true } = req.body;
  const orgId = req.headers['x-organization-id'];

  // 1. Enqueue the export job (return immediately)
  const job = await enqueueJob(
    'generate-export', // job type
    {
      recognitionIds,
      format,
      includeEvidence,
      org_id: orgId,
      requested_by: req.user.id,
    },
    {
      priority: 2, // HIGH priority
      maxRetries: 3,
    }
  );

  // 2. Return job tracking info to user
  return res.json(
    {
      message: 'Export queued for processing',
      job_id: job.jobId,
      status: 'pending',
      check_status_at: `/api/job-status/${job.jobId}`,
      estimated_wait: '2-5 minutes',
    },
    202
  );
}

// ============================================================================
// Example 5: Scheduled Background Job Handler
// ============================================================================

export async function exampleScheduledJobSetup() {
  const { getJobQueue, ScheduledJobRunner, startWorker } = await import('../services/background-worker.js');

  const queue = getJobQueue();
  const scheduler = new ScheduledJobRunner();

  // Register handler for cleanup job
  queue.registerHandler('cleanup-old-recognitions', async (payload) => {
    const { daysOld } = payload;
    console.log(`🧹 Cleaning up recognitions older than ${daysOld} days...`);

    const result = await cleanupOldRecognitions(daysOld);
    return {
      deleted_count: result.count,
      freed_storage_gb: result.storageFreed,
      timestamp: new Date().toISOString(),
    };
  });

  // Register handler for audit export
  queue.registerHandler('export-audit-logs', async (payload) => {
    const { organization_id, month } = payload;
    console.log(`📊 Exporting audit logs for ${organization_id} (${month})...`);

    const result = await exportAuditLogs(organization_id, month);
    return {
      file_id: result.fileId,
      entries_count: result.count,
      size_mb: result.sizeMB,
    };
  });

  // Schedule daily cleanup at 2 AM
  scheduler.schedule('cleanup-old-recognitions', '0 2 * * *', {
    daysOld: 90,
  });

  // Schedule monthly audit export on 1st of month at 1 AM
  scheduler.schedule('export-audit-logs', '0 1 1 * *', {
    organization_id: 'all',
    month: new Date().getMonth(),
  });

  // Start the worker and scheduler
  await scheduler.start();
  startWorker(5000); // Process jobs every 5 seconds

  console.log('✅ Background job handlers registered and scheduler started');
}

// ============================================================================
// Example 6: Combining All Services - Complete Recognition Flow
// ============================================================================

export async function exampleCompleteRecognitionFlow(req, res) {
  const {
    quotaEnforcementMiddleware,
    recordQuotaUsageMiddleware,
  } = await import('../services/quota-management.js');
  const { callWithCircuitBreaker } = await import('../services/circuit-breaker.js');
  const { enqueueJob } = await import('../services/background-worker.js');

  const orgId = req.headers['x-organization-id'];
  const { recipient_id, title, reason, evidenceIds, tags } = req.body;

  try {
    // Step 1: Check quota
    console.log('📊 Checking quota...');
    const quota = await quotaEnforcementMiddleware(req, 'recognitions_per_day');

    if (!quota.allowed) {
      return res.json(
        {
          error: 'Recognition quota exceeded',
          details: quota,
        },
        429
      );
    }

    // Step 2: Create recognition record
    console.log('💾 Saving recognition...');
    const recognition = {
      id: generateId(),
      org_id: orgId,
      giver_id: req.user.id,
      recipient_id,
      title,
      reason,
      evidenceIds,
      tags,
      created_at: new Date().toISOString(),
      status: 'pending_verification',
      weight: calculateWeight(reason, evidenceIds.length),
    };

    await saveRecognition(recognition);

    // Step 3: Record quota usage
    console.log('📈 Recording usage...');
    await recordQuotaUsageMiddleware(orgId, 'recognitions_per_day', 1);

    // Step 4: Send notifications with circuit breaker
    console.log('📢 Sending notifications...');

    // Send Slack notification (with fallback)
    const slackResult = await callWithCircuitBreaker(
      'slack',
      async () => sendSlackNotification(recognition),
      async () => ({ fallback: true })
    );

    // Send Teams notification (with fallback)
    const teamsResult = await callWithCircuitBreaker(
      'teams',
      async () => sendTeamsNotification(recognition),
      async () => ({ fallback: true })
    );

    // Step 5: Enqueue async jobs
    console.log('⚙️  Enqueueing background jobs...');

    // Enqueue to check for abuse patterns
    await enqueueJob(
      'check-abuse-patterns',
      {
        recognition_id: recognition.id,
        org_id: orgId,
      },
      { priority: 2 }
    );

    // Enqueue to generate preview images
    await enqueueJob(
      'generate-evidence-previews',
      {
        recognition_id: recognition.id,
        evidence_ids: evidenceIds,
      },
      { priority: 1 }
    );

    // Step 6: Return successful response
    console.log('✅ Recognition created successfully');
    return res.json(
      {
        success: true,
        recognition: {
          id: recognition.id,
          status: recognition.status,
          weight: recognition.weight,
        },
        notifications: {
          slack: !slackResult.fallback ? 'sent' : 'queued_locally',
          teams: !teamsResult.fallback ? 'sent' : 'queued_locally',
        },
        quota_remaining: quota.remaining - 1,
        background_jobs: 2,
      },
      201
    );
  } catch (error) {
    console.error('❌ Error creating recognition:', error);

    // Send error alert using circuit breaker
    await callWithCircuitBreaker(
      'email',
      async () => sendErrorAlert(orgId, error),
      async () => console.log('Error alert queued locally')
    );

    return res.json(
      {
        error: 'Failed to create recognition',
        traceId: req.headers['x-trace-id'],
      },
      500
    );
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

function generateId() {
  return `id_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function calculateWeight(reason, evidenceCount) {
  // Weight = base 10 + reason length factor + evidence factor
  const reasonFactor = Math.min(reason.length / 10, 5);
  const evidenceFactor = Math.min(evidenceCount * 2, 10);
  return Math.round(10 + reasonFactor + evidenceFactor);
}

async function saveRecognition(recognition) {
  // Save to Appwrite database
  console.log('  Saving to database:', recognition.id);
}

async function sendSlackNotification(recognition) {
  console.log('  Sending Slack notification:', recognition.id);
  return { ok: true };
}

async function sendTeamsNotification(recognition) {
  console.log('  Sending Teams notification:', recognition.id);
  return { ok: true };
}

async function cleanupOldRecognitions() {
  console.log('  Cleaned 100 old recognitions');
  return { count: 100, storageFreed: 5 };
}

async function exportAuditLogs(orgId) {
  console.log(`  Exported audit logs for ${orgId}`);
  return { fileId: 'file_123', count: 500, sizeMB: 2.5 };
}

async function sendErrorAlert(orgId, error) {
  console.log(`  Sending error alert for ${orgId}:`, error.message);
}

// ============================================================================
// Usage Instructions
// ============================================================================

/*
These examples show how to integrate Phase 3B services:

1. BLUE-GREEN DEPLOYMENT
   - Use for function updates (zero downtime)
   - Automatic health checks and rollback
   
2. CIRCUIT BREAKER
   - Wrap external service calls (Slack, Teams, Email)
   - Automatic fallback when service fails
   - Prevents cascading failures

3. QUOTA ENFORCEMENT
   - Check before processing user operations
   - Record usage after successful completion
   - Prevents noisy neighbor problems

4. BACKGROUND JOBS
   - Enqueue long-running operations
   - Return immediately to user
   - Process asynchronously in background
   - Automatic retry with exponential backoff

5. COMBINED FLOW (Example 6)
   - Shows production-ready pattern
   - All services working together
   - Error handling and resilience
   - Async and sync operations

To use these examples:
1. Import the appropriate service
2. Call the service function with parameters
3. Handle success and failure cases
4. Return appropriate HTTP response

See PHASE3B-DEPLOYMENT-SAFETY.md for full documentation.
*/
