// Anti-Abuse Detection Service - Production Implementation
import { Client, Databases, ID } from 'node-appwrite';
import crypto from 'crypto';

// Environment variables
const APPWRITE_ENDPOINT = process.env.APPWRITE_ENDPOINT || 'https://localhost/v1';
const APPWRITE_PROJECT_ID = process.env.APPWRITE_PROJECT_ID!;
const APPWRITE_API_KEY = process.env.APPWRITE_API_KEY!;
const DATABASE_ID = process.env.DATABASE_ID || 'main';
const RECOGNITION_COLLECTION_ID = process.env.RECOGNITION_COLLECTION_ID || 'recognitions';
const ABUSE_FLAGS_COLLECTION_ID = process.env.ABUSE_FLAGS_COLLECTION_ID || 'abuse_flags';
const AUDIT_COLLECTION_ID = process.env.AUDIT_COLLECTION_ID || 'audit_entries';

// Initialize Appwrite client
const client = new Client()
  .setEndpoint(APPWRITE_ENDPOINT)
  .setProject(APPWRITE_PROJECT_ID)
  .setKey(APPWRITE_API_KEY);

const databases = new Databases(client);

// Anti-abuse configuration
const ABUSE_THRESHOLDS = {
  // Reciprocity detection
  reciprocityWindow: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
  reciprocityThreshold: 5, // Max recognitions between same pair in window
  mutualExchangeThreshold: 3, // Max mutual exchanges in window
  
  // Frequency limits
  dailyLimit: 10,
  weeklyLimit: 50,
  monthlyLimit: 100,
  
  // Weight manipulation detection
  weightVarianceThreshold: 0.5, // Unusual weight patterns
  evidencelessHighWeightThreshold: 2.5, // High weight without evidence
  
  // Content analysis
  minReasonLength: 20,
  maxDuplicateReason: 3, // Max similar reasons from same giver
  
  // Severity scoring
  lowSeverityScore: 1,
  mediumSeverityScore: 5,
  highSeverityScore: 10,
  criticalSeverityScore: 20
};

// Reason codes for weight adjustments
export const WEIGHT_ADJUSTMENT_REASONS = {
  RECIPROCITY_DETECTED: 'Excessive reciprocity pattern detected',
  FREQUENCY_ABUSE: 'Recognition frequency exceeds normal patterns',
  DUPLICATE_CONTENT: 'Similar or duplicate recognition content',
  WEIGHT_MANIPULATION: 'Unusual weight patterns detected',
  EVIDENCE_MISMATCH: 'Weight-evidence ratio suspicious',
  MANUAL_OVERRIDE: 'Administrative weight adjustment',
  SYSTEM_CORRECTION: 'Automated system correction'
} as const;

// Flag types and descriptions
const FLAG_TYPES = {
  RECIPROCITY: 'Users exchanging recognitions excessively',
  FREQUENCY: 'Recognition frequency exceeds normal limits',
  CONTENT: 'Duplicate or low-quality recognition content',
  EVIDENCE: 'Evidence-weight ratio appears suspicious',
  WEIGHT_MANIPULATION: 'Unusual weight patterns detected',
  MANUAL: 'Manually flagged for review'
} as const;

// Interfaces
interface RecognitionPattern {
  giverId: string;
  recipientId: string;
  frequency: number;
  mutualCount: number;
  averageWeight: number;
  lastRecognitionDate: string;
  reasons: string[];
}

interface AbuseDetectionResult {
  isAbusive: boolean;
  flags: AbuseFlag[];
  adjustedWeight?: number;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  reasonCodes: string[];
}

interface AbuseFlag {
  flagType: keyof typeof FLAG_TYPES;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  detectionMethod: 'AUTOMATIC' | 'REPORTED' | 'MANUAL_REVIEW';
  metadata: Record<string, any>;
}

// Hash user ID for privacy in logs and exports
function hashUserId(userId: string): string {
  return crypto.createHash('sha256').update(userId).digest('hex').substring(0, 16);
}

// Calculate similarity between two strings (for duplicate detection)
function calculateStringSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 1.0;
  
  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

// Levenshtein distance calculation
function levenshteinDistance(str1: string, str2: string): number {
  const matrix = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
}

// Get recognition patterns for reciprocity detection
async function getRecognitionPatterns(giverId: string, recipientId: string): Promise<RecognitionPattern> {
  const windowStart = new Date(Date.now() - ABUSE_THRESHOLDS.reciprocityWindow).toISOString();
  
  // Get all recognitions between these users in the time window
  const directRecognitions = await databases.listDocuments(
    DATABASE_ID,
    RECOGNITION_COLLECTION_ID,
    [
      `giverUserId.equal("${giverId}")`,
      `recipientId.equal("${recipientId}")`,
      `createdAt.greaterThanEqual("${windowStart}")`,
    ]
  );
  
  const mutualRecognitions = await databases.listDocuments(
    DATABASE_ID,
    RECOGNITION_COLLECTION_ID,
    [
      `giverUserId.equal("${recipientId}")`,
      `recipientId.equal("${giverId}")`,
      `createdAt.greaterThanEqual("${windowStart}")`,
    ]
  );
  
  const allRecognitions = [...directRecognitions.documents, ...mutualRecognitions.documents];
  const averageWeight = allRecognitions.reduce((sum, rec) => sum + (rec.weight || 1), 0) / allRecognitions.length || 1;
  const reasons = directRecognitions.documents.map(rec => rec.reason);
  
  return {
    giverId,
    recipientId,
    frequency: directRecognitions.total,
    mutualCount: mutualRecognitions.total,
    averageWeight,
    lastRecognitionDate: allRecognitions[0]?.createdAt || '',
    reasons
  };
}

// Detect reciprocity abuse patterns
async function detectReciprocityAbuse(giverId: string, recipientId: string): Promise<AbuseFlag[]> {
  const flags: AbuseFlag[] = [];
  const pattern = await getRecognitionPatterns(giverId, recipientId);
  
  // Check excessive direct recognitions
  if (pattern.frequency >= ABUSE_THRESHOLDS.reciprocityThreshold) {
    flags.push({
      flagType: 'RECIPROCITY',
      severity: pattern.frequency >= ABUSE_THRESHOLDS.reciprocityThreshold * 2 ? 'HIGH' : 'MEDIUM',
      description: `${pattern.frequency} recognitions from ${hashUserId(giverId)} to ${hashUserId(recipientId)} in 7 days (threshold: ${ABUSE_THRESHOLDS.reciprocityThreshold})`,
      detectionMethod: 'AUTOMATIC',
      metadata: {
        frequency: pattern.frequency,
        threshold: ABUSE_THRESHOLDS.reciprocityThreshold,
        windowDays: 7
      }
    });
  }
  
  // Check mutual exchange patterns
  if (pattern.mutualCount >= ABUSE_THRESHOLDS.mutualExchangeThreshold && pattern.frequency >= ABUSE_THRESHOLDS.mutualExchangeThreshold) {
    flags.push({
      flagType: 'RECIPROCITY',
      severity: 'HIGH',
      description: `Mutual recognition exchange detected: ${pattern.frequency} direct, ${pattern.mutualCount} reverse`,
      detectionMethod: 'AUTOMATIC',
      metadata: {
        directCount: pattern.frequency,
        mutualCount: pattern.mutualCount,
        totalExchanges: pattern.frequency + pattern.mutualCount
      }
    });
  }
  
  return flags;
}

// Detect frequency abuse
async function detectFrequencyAbuse(giverId: string): Promise<AbuseFlag[]> {
  const flags: AbuseFlag[] = [];
  const now = new Date();
  
  // Check daily limit
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const todayRecognitions = await databases.listDocuments(
    DATABASE_ID,
    RECOGNITION_COLLECTION_ID,
    [
      `giverUserId.equal("${giverId}")`,
      `createdAt.greaterThanEqual("${todayStart}")`,
    ]
  );
  
  if (todayRecognitions.total >= ABUSE_THRESHOLDS.dailyLimit) {
    flags.push({
      flagType: 'FREQUENCY',
      severity: todayRecognitions.total >= ABUSE_THRESHOLDS.dailyLimit * 1.5 ? 'HIGH' : 'MEDIUM',
      description: `Daily recognition limit exceeded: ${todayRecognitions.total}/${ABUSE_THRESHOLDS.dailyLimit}`,
      detectionMethod: 'AUTOMATIC',
      metadata: {
        count: todayRecognitions.total,
        limit: ABUSE_THRESHOLDS.dailyLimit,
        period: 'daily'
      }
    });
  }
  
  // Check weekly limit
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const weeklyRecognitions = await databases.listDocuments(
    DATABASE_ID,
    RECOGNITION_COLLECTION_ID,
    [
      `giverUserId.equal("${giverId}")`,
      `createdAt.greaterThanEqual("${weekAgo}")`,
    ]
  );
  
  if (weeklyRecognitions.total >= ABUSE_THRESHOLDS.weeklyLimit) {
    flags.push({
      flagType: 'FREQUENCY',
      severity: 'CRITICAL',
      description: `Weekly recognition limit exceeded: ${weeklyRecognitions.total}/${ABUSE_THRESHOLDS.weeklyLimit}`,
      detectionMethod: 'AUTOMATIC',
      metadata: {
        count: weeklyRecognitions.total,
        limit: ABUSE_THRESHOLDS.weeklyLimit,
        period: 'weekly'
      }
    });
  }
  
  return flags;
}

// Detect content abuse (duplicate/low-quality content)
async function detectContentAbuse(giverId: string, reason: string): Promise<AbuseFlag[]> {
  const flags: AbuseFlag[] = [];
  
  // Check reason length
  if (reason.length < ABUSE_THRESHOLDS.minReasonLength) {
    flags.push({
      flagType: 'CONTENT',
      severity: 'LOW',
      description: `Recognition reason too short: ${reason.length} characters (minimum: ${ABUSE_THRESHOLDS.minReasonLength})`,
      detectionMethod: 'AUTOMATIC',
      metadata: {
        reasonLength: reason.length,
        minLength: ABUSE_THRESHOLDS.minReasonLength
      }
    });
  }
  
  // Check for duplicate content from same giver
  const recentRecognitions = await databases.listDocuments(
    DATABASE_ID,
    RECOGNITION_COLLECTION_ID,
    [
      `giverUserId.equal("${giverId}")`,
      `createdAt.greaterThanEqual("${new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()}")`,
    ]
  );
  
  let similarCount = 0;
  for (const recognition of recentRecognitions.documents) {
    const similarity = calculateStringSimilarity(reason.toLowerCase(), recognition.reason.toLowerCase());
    if (similarity > 0.8) { // 80% similarity threshold
      similarCount++;
    }
  }
  
  if (similarCount >= ABUSE_THRESHOLDS.maxDuplicateReason) {
    flags.push({
      flagType: 'CONTENT',
      severity: 'MEDIUM',
      description: `Duplicate/similar content detected: ${similarCount} similar reasons in last 30 days`,
      detectionMethod: 'AUTOMATIC',
      metadata: {
        similarCount,
        threshold: ABUSE_THRESHOLDS.maxDuplicateReason,
        similarity: 'high'
      }
    });
  }
  
  return flags;
}

// Detect weight manipulation
async function detectWeightManipulation(weight: number, evidenceCount: number, giverRole: string): Promise<AbuseFlag[]> {
  const flags: AbuseFlag[] = [];
  
  // Check evidenceless high weight
  if (weight > ABUSE_THRESHOLDS.evidencelessHighWeightThreshold && evidenceCount === 0) {
    flags.push({
      flagType: 'WEIGHT_MANIPULATION',
      severity: weight > 4 ? 'HIGH' : 'MEDIUM',
      description: `High weight (${weight}) without evidence (role: ${giverRole})`,
      detectionMethod: 'AUTOMATIC',
      metadata: {
        weight,
        evidenceCount,
        giverRole,
        threshold: ABUSE_THRESHOLDS.evidencelessHighWeightThreshold
      }
    });
  }
  
  // Check unusual weight patterns (this could be enhanced with ML)
  const expectedWeight = giverRole === 'MANAGER' ? 1.5 : giverRole === 'ADMIN' ? 2.0 : 1.0;
  const weightVariance = Math.abs(weight - expectedWeight);
  
  if (weightVariance > ABUSE_THRESHOLDS.weightVarianceThreshold && weight > expectedWeight) {
    flags.push({
      flagType: 'WEIGHT_MANIPULATION',
      severity: 'MEDIUM',
      description: `Unusual weight pattern: ${weight} vs expected ${expectedWeight} for ${giverRole}`,
      detectionMethod: 'AUTOMATIC',
      metadata: {
        actualWeight: weight,
        expectedWeight,
        variance: weightVariance,
        giverRole
      }
    });
  }
  
  return flags;
}

// Calculate severity score
function calculateSeverityScore(flags: AbuseFlag[]): { severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL', score: number } {
  let totalScore = 0;
  
  for (const flag of flags) {
    switch (flag.severity) {
      case 'LOW':
        totalScore += ABUSE_THRESHOLDS.lowSeverityScore;
        break;
      case 'MEDIUM':
        totalScore += ABUSE_THRESHOLDS.mediumSeverityScore;
        break;
      case 'HIGH':
        totalScore += ABUSE_THRESHOLDS.highSeverityScore;
        break;
      case 'CRITICAL':
        totalScore += ABUSE_THRESHOLDS.criticalSeverityScore;
        break;
    }
  }
  
  if (totalScore >= 20) return { severity: 'CRITICAL', score: totalScore };
  if (totalScore >= 10) return { severity: 'HIGH', score: totalScore };
  if (totalScore >= 5) return { severity: 'MEDIUM', score: totalScore };
  return { severity: 'LOW', score: totalScore };
}

// Adjust weight based on flags
function calculateAdjustedWeight(originalWeight: number, flags: AbuseFlag[]): number {
  let adjustedWeight = originalWeight;
  
  for (const flag of flags) {
    switch (flag.flagType) {
      case 'RECIPROCITY':
        adjustedWeight *= 0.7; // 30% reduction for reciprocity
        break;
      case 'FREQUENCY':
        adjustedWeight *= 0.8; // 20% reduction for frequency abuse
        break;
      case 'CONTENT':
        adjustedWeight *= 0.9; // 10% reduction for content issues
        break;
      case 'WEIGHT_MANIPULATION':
        adjustedWeight *= 0.5; // 50% reduction for weight manipulation
        break;
      case 'EVIDENCE':
        adjustedWeight *= 0.6; // 40% reduction for evidence issues
        break;
    }
  }
  
  return Math.max(0.1, Math.round(adjustedWeight * 100) / 100); // Minimum 0.1 weight
}

// Store abuse flags in database
async function storeAbuseFlags(recognitionId: string, flags: AbuseFlag[], severity: string): Promise<void> {
  for (const flag of flags) {
    await databases.createDocument(
      DATABASE_ID,
      ABUSE_FLAGS_COLLECTION_ID,
      ID.unique(),
      {
        recognitionId,
        flagType: flag.flagType,
        severity: flag.severity,
        description: flag.description,
        detectionMethod: flag.detectionMethod,
        flaggedBy: 'SYSTEM',
        flaggedAt: new Date().toISOString(),
        status: 'PENDING',
        metadata: JSON.stringify(flag.metadata),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
    );
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

// Main abuse detection function
export async function detectRecognitionAbuse(
  recognitionId: string,
  giverId: string,
  recipientId: string,
  reason: string,
  weight: number,
  evidenceCount: number,
  giverRole: string
): Promise<AbuseDetectionResult> {
  try {
    const allFlags: AbuseFlag[] = [];
    
    // Run all detection algorithms
    const reciprocityFlags = await detectReciprocityAbuse(giverId, recipientId);
    const frequencyFlags = await detectFrequencyAbuse(giverId);
    const contentFlags = await detectContentAbuse(giverId, reason);
    const weightFlags = await detectWeightManipulation(weight, evidenceCount, giverRole);
    
    allFlags.push(...reciprocityFlags, ...frequencyFlags, ...contentFlags, ...weightFlags);
    
    const { severity, score } = calculateSeverityScore(allFlags);
    const isAbusive = allFlags.length > 0;
    const adjustedWeight = isAbusive ? calculateAdjustedWeight(weight, allFlags) : weight;
    
    // Store flags if any detected
    if (isAbusive) {
      await storeAbuseFlags(recognitionId, allFlags, severity);
      
      // Create audit entry for abuse detection
      await createAuditEntry(
        'ABUSE_FLAGGED',
        'system',
        recognitionId,
        {
          flagCount: allFlags.length,
          severity,
          severityScore: score,
          originalWeight: weight,
          adjustedWeight,
          flagTypes: allFlags.map(f => f.flagType),
          reasonCodes: allFlags.map(f => WEIGHT_ADJUSTMENT_REASONS[f.flagType as keyof typeof WEIGHT_ADJUSTMENT_REASONS] || 'Unknown reason')
        }
      );
    }
    
    return {
      isAbusive,
      flags: allFlags,
      adjustedWeight: isAbusive ? adjustedWeight : undefined,
      severity,
      reasonCodes: allFlags.map(f => WEIGHT_ADJUSTMENT_REASONS[f.flagType as keyof typeof WEIGHT_ADJUSTMENT_REASONS] || 'Unknown reason')
    };
    
  } catch (error) {
    console.error('Abuse detection failed:', error);
    
    // Create error audit entry
    await createAuditEntry(
      'ABUSE_DETECTION_ERROR',
      'system',
      recognitionId,
      {
        error: error instanceof Error ? error.message : 'Unknown error',
        giverId: hashUserId(giverId),
        recipientId: hashUserId(recipientId)
      }
    );
    
    // Fail safe - return no abuse detected on error
    return {
      isAbusive: false,
      flags: [],
      severity: 'LOW',
      reasonCodes: []
    };
  }
}

// Export the main detection function and utilities
export {
  ABUSE_THRESHOLDS,
  FLAG_TYPES,
  hashUserId,
  calculateAdjustedWeight,
  storeAbuseFlags,
  createAuditEntry
};