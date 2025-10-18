
import { z } from 'zod';

// Recognition Visibility Schema
export const RecognitionVisibilitySchema = z.enum(['PRIVATE', 'TEAM', 'PUBLIC']);
export type RecognitionVisibility = z.infer<typeof RecognitionVisibilitySchema>;

// User Schema
export const UserSchema = z.object({
  $id: z.string(),
  name: z.string(),
  email: z.string().email(),
  avatar: z.string().url().optional(),
  role: z.enum(['USER', 'MANAGER', 'ADMIN']).default('USER'),
  department: z.string().optional(),
  managerId: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type User = z.infer<typeof UserSchema>;

// Create Recognition Schema
export const CreateRecognitionSchema = z.object({
  recipientId: z.string().min(1, 'Recipient is required'),
  reason: z.string().min(20, 'Reason must be at least 20 characters for evidence-weighted recognition'),
  tags: z.array(z.string()).max(3, 'Maximum 3 tags allowed'),
  evidenceStorageId: z.string().optional(),
  visibility: RecognitionVisibilitySchema.default('PRIVATE'),
  weight: z.number().min(0).max(10).default(1),
});
export type CreateRecognition = z.infer<typeof CreateRecognitionSchema>;

// Recognition Schema
export const RecognitionSchema = z.object({
  $id: z.string(),
  giverId: z.string(),
  recipientId: z.string(),
  reason: z.string(),
  tags: z.array(z.string()),
  evidenceStorageId: z.string().optional(),
  evidencePreviewUrl: z.string().url().optional(),
  visibility: RecognitionVisibilitySchema,
  weight: z.number(),
  verified: z.boolean().default(false),
  verifierId: z.string().optional(),
  verificationNote: z.string().optional(),
  verifiedAt: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Recognition = z.infer<typeof RecognitionSchema>;

// Audit Entry Schema
export const AuditEntrySchema = z.object({
  $id: z.string(),
  eventCode: z.enum([
    'RECOGNITION_CREATED',
    'RECOGNITION_VERIFIED', 
    'RECOGNITION_EXPORTED',
    'RECOGNITION_BLOCKED',
    'RECOGNITION_ERROR',
    'EVIDENCE_UPLOADED',
    'EVIDENCE_PREVIEWED',
    'ADMIN_ACTION',
    'ADMIN_OVERRIDE',
    'ABUSE_FLAGGED',
    'ABUSE_REVIEWED',
    'ABUSE_DISMISSED',
    'USER_SYNCED',
    'INTEGRATION_CALLED',
    'TELEMETRY_EVENT'
  ]),
  actorId: z.string(), // Hashed user ID for privacy
  targetId: z.string().optional(), // Hashed target ID (recognition, user, etc.)
  metadata: z.record(z.string(), z.any()).optional(),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
  createdAt: z.string().datetime(),
});
export type AuditEntry = z.infer<typeof AuditEntrySchema>;

// Abuse Flag Schema
export const AbuseFlagSchema = z.object({
  $id: z.string(),
  recognitionId: z.string(),
  flagType: z.enum(['RECIPROCITY', 'FREQUENCY', 'CONTENT', 'EVIDENCE', 'WEIGHT_MANIPULATION', 'MANUAL']),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  description: z.string(),
  detectionMethod: z.enum(['AUTOMATIC', 'REPORTED', 'MANUAL_REVIEW']),
  flaggedBy: z.enum(['SYSTEM', 'USER', 'ADMIN']),
  flaggedAt: z.string().datetime(),
  status: z.enum(['PENDING', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED']),
  reviewedBy: z.string().optional(), // Admin who reviewed
  reviewedAt: z.string().datetime().optional(),
  reviewNotes: z.string().optional(),
  originalWeight: z.number().optional(),
  adjustedWeight: z.number().optional(),
  actionTaken: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type AbuseFlag = z.infer<typeof AbuseFlagSchema>;

// Admin Override Schema
export const AdminOverrideSchema = z.object({
  flagId: z.string(),
  action: z.enum(['DISMISS', 'APPROVE', 'ADJUST_WEIGHT', 'ESCALATE']),
  justification: z.string().min(10, 'Justification required for admin actions'),
  newWeight: z.number().min(0).max(10).optional(),
  escalationReason: z.string().optional(),
});
export type AdminOverride = z.infer<typeof AdminOverrideSchema>;

// Telemetry Event Schema
export const TelemetryEventSchema = z.object({
  eventType: z.enum(['recognition_created', 'recognition_verified', 'export_requested', 'abuse_detected', 'admin_action']),
  hashedUserId: z.string(), // Privacy-safe hashed ID
  hashedTargetId: z.string().optional(),
  metadata: z.object({
    tags: z.array(z.string()).optional(),
    evidencePresent: z.boolean().optional(),
    source: z.enum(['WEB', 'SLACK', 'TEAMS', 'API']).optional(),
    weight: z.number().optional(),
    flagType: z.string().optional(),
    severity: z.string().optional(),
  }).optional(),
  timestamp: z.string().datetime(),
});
export type TelemetryEvent = z.infer<typeof TelemetryEventSchema>;

// Export Evidence Upload Schema
export const EvidenceUploadSchema = z.object({
  file: z.instanceof(File),
  recognitionDraftId: z.string().optional(),
});
export type EvidenceUpload = z.infer<typeof EvidenceUploadSchema>;

// Export Profile Schema
export const ExportProfileSchema = z.object({
  userId: z.string(),
  format: z.enum(['PDF', 'CSV']),
  includePrivate: z.boolean().default(false),
  dateRange: z.object({
    start: z.string().datetime(),
    end: z.string().datetime(),
  }).optional(),
  anonymize: z.boolean().default(false), // For HR exports
});
export type ExportProfile = z.infer<typeof ExportProfileSchema>;

// Verification Schema
export const VerificationSchema = z.object({
  recognitionId: z.string(),
  verified: z.boolean(),
  note: z.string().optional(),
});
export type Verification = z.infer<typeof VerificationSchema>;