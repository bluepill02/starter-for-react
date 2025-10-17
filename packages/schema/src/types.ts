
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
    'EVIDENCE_UPLOADED',
    'EVIDENCE_PREVIEWED',
    'ADMIN_ACTION',
    'ABUSE_FLAGGED',
    'ABUSE_REVIEWED',
    'USER_SYNCED',
    'INTEGRATION_CALLED'
  ]),
  actorId: z.string(), // Hashed user ID for privacy
  targetId: z.string().optional(), // Hashed target ID (recognition, user, etc.)
  metadata: z.record(z.string(), z.any()).optional(),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
  createdAt: z.string().datetime(),
});
export type AuditEntry = z.infer<typeof AuditEntrySchema>;

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