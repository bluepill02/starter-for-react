/**
 * Batch Verification Endpoint
 * 
 * Processes bulk approval/rejection of multiple recognitions.
 * 
 * POST /api/functions/batch-verify-recognitions
 * Body: {
 *   recognitionIds: string[],
 *   action: 'approve' | 'reject',
 *   notes: string,
 *   verifierId: string
 * }
 * Returns: { successCount: number, failureCount: number, details: [...] }
 */

const { Client, Databases, ID } = require('node-appwrite');

const appwriteClient = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT)
  .setProject(process.env.APPWRITE_PROJECT_ID)
  .setKey(process.env.APPWRITE_API_KEY);

const databases = new Databases(appwriteClient);

module.exports = async (req, res) => {
  try {
    // Validate request
    if (req.method !== 'POST') {
      return res.json(
        { error: 'Method not allowed' },
        { statusCode: 405 }
      );
    }

    const { recognitionIds = [], action, notes, verifierId } = req.body;

    if (!recognitionIds.length || !action || !verifierId) {
      return res.json(
        {
          error: 'Missing required fields: recognitionIds, action, verifierId'
        },
        { statusCode: 400 }
      );
    }

    if (!['approve', 'reject'].includes(action)) {
      return res.json(
        { error: 'Action must be "approve" or "reject"' },
        { statusCode: 400 }
      );
    }

    // Verify user is manager/admin
    const verifier = await databases.getDocument(
      process.env.APPWRITE_DATABASE_ID,
      'Users',
      verifierId
    );

    if (!['manager', 'admin'].includes(verifier.role)) {
      return res.json(
        { error: 'Unauthorized: User is not a manager' },
        { statusCode: 403 }
      );
    }

    // Process each recognition
    const results = [];
    let successCount = 0;
    let failureCount = 0;

    for (const recognitionId of recognitionIds) {
      try {
        // Fetch recognition
        const recognition = await databases.getDocument(
          process.env.APPWRITE_DATABASE_ID,
          'Recognitions',
          recognitionId
        );

        // Check if already verified
        if (recognition.status === 'verified' || recognition.status === 'rejected') {
          results.push({
            id: recognitionId,
            status: 'skipped',
            reason: `Already ${recognition.status}`
          });
          continue;
        }

        // Determine new status and update weight if approved
        const newStatus = action === 'approve' ? 'verified' : 'rejected';
        const updateData = {
          status: newStatus,
          verifiedBy: verifierId,
          verificationNote: notes || '',
          verifiedAt: new Date().toISOString()
        };

        // If rejecting, reduce weight to 0
        if (action === 'reject') {
          updateData.weight = 0;
          updateData.verificationStatus = 'rejected';
        } else {
          // If approving, weight already calculated; just mark as verified
          updateData.verificationStatus = 'approved';
        }

        // Update recognition
        await databases.updateDocument(
          process.env.APPWRITE_DATABASE_ID,
          'Recognitions',
          recognitionId,
          updateData
        );

        // Create audit entry
        await databases.createDocument(
          process.env.APPWRITE_DATABASE_ID,
          'RecognitionAudit',
          ID.unique(),
          {
            eventCode: action === 'approve' ? 'recognition_approved' : 'recognition_rejected',
            actor: verifierId,
            target: recognition.giverId,
            details: {
              recognitionId,
              recipientId: recognition.recipientId,
              batchSize: recognitionIds.length,
              verificationNote: notes
            },
            timestamp: new Date().toISOString(),
            ipAddress: req.headers['x-forwarded-for'] || 'unknown',
            userAgent: req.headers['user-agent'] || 'unknown'
          }
        );

        // Update recipient's stats if approved
        if (action === 'approve') {
          const recipient = await databases.getDocument(
            process.env.APPWRITE_DATABASE_ID,
            'Users',
            recognition.recipientId
          );

          const newWeight = (recipient.totalWeight || 0) + (recognition.weight || 1);
          const newCount = (recipient.recognitionCount || 0) + 1;

          await databases.updateDocument(
            process.env.APPWRITE_DATABASE_ID,
            'Users',
            recognition.recipientId,
            {
              totalWeight: newWeight,
              recognitionCount: newCount,
              lastRecognitionAt: new Date().toISOString()
            }
          );
        }

        results.push({
          id: recognitionId,
          status: 'success',
          newStatus
        });

        successCount++;
      } catch (itemError) {
        failureCount++;
        results.push({
          id: recognitionId,
          status: 'error',
          error: itemError.message
        });
      }
    }

    return res.json({
      successCount,
      failureCount,
      totalProcessed: recognitionIds.length,
      action,
      details: results,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error batch verifying recognitions:', error);
    return res.json(
      {
        error: 'Internal server error',
        details: error.message
      },
      { statusCode: 500 }
    );
  }
};
