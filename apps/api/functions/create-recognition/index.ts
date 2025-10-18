// Create Recognition Appwrite Function - Production Implementation
import { Client, Databases, Users, ID } from 'node-appwrite';
import { detectRecognitionAbuse } from '../services/abuse';
import { checkRateLimit } from '../services/rate-limiter';
import { getIdempotencyKey, checkDuplicate, storeIdempotencyRecord } from '../services/idempotency';
import { idempotencyMiddleware } from '../services/idempotency';
import { QuotaManager } from '../services/quota-management';
import { CircuitBreaker } from '../services/circuit-breaker';
import { MetricsCollector, getMetricsCollector } from '../services/metrics-exporter';
import { logStructured } from '../services/structured-logger';

// Environment variables
const APPWRITE_ENDPOINT = process.env.APPWRITE_ENDPOINT || 'https://localhost/v1';
const APPWRITE_PROJECT_ID = process.env.APPWRITE_PROJECT_ID!;
const APPWRITE_API_KEY = process.env.APPWRITE_API_KEY!;
const DATABASE_ID = process.env.DATABASE_ID || 'main';
const RECOGNITION_COLLECTION_ID = process.env.RECOGNITION_COLLECTION_ID || 'recognitions';
const AUDIT_COLLECTION_ID = process.env.AUDIT_COLLECTION_ID || 'audit_entries';
const TELEMETRY_COLLECTION_ID = process.env.TELEMETRY_COLLECTION_ID || 'telemetry_events';

// Initialize Appwrite client
const client = new Client()
  .setEndpoint(APPWRITE_ENDPOINT)
  .setProject(APPWRITE_PROJECT_ID)
  .setKey(APPWRITE_API_KEY);

const databases = new Databases(client);
const users = new Users(client);

interface CreateRecognitionRequest {
  recipientEmail: string;
  tags: string[];
  reason: string;
  visibility: 'PRIVATE' | 'TEAM' | 'PUBLIC';
  evidenceIds: string[];
  giverUserId: string;
}

// Anti-abuse configuration
const RECOGNITION_LIMITS = {
  dailyLimit: 10,
  weeklyLimit: 50,
  monthlyLimit: 100,
  minReasonLength: 20,
  maxTags: 3,
  evidenceWeightBonus: 0.5, // 50% bonus for evidence-backed recognitions
};

// Hash user ID for privacy in logs and exports
function hashUserId(userId: string): string {
  return Buffer.from(userId).toString('base64').replace(/[+=\/]/g, '').substring(0, 16);
}

// Calculate recognition weight based on content quality
function calculateRecognitionWeight(
  reason: string,
  tags: string[],
  evidenceCount: number,
  giverRole: string
): number {
  let weight = 1.0;

  // Base weight by giver role
  const roleWeights = { 'ADMIN': 2.0, 'MANAGER': 1.5, 'USER': 1.0 };
  weight *= roleWeights[giverRole as keyof typeof roleWeights] || 1.0;

  // Content quality bonuses
  if (reason.length >= 100) weight += 0.2; // Detailed reason
  if (tags.length >= 2) weight += 0.1; // Multiple relevant tags
  if (evidenceCount > 0) weight += RECOGNITION_LIMITS.evidenceWeightBonus;

  // Quality indicators (keywords that suggest meaningful recognition)
  const qualityKeywords = ['impact', 'helped', 'improved', 'collaborated', 'delivered', 'solved'];
  const keywordMatches = qualityKeywords.filter(keyword => 
    reason.toLowerCase().includes(keyword)
  ).length;
  weight += keywordMatches * 0.1;

  return Math.round(weight * 100) / 100; // Round to 2 decimal places
}

// Anti-abuse: Check recognition frequency and patterns
async function performAntiAbuseChecks(
  giverUserId: string,
  recipientEmail: string
): Promise<{ allowed: boolean; reason?: string }> {
  try {
    const today = new Date().toISOString().split('T')[0];
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // Check daily limit
    const todayRecognitions = await databases.listDocuments(
      DATABASE_ID,
      RECOGNITION_COLLECTION_ID,
      [
        `giverUserId.equal("${giverUserId}")`,
        `createdAt.greaterThanEqual("${today}")`,
      ]
    );

    if (todayRecognitions.total >= RECOGNITION_LIMITS.dailyLimit) {
      return { 
        allowed: false, 
        reason: `Daily recognition limit (${RECOGNITION_LIMITS.dailyLimit}) exceeded` 
      };
    }

    // Check weekly limit
    const weeklyRecognitions = await databases.listDocuments(
      DATABASE_ID,
      RECOGNITION_COLLECTION_ID,
      [
        `giverUserId.equal("${giverUserId}")`,
        `createdAt.greaterThanEqual("${weekAgo}")`,
      ]
    );

    if (weeklyRecognitions.total >= RECOGNITION_LIMITS.weeklyLimit) {
      return { 
        allowed: false, 
        reason: `Weekly recognition limit (${RECOGNITION_LIMITS.weeklyLimit}) exceeded` 
      };
    }

    // Check reciprocity patterns (giving too many to same person)
    const recipientRecognitions = await databases.listDocuments(
      DATABASE_ID,
      RECOGNITION_COLLECTION_ID,
      [
        `giverUserId.equal("${giverUserId}")`,
        `recipientEmail.equal("${recipientEmail}")`,
        `createdAt.greaterThanEqual("${weekAgo}")`,
      ]
    );

    if (recipientRecognitions.total >= 3) {
      return { 
        allowed: false, 
        reason: 'Too many recognitions to the same person this week. Please recognize others to maintain fairness.' 
      };
    }

    return { allowed: true };
  } catch (error) {
    console.error('Anti-abuse check failed:', error);
    return { allowed: true }; // Fail open for availability
  }
}

// Create audit log entry
async function createAuditEntry(
  eventCode: string,
  actorId: string,
  targetId?: string,
  metadata?: Record<string, any>
): Promise<void> {
  try {
    await databases.createDocument(
      DATABASE_ID,
      AUDIT_COLLECTION_ID,
      ID.unique(),
      {
        eventCode,
        actorId: hashUserId(actorId),
        targetId: targetId ? hashUserId(targetId) : null,
        metadata: metadata ? JSON.stringify(metadata) : null,
        createdAt: new Date().toISOString(),
      }
    );
  } catch (error) {
    console.error('Failed to create audit entry:', error);
    // Don't fail the main operation for audit issues
  }
}

// Emit telemetry event for analytics and monitoring
async function emitTelemetryEvent(
  eventType: 'recognition_created' | 'recognition_verified' | 'export_requested' | 'abuse_detected' | 'admin_action',
  hashedUserId: string,
  hashedTargetId?: string,
  metadata?: Record<string, any>
): Promise<void> {
  try {
    await databases.createDocument(
      DATABASE_ID,
      TELEMETRY_COLLECTION_ID,
      ID.unique(),
      {
        eventType,
        hashedUserId,
        hashedTargetId: hashedTargetId || null,
        metadata: metadata ? JSON.stringify(metadata) : null,
        timestamp: new Date().toISOString(),
      }
    );
  } catch (error) {
    console.error('Failed to emit telemetry event:', error);
    // Don't fail the main operation for telemetry issues
  }
}

// Main function execution
export default async function createRecognition({ req, res }: any) {
  try {
    // Phase 5: Start metrics tracking
    const startTime = Date.now();

    // Parse request body
    const body: CreateRecognitionRequest = JSON.parse(req.body || '{}');
    const {
      recipientEmail,
      tags,
      reason,
      visibility,
      evidenceIds,
      giverUserId
    } = body;

    // Phase 3A: Check idempotency for duplicate protection
    const idempotencyKey = getIdempotencyKey(req);
    if (idempotencyKey && giverUserId) {
      const duplicate = await checkDuplicate(idempotencyKey, giverUserId);
      if (duplicate) {
        return res.json(duplicate.responseData, 200);
      }
    }

    // Validate required fields
    if (!recipientEmail || !tags?.length || !reason || !giverUserId) {
      return res.json({
        success: false,
        error: 'Missing required fields'
      }, 400);
    }

    // Validate input constraints
    if (reason.length < RECOGNITION_LIMITS.minReasonLength) {
      return res.json({
        success: false,
        error: `Reason must be at least ${RECOGNITION_LIMITS.minReasonLength} characters for evidence-weighted recognition`
      }, 400);
    }

    if (tags.length > RECOGNITION_LIMITS.maxTags) {
      return res.json({
        success: false,
        error: `Maximum ${RECOGNITION_LIMITS.maxTags} tags allowed`
      }, 400);
    }

    // Get giver user info
    const giver = await users.get(giverUserId);
    const giverRole = giver.prefs?.role || 'USER';

    // Prevent self-recognition
    if (giver.email === recipientEmail) {
      return res.json({
        success: false,
        error: 'Cannot give recognition to yourself'
      }, 400);
    }

    // Check rate limits using rate-limiter service
    const rateLimitCheck = await checkRateLimit(
      giverUserId,
      'recognition_daily',
      databases
    );
    if (!rateLimitCheck.allowed) {
      await createAuditEntry(
        'RECOGNITION_RATE_LIMITED',
        giverUserId,
        undefined,
        {
          recipientEmail,
          rateLimitType: 'recognition_daily',
          remaining: rateLimitCheck.remaining
        }
      );
      return res.json({
        success: false,
        error: `Rate limit exceeded. You have ${rateLimitCheck.remaining} recognitions remaining today.`
      }, 429);
    }

    // Check organization quotas (Phase 4)
    try {
      const userDoc = await databases.getDocument(DATABASE_ID, 'users', giverUserId);
      const organizationId = userDoc.organizationId;
      const quotaManager = new QuotaManager(organizationId);
      const quotaCheck = await quotaManager.checkQuota('recognitions_per_day');
      if (!quotaCheck.allowed) {
        return res.json({
          success: false,
          error: `Organization recognition quota exceeded. Remaining: ${quotaCheck.remaining}`
        }, 429);
      }
    } catch (quotaErr) {
      // Graceful degradation: if quota check fails, log but continue
      console.warn('Quota check failed, continuing with degraded service', quotaErr);
    }

    // Anti-abuse checks
    const abuseCheck = await performAntiAbuseChecks(giverUserId, recipientEmail);
    if (!abuseCheck.allowed) {
      await createAuditEntry(
        'RECOGNITION_BLOCKED',
        giverUserId,
        undefined,
        {
          recipientEmail,
          reason: abuseCheck.reason,
          tags,
          visibility
        }
      );

      return res.json({
        success: false,
        error: abuseCheck.reason
      }, 429);
    }

    // Calculate recognition weight
    const weight = calculateRecognitionWeight(
      reason,
      tags,
      evidenceIds.length,
      giverRole
    );

    // Create recognition record
    const recognitionId = ID.unique();
    const recognition = await databases.createDocument(
      DATABASE_ID,
      RECOGNITION_COLLECTION_ID,
      recognitionId,
      {
        giverUserId,
        giverName: giver.name,
        giverEmail: giver.email,
        recipientEmail: recipientEmail.toLowerCase().trim(),
        tags,
        reason: reason.trim(),
        visibility,
        evidenceIds,
        weight,
        status: 'PENDING', // Will be verified by manager if needed
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
    );

    // Run comprehensive abuse detection
    let finalWeight = weight;
    let abuseDetected = false;
    
    try {
      const abuseResult = await detectRecognitionAbuse(
        recognitionId,
        giverUserId,
        recipientEmail, // Will be resolved to recipientId in abuse service
        reason,
        weight,
        evidenceIds.length,
        giverRole
      );
      
      if (abuseResult.isAbusive && abuseResult.adjustedWeight) {
        finalWeight = abuseResult.adjustedWeight;
        abuseDetected = true;
        
        // Update recognition with adjusted weight
        await databases.updateDocument(
          DATABASE_ID,
          RECOGNITION_COLLECTION_ID,
          recognitionId,
          {
            weight: finalWeight,
            originalWeight: weight,
            abuseFlags: abuseResult.flags.length,
            updatedAt: new Date().toISOString()
          }
        );
        
        // Emit abuse detection telemetry
        await emitTelemetryEvent(
          'abuse_detected',
          hashUserId(giverUserId),
          hashUserId(recognitionId),
          {
            flagTypes: abuseResult.flags.map(f => f.flagType),
            severity: abuseResult.severity,
            originalWeight: weight,
            adjustedWeight: finalWeight,
            reasonCodes: abuseResult.reasonCodes
          }
        );
      }
    } catch (abuseError) {
      console.error('Abuse detection failed:', abuseError);
      // Continue with original weight if abuse detection fails
    }

    // Create audit entry for recognition creation
    await createAuditEntry(
      'RECOGNITION_CREATED',
      giverUserId,
      recognitionId,
      {
        recipientEmail: hashUserId(recipientEmail), // Hash recipient for privacy
        tags,
        evidenceCount: evidenceIds.length,
        weight: finalWeight,
        originalWeight: weight,
        visibility,
        abuseDetected,
        source: req.headers['x-source'] || 'WEB' // Track source (WEB, SLACK, TEAMS, API)
      }
    );

    // Emit recognition created telemetry event
    await emitTelemetryEvent(
      'recognition_created',
      hashUserId(giverUserId),
      hashUserId(recognitionId),
      {
        tags,
        evidencePresent: evidenceIds.length > 0,
        source: req.headers['x-source'] || 'WEB',
        weight: finalWeight,
        visibility,
        abuseDetected
      }
    );

    // TODO: Send notification to recipient (integrate with Slack/Teams)
    // TODO: Queue for manager verification if high-value recognition

    const responseData = {
      success: true,
      data: {
        id: recognition.$id,
        weight: finalWeight,
        originalWeight: weight,
        status: recognition.status,
        createdAt: recognition.createdAt,
        abuseDetected
      }
    };

    // Phase 5: Record metrics for observability
    try {
      const metrics = getMetricsCollector();
      metrics.recordFunctionExecution('create-recognition', Date.now() - startTime, true);
      metrics.recordEvent('recognition_created', {
        weight: finalWeight,
        hasEvidence: !!evidenceFile,
        abuseDetected,
        visibility
      });
      logStructured('recognition_created', {
        recognitionId: recognition.$id,
        giverUserId: hashUserId(giverUserId),
        recipientEmail: hashUserId(recipientEmail),
        weight: finalWeight,
        visibility
      });
    } catch (metricsErr) {
      console.warn('Failed to record metrics', metricsErr);
    }

    // Phase 3A: Store idempotency result for duplicate protection
    if (idempotencyKey && giverUserId) {
      await storeIdempotencyRecord(
        idempotencyKey,
        giverUserId,
        'create_recognition',
        responseData
      );
    }

    return res.json(responseData);

  } catch (error) {
    console.error('Create recognition error:', error);

    // Phase 5: Record error metrics
    try {
      const metrics = getMetricsCollector();
      metrics.recordFunctionExecution('create-recognition', Date.now() - startTime, false);
      logStructured('recognition_failed', {
        error: error.message,
        code: error.code || 'UNKNOWN_ERROR'
      });
    } catch (metricsErr) {
      console.warn('Failed to record error metrics', metricsErr);
    }

    // Create error audit entry
    try {
      await createAuditEntry(
        'RECOGNITION_ERROR',
        'system',
        undefined,
        {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      );
    } catch (auditError) {
      console.error('Failed to log error to audit:', auditError);
    }

    return res.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    }, 500);
  }
}