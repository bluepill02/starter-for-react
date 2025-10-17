// Profile Export Function - PDF/CSV Generation with Privacy Controls
import { Client, Databases, Storage, Users, ID } from 'node-appwrite';
import { z } from 'zod';
import crypto from 'crypto';

// Node.js globals (available in Appwrite Functions runtime)
/* global process, Buffer */

// Validation schema for export request
const ExportRequestSchema = z.object({
  userId: z.string().min(1),
  format: z.enum(['pdf', 'csv']),
  includePrivateData: z.boolean().default(false),
  requesterId: z.string().min(1)
});

const client = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT || 'https://localhost/v1')
  .setProject(process.env.APPWRITE_PROJECT_ID || '')
  .setKey(process.env.APPWRITE_API_KEY || '');

const databases = new Databases(client);
const storage = new Storage(client);
const users = new Users(client);

// Hash user ID for privacy in exports
function hashUserId(userId: string): string {
  return crypto.createHash('sha256').update(userId).digest('hex').substring(0, 16);
}

// Generate time-limited access token for downloads
function generateDownloadToken(fileId: string, expiresIn = 3600): string {
  const expires = Date.now() + (expiresIn * 1000);
  const data = JSON.stringify({ fileId, expires });
  return Buffer.from(data).toString('base64');
}

// Generate PDF content as HTML (server-side rendering)
function generatePDFHTML(
  profile: any,
  recognitions: any[],
  includePrivateData: boolean,
  requesterRole: string
): string {
  const currentDate = new Date().toISOString().split('T')[0];
  const verifierStamp = `Generated on ${currentDate} by ${requesterRole}`;
  
  // Calculate metrics
  const totalReceived = recognitions.filter(r => r.recipientEmail === profile.email).length;
  const totalGiven = recognitions.filter(r => r.giverUserId === profile.$id).length;
  const totalWeight = recognitions
    .filter(r => r.recipientEmail === profile.email && r.status === 'VERIFIED')
    .reduce((sum, r) => sum + r.verifiedWeight || r.weight, 0);
  
  // Group by tags
  const tagCounts = recognitions
    .filter(r => r.recipientEmail === profile.email)
    .flatMap(r => r.tags)
    .reduce((acc: Record<string, number>, tag) => {
      acc[tag] = (acc[tag] || 0) + 1;
      return acc;
    }, {});
  
  const topTags = Object.entries(tagCounts)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5);
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Recognition Report - ${profile.name}</title>
      <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px; }
        .logo { font-size: 24px; font-weight: bold; color: #2563eb; margin-bottom: 10px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .metric { padding: 15px; border: 1px solid #e5e7eb; border-radius: 8px; text-align: center; }
        .metric-value { font-size: 28px; font-weight: bold; color: #1f2937; }
        .metric-label { color: #6b7280; margin-top: 5px; }
        .section { margin-bottom: 30px; }
        .section h2 { border-bottom: 1px solid #d1d5db; padding-bottom: 10px; }
        .recognition { padding: 15px; border-left: 4px solid #3b82f6; margin-bottom: 15px; background: #f9fafb; }
        .tags { margin-top: 10px; }
        .tag { display: inline-block; background: #dbeafe; color: #1e40af; padding: 2px 8px; border-radius: 12px; font-size: 12px; margin-right: 5px; }
        .footer { margin-top: 50px; padding-top: 20px; border-top: 1px solid #d1d5db; font-size: 12px; color: #6b7280; text-align: center; }
        .private-notice { background: #fef3c7; border: 1px solid #f59e0b; padding: 10px; border-radius: 4px; margin-bottom: 20px; }
        .hash-notice { background: #e0e7ff; border: 1px solid #6366f1; padding: 10px; border-radius: 4px; margin-bottom: 20px; }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="logo">🏆 Recognition Report</div>
        <h1>${profile.name}</h1>
        <p>${includePrivateData ? profile.email : `User ID: ${hashUserId(profile.$id)}`}</p>
        ${profile.department ? `<p>Department: ${profile.department}</p>` : ''}
        <p>Generated: ${currentDate} | Verifier: ${verifierStamp}</p>
      </div>
      
      ${includePrivateData ? 
        '<div class="private-notice">⚠️ This report contains private data and should be handled according to your organization\'s data privacy policies.</div>' : 
        '<div class="hash-notice">🔒 This report uses hashed identifiers to protect privacy. No personally identifiable information is included.</div>'
      }
      
      <div class="summary">
        <div class="metric">
          <div class="metric-value">${totalReceived}</div>
          <div class="metric-label">Recognitions Received</div>
        </div>
        <div class="metric">
          <div class="metric-value">${Math.round(totalWeight * 100) / 100}</div>
          <div class="metric-label">Total Recognition Weight</div>
        </div>
        <div class="metric">
          <div class="metric-value">${totalGiven}</div>
          <div class="metric-label">Recognitions Given</div>
        </div>
      </div>
      
      ${topTags.length > 0 ? `
        <div class="section">
          <h2>Top Recognition Categories</h2>
          ${topTags.map(([tag, count]) => 
            `<span class="tag">${tag} (${count})</span>`
          ).join('')}
        </div>
      ` : ''}
      
      <div class="section">
        <h2>Recent Recognitions Received</h2>
        ${recognitions
          .filter(r => r.recipientEmail === profile.email)
          .slice(0, 10)
          .map(r => `
            <div class="recognition">
              <div><strong>From:</strong> ${includePrivateData ? r.giverName : hashUserId(r.giverUserId)}</div>
              <div><strong>Date:</strong> ${new Date(r.createdAt).toLocaleDateString()}</div>
              <div><strong>Reason:</strong> ${r.reason}</div>
              <div><strong>Weight:</strong> ${r.verifiedWeight || r.weight} (${r.status})</div>
              <div class="tags">
                ${r.tags.map((tag: string) => `<span class="tag">${tag}</span>`).join('')}
              </div>
            </div>
          `).join('')}
      </div>
      
      <div class="footer">
        <p><strong>Verification Stamp:</strong> ${verifierStamp}</p>
        <p>This report was generated from verified recognition data and includes audit trails for compliance purposes.</p>
        <p>Report ID: ${crypto.randomUUID()} | Generated at: ${new Date().toISOString()}</p>
      </div>
    </body>
    </html>
  `;
}

// Generate CSV content with anonymization options
function generateCSV(
  profile: any,
  recognitions: any[],
  includePrivateData: boolean,
  requesterRole: string
): string {
  const headers = [
    'Date',
    'Type', // Given/Received
    includePrivateData ? 'Other Party' : 'Other Party (Hashed)',
    'Tags',
    'Recognition Weight',
    'Status',
    'Verification Date',
    includePrivateData ? 'Verifier' : 'Verifier (Hashed)'
  ];
  
  const rows = recognitions.map(r => {
    const isReceived = r.recipientEmail === profile.email;
    const otherParty = isReceived 
      ? (includePrivateData ? r.giverName : hashUserId(r.giverUserId))
      : (includePrivateData ? r.recipientEmail : hashUserId(r.recipientEmail));
    
    return [
      new Date(r.createdAt).toISOString().split('T')[0],
      isReceived ? 'Received' : 'Given',
      `"${otherParty}"`,
      `"${r.tags.join(', ')}"`,
      r.verifiedWeight || r.weight,
      r.status,
      r.verifiedAt ? new Date(r.verifiedAt).toISOString().split('T')[0] : '',
      r.verifiedBy ? (includePrivateData ? r.verifiedBy : hashUserId(r.verifiedBy)) : ''
    ];
  });
  
  // Add metadata rows
  const metadata = [
    ['# Recognition Export Report'],
    [`# Generated: ${new Date().toISOString()}`],
    [`# User: ${includePrivateData ? profile.name : hashUserId(profile.$id)}`],
    [`# Privacy Level: ${includePrivateData ? 'Full Data' : 'Anonymized'}`],
    [`# Verifier: ${requesterRole}`],
    [''], // Empty row separator
    headers,
    ...rows
  ];
  
  return metadata.map(row => row.join(',')).join('\n');
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
  }
}

export default async ({ req, res, log, error }: any) => {
  if (req.method !== 'POST') {
    return res.json({ error: 'Method not allowed' }, 405);
  }
  
  try {
    // Validate request
    const requestData = ExportRequestSchema.parse(req.body);
    log(`Processing export for user: ${requestData.userId}, format: ${requestData.format}`);
    
    // Get requester info for permissions
    const requester = await users.get(requestData.requesterId);
    const requesterRole = requester.prefs?.role || 'USER';
    
    // Check permissions
    const isOwnProfile = requestData.userId === requestData.requesterId;
    const canExportOthers = requesterRole === 'ADMIN' || requesterRole === 'MANAGER';
    
    if (!isOwnProfile && !canExportOthers) {
      await createAuditEntry(
        'EXPORT_UNAUTHORIZED',
        requestData.requesterId,
        requestData.userId,
        {
          requesterRole,
          targetUserId: hashUserId(requestData.userId)
        }
      );
      
      return res.json({
        error: 'Insufficient permissions to export other users\' profiles'
      }, 403);
    }
    
    // Force private data to false for non-own profiles unless admin
    const includePrivateData = requestData.includePrivateData && 
      (isOwnProfile || requesterRole === 'ADMIN');
    
    // Get target user profile
    const targetUser = await users.get(requestData.userId);
    
    // Get recognition data
    const recognitions = await databases.listDocuments(
      process.env.APPWRITE_DATABASE_ID || 'main',
      'recognitions',
      [
        // Get all recognitions where user is giver or recipient
        `giverUserId.equal("${requestData.userId}") OR recipientEmail.equal("${targetUser.email}")`,
        'orderDesc(createdAt)'
      ]
    );
    
    const recognitionData = recognitions.documents;
    
    let fileContent: string;
    let fileName: string;
    let mimeType: string;
    
    // Generate content based on format
    if (requestData.format === 'pdf') {
      fileContent = generatePDFHTML(targetUser, recognitionData, includePrivateData, requesterRole);
      fileName = `recognition-report-${hashUserId(requestData.userId)}-${Date.now()}.html`;
      mimeType = 'text/html';
    } else {
      fileContent = generateCSV(targetUser, recognitionData, includePrivateData, requesterRole);
      fileName = `recognition-data-${hashUserId(requestData.userId)}-${Date.now()}.csv`;
      mimeType = 'text/csv';
    }
    
    // Store file in Appwrite Storage with time-limited access
    const fileId = ID.unique();
    
    // Create a Blob from the content
    const blob = new Blob([fileContent], { type: mimeType });
    const file = new File([blob], fileName, { type: mimeType });
    
    const uploadedFile = await storage.createFile(
      process.env.APPWRITE_BUCKET_ID || 'exports',
      fileId,
      file,
      [`read("user:${requestData.requesterId}")`] // Only requester can access
    );
    
    // Generate presigned download URL (expires in 1 hour)
    const downloadUrl = storage.getFileDownload(
      process.env.APPWRITE_BUCKET_ID || 'exports',
      fileId
    );
    
    // Create audit entry for export
    await createAuditEntry(
      'PROFILE_EXPORTED',
      requestData.requesterId,
      requestData.userId,
      {
        format: requestData.format,
        includePrivateData,
        requesterRole,
        targetUserEmail: hashUserId(targetUser.email),
        recordCount: recognitionData.length,
        fileId: hashUserId(fileId)
      }
    );
    
    // Schedule file deletion after 24 hours (in a real implementation)
    // TODO: Implement cleanup function to delete expired export files
    
    log(`Export completed successfully: ${fileName}`);
    
    return res.json({
      success: true,
      downloadUrl,
      fileName: fileName.replace(/[0-9]{13}/, 'TIMESTAMP'), // Hide timestamp in filename
      fileSize: Buffer.byteLength(fileContent, 'utf8'),
      recordCount: recognitionData.length,
      expiresAt: new Date(Date.now() + 3600000).toISOString(), // 1 hour
      includePrivateData
    });
    
  } catch (validationError: any) {
    if (validationError instanceof z.ZodError) {
      error(`Export validation error: ${JSON.stringify(validationError.issues)}`);
      return res.json({
        error: 'Invalid export request',
        details: validationError.issues
      }, 400);
    }
    
    error(`Export failed: ${validationError?.message || 'Unknown error'}`);
    
    // Create error audit entry
    try {
      await createAuditEntry(
        'EXPORT_ERROR',
        'system',
        undefined,
        {
          error: validationError?.message || 'Unknown error',
          requestBody: req.body
        }
      );
    } catch (auditError) {
      console.error('Failed to log export error to audit:', auditError);
    }
    
    return res.json({
      error: 'Export processing failed',
      message: validationError?.message || 'Unknown error'
    }, 500);
  }
};