// Evidence Preview Appwrite Function - Production Implementation
import { Client, Databases, Storage, ID } from 'node-appwrite';

// Environment variables
const APPWRITE_ENDPOINT = process.env.APPWRITE_ENDPOINT || 'https://localhost/v1';
const APPWRITE_PROJECT_ID = process.env.APPWRITE_PROJECT_ID!;
const APPWRITE_API_KEY = process.env.APPWRITE_API_KEY!;
const DATABASE_ID = process.env.DATABASE_ID || 'main';
const EVIDENCE_METADATA_COLLECTION_ID = process.env.EVIDENCE_METADATA_COLLECTION_ID || 'evidence_metadata';
const AUDIT_COLLECTION_ID = process.env.AUDIT_COLLECTION_ID || 'audit_entries';

// Initialize Appwrite client
const client = new Client()
  .setEndpoint(APPWRITE_ENDPOINT)
  .setProject(APPWRITE_PROJECT_ID)
  .setKey(APPWRITE_API_KEY);

const databases = new Databases(client);
const storage = new Storage(client);

interface EvidencePreviewRequest {
  storageId: string;
  filename: string;
  fileType: string;
  fileSize: number;
}

// Content analysis for manual review flags
const REVIEW_TRIGGERS = {
  suspiciousKeywords: [
    'fake', 'fraud', 'lie', 'cheat', 'scam', 'manipulation',
    'confidential', 'secret', 'private', 'sensitive'
  ],
  maxFileSize: 50 * 1024 * 1024, // 50MB files need review
  requiresReview: ['application/zip', 'application/x-rar', 'application/octet-stream']
};

// Generate file preview metadata
function generatePreviewMetadata(filename: string, fileType: string, fileSize: number) {
  const preview: any = {
    filename,
    fileType,
    fileSize,
    category: 'other',
    needsReview: false,
    reviewReasons: [],
    previewAvailable: false,
  };

  // Categorize file type
  if (fileType.startsWith('image/')) {
    preview.category = 'image';
    preview.previewAvailable = true;
    preview.thumbnailSupported = ['image/jpeg', 'image/png', 'image/webp'].includes(fileType);
  } else if (fileType === 'application/pdf') {
    preview.category = 'document';
    preview.previewAvailable = true;
  } else if (fileType.includes('word') || fileType.includes('document')) {
    preview.category = 'document';
  } else if (fileType === 'text/plain') {
    preview.category = 'text';
    preview.previewAvailable = true;
  }

  // Flag for manual review
  if (fileSize > REVIEW_TRIGGERS.maxFileSize) {
    preview.needsReview = true;
    preview.reviewReasons.push('Large file size');
  }

  if (REVIEW_TRIGGERS.requiresReview.includes(fileType)) {
    preview.needsReview = true;
    preview.reviewReasons.push('Suspicious file type');
  }

  // Check filename for suspicious content
  const lowerFilename = filename.toLowerCase();
  const foundSuspiciousKeywords = REVIEW_TRIGGERS.suspiciousKeywords.filter(keyword =>
    lowerFilename.includes(keyword)
  );
  
  if (foundSuspiciousKeywords.length > 0) {
    preview.needsReview = true;
    preview.reviewReasons.push('Suspicious filename content');
  }

  return preview;
}

// Create audit entry
async function createAuditEntry(
  eventCode: string,
  actorId: string,
  targetId?: string,
  metadata?: Record<string, any>
): Promise<void> {
  try {
    const hashId = (id: string) => Buffer.from(id).toString('base64').replace(/[+=\/]/g, '').substring(0, 16);
    
    await databases.createDocument(
      DATABASE_ID,
      AUDIT_COLLECTION_ID,
      ID.unique(),
      {
        eventCode,
        actorId: hashId(actorId),
        targetId: targetId ? hashId(targetId) : null,
        metadata: metadata ? JSON.stringify(metadata) : null,
        createdAt: new Date().toISOString(),
      }
    );
  } catch (error) {
    console.error('Failed to create audit entry:', error);
  }
}

// Extract text content from files (basic implementation)
async function extractTextContent(fileBuffer: Buffer, fileType: string): Promise<string | null> {
  try {
    if (fileType === 'text/plain') {
      return fileBuffer.toString('utf-8').substring(0, 1000); // First 1000 chars
    }
    
    // For PDF and other formats, we would integrate with services like:
    // - pdf-parse for PDFs
    // - tesseract.js for OCR on images
    // - mammoth for Word documents
    // For now, return null to indicate no text extraction
    
    return null;
  } catch (error) {
    console.error('Text extraction failed:', error);
    return null;
  }
}

// Main function execution
export default async function processEvidencePreview({ req, res }: any) {
  try {
    // Parse request body
    const body: EvidencePreviewRequest = JSON.parse(req.body || '{}');
    const { storageId, filename, fileType, fileSize } = body;

    // Validate required fields
    if (!storageId || !filename || !fileType) {
      return res.json({
        success: false,
        error: 'Missing required fields'
      }, 400);
    }

    // Generate preview metadata
    const previewMetadata = generatePreviewMetadata(filename, fileType, fileSize);

    // Get file from storage for content analysis
    let fileBuffer: Buffer | null = null;
    let textContent: string | null = null;
    
    try {
      if (fileSize < 10 * 1024 * 1024) { // Only process files under 10MB for content analysis
        const fileArrayBuffer = await storage.getFileView('evidence', storageId);
        fileBuffer = Buffer.from(fileArrayBuffer);
        
        // Extract text content for analysis
        textContent = await extractTextContent(fileBuffer, fileType);
        
        // Analyze text content for suspicious patterns
        if (textContent) {
          const suspiciousKeywords = REVIEW_TRIGGERS.suspiciousKeywords.filter(keyword =>
            textContent!.toLowerCase().includes(keyword)
          );
          
          if (suspiciousKeywords.length > 0) {
            previewMetadata.needsReview = true;
            previewMetadata.reviewReasons.push('Suspicious content detected');
            previewMetadata.suspiciousKeywords = suspiciousKeywords;
          }
          
          previewMetadata.textPreview = textContent.substring(0, 200); // First 200 chars for preview
        }
      }
    } catch (storageError) {
      console.warn('Failed to fetch file for content analysis:', storageError);
      // Continue without content analysis
    }

    // Generate file access URL (short-lived)
    let previewUrl: string | null = null;
    try {
      if (previewMetadata.previewAvailable) {
        // Generate preview URL for supported file types
        previewUrl = `${APPWRITE_ENDPOINT}/storage/buckets/evidence/files/${storageId}/preview?width=400&height=400&quality=80`;
      } else {
        // For non-previewable files, generate download URL
        previewUrl = `${APPWRITE_ENDPOINT}/storage/buckets/evidence/files/${storageId}/download`;
      }
    } catch (previewError) {
      console.warn('Failed to generate preview URL:', previewError);
      // Not all file types support preview
    }

    // Store evidence metadata in database
    const evidenceMetadata = await databases.createDocument(
      DATABASE_ID,
      EVIDENCE_METADATA_COLLECTION_ID,
      ID.unique(),
      {
        storageId,
        filename,
        fileType,
        fileSize,
        category: previewMetadata.category,
        needsReview: previewMetadata.needsReview,
        reviewReasons: previewMetadata.reviewReasons,
        previewAvailable: previewMetadata.previewAvailable,
        thumbnailSupported: previewMetadata.thumbnailSupported || false,
        textPreview: previewMetadata.textPreview || null,
        previewUrl,
        processedAt: new Date().toISOString(),
        reviewStatus: previewMetadata.needsReview ? 'PENDING' : 'APPROVED',
      }
    );

    // Create audit entry
    await createAuditEntry(
      'EVIDENCE_PROCESSED',
      'system',
      storageId,
      {
        filename,
        fileType,
        category: previewMetadata.category,
        needsReview: previewMetadata.needsReview,
        reviewReasons: previewMetadata.reviewReasons,
        fileSize
      }
    );

    // If flagged for review, create notification for admins
    if (previewMetadata.needsReview) {
      await createAuditEntry(
        'EVIDENCE_FLAGGED',
        'system',
        storageId,
        {
          reviewReasons: previewMetadata.reviewReasons,
          priority: previewMetadata.reviewReasons.includes('Suspicious content detected') ? 'HIGH' : 'MEDIUM'
        }
      );
    }

    return res.json({
      success: true,
      data: {
        metadataId: evidenceMetadata.$id,
        category: previewMetadata.category,
        previewAvailable: previewMetadata.previewAvailable,
        needsReview: previewMetadata.needsReview,
        reviewReasons: previewMetadata.reviewReasons,
        previewUrl: previewUrl,
        processedAt: evidenceMetadata.processedAt
      }
    });

  } catch (error) {
    console.error('Evidence preview processing error:', error);

    // Create error audit entry
    try {
      await createAuditEntry(
        'EVIDENCE_PROCESSING_ERROR',
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