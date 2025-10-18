/**
 * Track Share API Function
 * Tracks share interactions (clicks, views, reactions) for analytics
 * 
 * @route POST /api/track-share
 * @access Public (no authentication required for tracking)
 * @param {string} shareToken - Share token to track
 * @param {string} action - Action type (CLICK|VIEW|REACT)
 * @param {string} viewerId - Optional hashed viewer ID for privacy
 * 
 * @returns {object} Tracking confirmation with updated counts
 */

const { Client, Databases } = require('appwrite');

const client = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT)
  .setProject(process.env.APPWRITE_PROJECT_ID)
  .setKey(process.env.APPWRITE_KEY);

const databases = new Databases(client);

/**
 * Increment a count field in the share document
 */
async function incrementShareCount(shareToken, countField) {
  try {
    // Query for the share document by token
    const shares = await databases.listDocuments(
      process.env.DATABASE_ID,
      'social-shares',
      [
        { type: 'equal', attribute: 'shareToken', value: shareToken }
      ]
    );

    if (shares.documents.length === 0) {
      return null;
    }

    const share = shares.documents[0];
    const currentCount = share[countField] || 0;

    // Update the count
    await databases.updateDocument(
      process.env.DATABASE_ID,
      'social-shares',
      share.$id,
      {
        [countField]: currentCount + 1,
        updatedAt: new Date().toISOString(),
      }
    );

    return {
      ...share,
      [countField]: currentCount + 1,
      updatedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Failed to increment share count:', error);
    return null;
  }
}

/**
 * Create tracking audit entry
 */
async function createTrackingAudit(shareToken, action, viewerId) {
  try {
    await databases.createDocument(
      process.env.DATABASE_ID,
      'audit-entries',
      'unique()',
      {
        eventCode: 'RECOGNITION_SHARE_TRACKED',
        actorId: viewerId || 'anonymous',
        targetId: shareToken.substring(0, 16),
        metadata: {
          action,
          timestamp: new Date().toISOString(),
        },
        createdAt: new Date().toISOString(),
      }
    );
  } catch (error) {
    console.warn('Failed to create tracking audit:', error);
  }
}

/**
 * Main handler
 */
module.exports = async (req, res) => {
  try {
    // Parse request body
    const { shareToken, action, viewerId } = req.body;

    // Validate inputs
    if (!shareToken || !action) {
      return res.status(400).json({ error: 'shareToken and action required' });
    }

    if (!['CLICK', 'VIEW', 'REACT'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action type' });
    }

    // Map action to count field
    const countFieldMap = {
      'CLICK': 'clickCount',
      'VIEW': 'viewCount',
      'REACT': 'reactCount',
    };

    const countField = countFieldMap[action];

    // Increment the appropriate count
    const updatedShare = await incrementShareCount(shareToken, countField);

    if (!updatedShare) {
      return res.status(404).json({ error: 'Share token not found' });
    }

    // Check if share has expired
    if (new Date(updatedShare.expiresAt) < new Date()) {
      return res.status(410).json({ error: 'Share link has expired' });
    }

    // Create tracking audit entry
    await createTrackingAudit(shareToken, action, viewerId);

    // Return updated counts
    return res.json({
      success: true,
      data: {
        tracked: true,
        action,
        viewCount: updatedShare.viewCount || 0,
        clickCount: updatedShare.clickCount || 0,
        reactCount: updatedShare.reactCount || 0,
        message: `${action} tracked successfully`,
      },
    });
  } catch (error) {
    console.error('Share tracking error:', error);
    return res.status(500).json({
      error: 'Failed to track share',
      details: error.message,
    });
  }
};
