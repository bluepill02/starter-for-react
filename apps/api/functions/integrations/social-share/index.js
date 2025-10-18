/**
 * Social Share API Function
 * Generates shareable links and tokens for recognitions across Slack, Teams, LinkedIn, and direct links
 * 
 * @route POST /api/social-share
 * @access Private (requires authentication)
 * @param {string} recognitionId - Recognition ID to share
 * @param {string} platform - Target platform (SLACK|TEAMS|LINKEDIN|LINK)
 * @param {boolean} includeProfile - Include giver's profile in share preview
 * @param {string} message - Optional custom message for share
 * 
 * @returns {object} Share token, URL, expiration, tracking ID
 */

const { Client, Databases, Storage } = require('appwrite');
const crypto = require('crypto');

const client = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT)
  .setProject(process.env.APPWRITE_PROJECT_ID)
  .setKey(process.env.APPWRITE_KEY);

const databases = new Databases(client);
// Storage client defined for future use (OG image generation, etc)
// eslint-disable-next-line no-unused-vars
const storage = new Storage(client);

/**
 * Generate a secure share token using crypto
 * @returns {string} Hex-encoded random token
 */
function generateShareToken() {
  return crypto.randomBytes(24).toString('hex');
}

/**
 * Generate tracking ID for analytics
 * @returns {string} Unique tracking ID
 */
function generateTrackingId() {
  return `track_${crypto.randomBytes(12).toString('hex')}`;
}

/**
 * Generate OG preview image URL (placeholder for actual image service)
 * @param {string} recognitionId - Recognition ID
 * @param {string} giver - Giver name
 * @param {string} reason - Recognition reason
 * @returns {string} OG image URL
 */
function generatePreviewUrl(recognitionId, giver, reason) {
  const encoded = Buffer.from(JSON.stringify({
    id: recognitionId,
    giver,
    reason: reason.substring(0, 100),
  })).toString('base64');
  
  return `${process.env.VITE_APP_URL || 'http://localhost:3000'}/api/og?data=${encoded}`;
}

/**
 * Create audit entry for share event
 */
async function createShareAudit(recognitionId, giverId, platform, trackingId, shareToken) {
  try {
    await databases.createDocument(
      process.env.DATABASE_ID,
      'audit-entries',
      'unique()',
      {
        eventCode: 'RECOGNITION_SHARED',
        actorId: giverId,
        targetId: recognitionId,
        metadata: {
          platform,
          trackingId,
          shareToken: shareToken.substring(0, 16) + '...', // Hide full token
          timestamp: new Date().toISOString(),
        },
        createdAt: new Date().toISOString(),
      }
    );
  } catch (error) {
    console.error('Failed to create share audit:', error);
    // Don't fail the share operation if audit fails
  }
}

/**
 * Main handler
 */
module.exports = async (req, res) => {
  // Check authentication
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const userId = req.headers['x-user-id'];
  if (!userId) {
    return res.status(401).json({ error: 'User ID required' });
  }

  try {
    // Parse request body
    const { recognitionId, platform, includeProfile = false, message } = req.body;

    // Validate inputs
    if (!recognitionId || !platform) {
      return res.status(400).json({ error: 'recognitionId and platform required' });
    }

    if (!['SLACK', 'TEAMS', 'LINKEDIN', 'LINK'].includes(platform)) {
      return res.status(400).json({ error: 'Invalid platform' });
    }

    // Fetch recognition from database
    let recognition;
    try {
      recognition = await databases.getDocument(
        process.env.DATABASE_ID,
        'recognitions',
        recognitionId
      );
    } catch {
      return res.status(404).json({ error: 'Recognition not found' });
    }

    // Verify user is the giver
    if (recognition.giverId !== userId) {
      return res.status(403).json({ error: 'Only the recognition giver can share' });
    }

    // Check visibility (can only share PUBLIC or TEAM recognitions)
    if (recognition.visibility === 'PRIVATE') {
      return res.status(403).json({ error: 'Cannot share private recognitions' });
    }

    // Fetch giver and recipient for preview
    let giver = { name: 'Unknown' };
    
    try {
      giver = await databases.getDocument(
        process.env.DATABASE_ID,
        'users',
        recognition.giverId
      );
      await databases.getDocument(
        process.env.DATABASE_ID,
        'users',
        recognition.recipientId
      );
    } catch (error) {
      console.warn('Failed to fetch user details for preview:', error);
    }

    // Generate share components
    const shareToken = generateShareToken();
    const trackingId = generateTrackingId();
    const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000); // 90 days
    const baseUrl = process.env.VITE_APP_URL || 'http://localhost:3000';
    const shareUrl = `${baseUrl}/share/${shareToken}?ref=${platform.toLowerCase()}&track=${trackingId}`;
    const previewUrl = generatePreviewUrl(recognitionId, giver.name, recognition.reason);

    // Create share event in database
    await databases.createDocument(
      process.env.DATABASE_ID,
      'social-shares',
      'unique()',
      {
        recognitionId,
        giverId: userId,
        platform,
        shareToken,
        shareUrl,
        previewUrl,
        includeProfile,
        message,
        expiresAt: expiresAt.toISOString(),
        trackingId,
        viewCount: 0,
        clickCount: 0,
        reactCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
    );

    // Create audit entry
    await createShareAudit(recognitionId, userId, platform, trackingId, shareToken);

    // Return share details
    return res.json({
      success: true,
      data: {
        shareToken,
        shareUrl,
        previewUrl,
        platform,
        trackingId,
        expiresAt: expiresAt.toISOString(),
        expiresIn: Math.floor((expiresAt - Date.now()) / 1000), // Seconds until expiry
        message: `Recognition shared to ${platform} successfully`,
      },
    });
  } catch (error) {
    console.error('Social share error:', error);
    return res.status(500).json({
      error: 'Failed to create share',
      details: error.message,
    });
  }
};
