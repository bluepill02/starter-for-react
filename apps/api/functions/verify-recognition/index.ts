// Manager Recognition Verification Appwrite Function
import { Client, Databases, Users, ID } from 'node-appwrite';
import { z } from 'zod';
import crypto from 'crypto';

// Node.js globals (available in Appwrite Functions runtime)
/* global process */

// Validation schema for verification request
const VerifyRequestSchema = z.object({
  recognitionId: z.string().min(1),
  verified: z.boolean(),
  verificationNote: z.string().optional(),
  verifierId: z.string().min(1)
});

const client = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT || 'https://localhost/v1')
  .setProject(process.env.APPWRITE_PROJECT_ID || '')
  .setKey(process.env.APPWRITE_API_KEY || '');

const databases = new Databases(client);
const users = new Users(client);

// Hash user ID for privacy in logs and exports
function hashUserId(userId: string): string {
  return crypto.createHash('sha256').update(userId).digest('hex').substring(0, 16);
}

// Recalculate recognition weight based on verification
function calculateVerifiedWeight(originalWeight: number, verified: boolean, verifierRole: string): number {
  if (!verified) return 0; // Rejected recognitions have no weight
  
  let weight = originalWeight;
  
  // Verification bonus based on verifier role
  const verificationBonuses = { 'ADMIN': 0.3, 'MANAGER': 0.2 };
  const bonus = verificationBonuses[verifierRole as keyof typeof verificationBonuses] || 0;
  
  weight += weight * bonus;
  
  return Math.round(weight * 100) / 100; // Round to 2 decimal places
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
      process.env.APPWRITE_DATABASE_ID || 'main',
      'recognition_audits',
      ID.unique(),
      {
        eventCode,
        actorId: hashUserId(actorId),
        targetId: targetId ? hashUserId(targetId) : null,
        metadata: metadata ? JSON.stringify(metadata) : null,
        timestamp: new Date().toISOString(),
      }
    );
  } catch (error) {
    console.error('Failed to create audit entry:', error);
    // Don't fail the main operation for audit issues
  }
}

export default async ({ req, res, log, error }: any) => {
  if (req.method !== 'POST') {
    return res.json({ 
      error: 'Method not allowed' 
    }, 405);
  }
  
  try {
    // Validate request body
    const requestData = VerifyRequestSchema.parse(req.body);
    log(`Processing verification for recognition: ${requestData.recognitionId}`);
    
    // Get verifier user info
    const verifier = await users.get(requestData.verifierId);
    const verifierRole = verifier.prefs?.role || 'USER';
    
    // Check if user has manager/admin permissions
    if (verifierRole !== 'MANAGER' && verifierRole !== 'ADMIN') {
      error(`Unauthorized verification attempt by ${verifier.email}`);
      
      await createAuditEntry(
        'VERIFICATION_UNAUTHORIZED',
        requestData.verifierId,
        requestData.recognitionId,
        {
          verifierRole,
          verifierEmail: hashUserId(verifier.email)
        }
      );
      
      return res.json({
        error: 'Insufficient permissions to verify recognitions'
      }, 403);
    }
    
    // Get the recognition to verify
    let recognition;
    try {
      recognition = await databases.getDocument(
        process.env.APPWRITE_DATABASE_ID || 'main',
        'recognitions',
        requestData.recognitionId
      );
    } catch (getError) {
      error(`Recognition not found: ${requestData.recognitionId}`);
      return res.json({
        error: 'Recognition not found'
      }, 404);
    }
    
    // Check if recognition is already processed
    if (recognition.status !== 'PENDING') {
      return res.json({
        error: `Recognition has already been ${recognition.status.toLowerCase()}`
      }, 400);
    }
    
    // Prevent self-verification (can't verify own recognitions)
    if (recognition.giverUserId === requestData.verifierId) {
      await createAuditEntry(
        'VERIFICATION_SELF_ATTEMPT',
        requestData.verifierId,
        requestData.recognitionId,
        {
          originalWeight: recognition.weight
        }
      );
      
      return res.json({
        error: 'Cannot verify your own recognitions'
      }, 400);
    }
    
    // Recalculate weight based on verification
    const newWeight = calculateVerifiedWeight(
      recognition.weight,
      requestData.verified,
      verifierRole
    );
    
    const newStatus = requestData.verified ? 'VERIFIED' : 'REJECTED';
    
    // Update recognition with verification details
    const updatedRecognition = await databases.updateDocument(
      process.env.APPWRITE_DATABASE_ID || 'main',
      'recognitions',
      requestData.recognitionId,
      {
        status: newStatus,
        verifiedBy: verifier.name,
        verifierId: requestData.verifierId,
        verificationNote: requestData.verificationNote || null,
        verifiedWeight: newWeight,
        verifiedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    );
    
    // Create audit entry for verification
    await createAuditEntry(
      requestData.verified ? 'RECOGNITION_VERIFIED' : 'RECOGNITION_REJECTED',
      requestData.verifierId,
      requestData.recognitionId,
      {
        originalWeight: recognition.weight,
        verifiedWeight: newWeight,
        weightChange: newWeight - recognition.weight,
        verifierRole,
        verifierEmail: hashUserId(verifier.email),
        recipientEmail: hashUserId(recognition.recipientEmail),
        giverUserId: hashUserId(recognition.giverUserId),
        hasNote: !!requestData.verificationNote,
        tags: recognition.tags
      }
    );
    
    // TODO: Send notification to giver and recipient
    // TODO: Update recipient's total recognition score
    // TODO: Trigger webhook for integrations (Slack/Teams)
    
    const response = {
      success: true,
      data: {
        recognitionId: updatedRecognition.$id,
        status: updatedRecognition.status,
        verifiedBy: updatedRecognition.verifiedBy,
        originalWeight: recognition.weight,
        verifiedWeight: newWeight,
        weightChange: newWeight - recognition.weight,
        verifiedAt: updatedRecognition.verifiedAt
      }
    };
    
    log(`Verification completed: ${requestData.verified ? 'VERIFIED' : 'REJECTED'} with weight ${newWeight}`);
    return res.json(response);
    
  } catch (validationError: any) {
    if (validationError instanceof z.ZodError) {
      error(`Validation error: ${JSON.stringify(validationError.issues)}`);
      return res.json({
        error: 'Invalid request data',
        details: validationError.issues
      }, 400);
    }
    
    error(`Verification failed: ${validationError?.message || 'Unknown error'}`);
    
    // Create error audit entry
    try {
      await createAuditEntry(
        'VERIFICATION_ERROR',
        'system',
        undefined,
        {
          error: validationError instanceof Error ? validationError.message : 'Unknown error',
          requestBody: req.body
        }
      );
    } catch (auditError) {
      console.error('Failed to log verification error to audit:', auditError);
    }
    
    return res.json({
      error: 'Verification processing failed',
      message: validationError instanceof Error ? validationError.message : 'Unknown error'
    }, 500);
  }
};