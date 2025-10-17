import { Client, Databases, Storage } from 'node-appwrite';
import { z } from 'zod';
import sharp from 'sharp';
import crypto from 'crypto';

// Node.js globals (available in Appwrite Functions runtime)
/* global process, Buffer */

// Validation schema for preview request
const PreviewRequestSchema = z.object({
  fileId: z.string().min(1),
  fileName: z.string().min(1),
  fileSize: z.number().positive(),
  mimeType: z.string().min(1),
  recognitionId: z.string().min(1),
  uploaderId: z.string().min(1)
});

// Response schema
const PreviewResponseSchema = z.object({
  previewId: z.string(),
  thumbnailUrl: z.string().optional(),
  contentSummary: z.string().optional(),
  securityFlags: z.array(z.string()),
  processingStatus: z.enum(['completed', 'partial', 'failed']),
  auditId: z.string()
});

const client = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT)
  .setProject(process.env.APPWRITE_PROJECT_ID)
  .setKey(process.env.APPWRITE_API_KEY);

const databases = new Databases(client);
const storage = new Storage(client);

// Generate secure hash for content scanning
function generateContentHash(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

// Simple content security scanner
function scanForSecurityFlags(buffer, mimeType, fileName) {
  const flags = [];
  
  // Check file size limits
  if (buffer.length > 50 * 1024 * 1024) { // 50MB
    flags.push('oversized_file');
  }
  
  // Basic executable detection
  const executableExtensions = ['.exe', '.scr', '.bat', '.com', '.cmd', '.pif'];
  if (executableExtensions.some(ext => fileName.toLowerCase().endsWith(ext))) {
    flags.push('executable_file');
  }
  
  // Check for suspicious content patterns
  const suspiciousPatterns = [
    /eval\s*\(/gi,
    /document\.write\s*\(/gi,
    /innerHTML\s*=/gi,
    /<script[^>]*>/gi
  ];
  
  if (mimeType.includes('text') || mimeType.includes('javascript')) {
    const content = buffer.toString('utf8');
    for (const pattern of suspiciousPatterns) {
      if (pattern.test(content)) {
        flags.push('suspicious_script_content');
        break;
      }
    }
  }
  
  return flags;
}

// Generate thumbnail for supported image types
async function generateThumbnail(buffer, mimeType) {
  if (!mimeType.startsWith('image/')) {
    return null;
  }
  
  try {
    const thumbnailBuffer = await sharp(buffer)
      .resize(200, 200, { 
        fit: 'inside', 
        withoutEnlargement: true 
      })
      .jpeg({ quality: 80 })
      .toBuffer();
    
    // Upload thumbnail to storage
    const thumbnailId = `thumb_${crypto.randomUUID()}`;
    const thumbnailFile = await storage.createFile(
      process.env.APPWRITE_BUCKET_ID,
      thumbnailId,
      thumbnailBuffer,
      ['read("any")'] // Readable by authenticated users
    );
    
    return storage.getFilePreview(
      process.env.APPWRITE_BUCKET_ID,
      thumbnailFile.$id,
      200,
      200
    );
  } catch {
    return null;
  }
}

// Generate content summary for text files
function generateContentSummary(buffer, mimeType, maxLength = 500) {
  if (!mimeType.includes('text') && !mimeType.includes('json')) {
    return `${mimeType} file (${Math.round(buffer.length / 1024)}KB)`;
  }
  
  try {
    const content = buffer.toString('utf8');
    if (content.length <= maxLength) {
      return content.trim();
    }
    
    return content.substring(0, maxLength).trim() + '...';
  } catch {
    return 'Unable to process text content';
  }
}

export default async ({ req, res, log, error }) => {
  if (req.method !== 'POST') {
    return res.json({ 
      error: 'Method not allowed' 
    }, 405);
  }
  
  try {
    // Validate request body
    const requestData = PreviewRequestSchema.parse(req.body);
    log(`Processing preview for file: ${requestData.fileName}`);
    
    // Download file from storage
    let fileBuffer;
    try {
      const fileData = await storage.getFileDownload(
        process.env.APPWRITE_BUCKET_ID,
        requestData.fileId
      );
      fileBuffer = Buffer.from(fileData);
    } catch (downloadError) {
      error(`Failed to download file ${requestData.fileId}: ${downloadError.message}`);
      throw new Error('File download failed');
    }
    
    // Generate content hash for deduplication
    const contentHash = generateContentHash(fileBuffer);
    
    // Run security scanning
    const securityFlags = scanForSecurityFlags(
      fileBuffer, 
      requestData.mimeType, 
      requestData.fileName
    );
    
    // Generate thumbnail if applicable
    const thumbnailUrl = await generateThumbnail(fileBuffer, requestData.mimeType);
    
    // Generate content summary
    const contentSummary = generateContentSummary(fileBuffer, requestData.mimeType);
    
    // Create preview record in database
    const previewId = `preview_${crypto.randomUUID()}`;
    const auditId = `audit_${crypto.randomUUID()}`;
    
    const previewData = {
      $id: previewId,
      fileId: requestData.fileId,
      recognitionId: requestData.recognitionId,
      uploaderId: requestData.uploaderId,
      contentHash,
      thumbnailUrl,
      contentSummary,
      securityFlags,
      processingTimestamp: new Date().toISOString(),
      fileSize: requestData.fileSize,
      mimeType: requestData.mimeType,
      fileName: requestData.fileName
    };
    
    // Store preview data
    await databases.createDocument(
      process.env.APPWRITE_DATABASE_ID,
      'evidence_previews',
      previewId,
      previewData
    );
    
    // Create audit entry for preview processing
    const auditEntry = {
      $id: auditId,
      eventType: 'evidence_preview_generated',
      fileId: requestData.fileId,
      recognitionId: requestData.recognitionId,
      uploaderId: crypto.createHash('sha256').update(requestData.uploaderId).digest('hex'),
      metadata: {
        hashedFileId: crypto.createHash('sha256').update(requestData.fileId).digest('hex'),
        fileSize: requestData.fileSize,
        mimeType: requestData.mimeType,
        securityFlags: securityFlags.length,
        hasThumbnail: !!thumbnailUrl,
        contentHashPrefix: contentHash.substring(0, 8)
      },
      timestamp: new Date().toISOString()
    };
    
    await databases.createDocument(
      process.env.APPWRITE_DATABASE_ID,
      'recognition_audits',
      auditId,
      auditEntry
    );
    
    const response = {
      previewId,
      thumbnailUrl,
      contentSummary,
      securityFlags,
      processingStatus: 'completed',
      auditId
    };
    
    // Validate response structure
    const validatedResponse = PreviewResponseSchema.parse(response);
    
    log(`Preview generated successfully for ${requestData.fileName}, flags: ${securityFlags.length}`);
    return res.json(validatedResponse);
    
  } catch (validationError) {
    if (validationError instanceof z.ZodError) {
      error(`Validation error: ${JSON.stringify(validationError.errors)}`);
      return res.json({
        error: 'Invalid request data',
        details: validationError.errors
      }, 400);
    }
    
    error(`Preview processing failed: ${validationError.message}`);
    return res.json({
      error: 'Preview processing failed',
      message: validationError.message
    }, 500);
  }
};