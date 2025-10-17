// Create Recognition Appwrite Function - Production Implementation
import { Client, Databases, Users, ID } from 'node-appwrite';

// Environment variables
const APPWRITE_ENDPOINT = process.env.APPWRITE_ENDPOINT || 'https://localhost/v1';
const APPWRITE_PROJECT_ID = process.env.APPWRITE_PROJECT_ID!;
const APPWRITE_API_KEY = process.env.APPWRITE_API_KEY!;
const DATABASE_ID = process.env.DATABASE_ID || 'main';
const RECOGNITION_COLLECTION_ID = process.env.RECOGNITION_COLLECTION_ID || 'recognitions';
const AUDIT_COLLECTION_ID = process.env.AUDIT_COLLECTION_ID || 'audit_entries';

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

// Main function execution
export default async function createRecognition({ req, res }: any) {
  try {
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

    // Create audit entry
    await createAuditEntry(
      'RECOGNITION_CREATED',
      giverUserId,
      recognitionId,
      {
        recipientEmail: hashUserId(recipientEmail), // Hash recipient for privacy
        tags,
        evidenceCount: evidenceIds.length,
        weight,
        visibility
      }
    );

    // TODO: Send notification to recipient (integrate with Slack/Teams)
    // TODO: Queue for manager verification if high-value recognition

    return res.json({
      success: true,
      data: {
        id: recognition.$id,
        weight,
        status: recognition.status,
        createdAt: recognition.createdAt
      }
    });

  } catch (error) {
    console.error('Create recognition error:', error);

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