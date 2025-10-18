/**
 * Create Profile Share Token
 * 
 * Generates a presigned token for sharing a profile publicly.
 * Token expires in 24 hours.
 * 
 * POST /api/functions/create-profile-share
 * Body: { userId: string }
 * Returns: { shareToken: string, expiresAt: ISO timestamp, shareUrl: string }
 */

const { Client, Databases, ID } = require('node-appwrite');
const crypto = require('crypto');

const client = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT || '')
  .setProject(process.env.APPWRITE_PROJECT_ID || '')
  .setKey(process.env.APPWRITE_API_KEY || '');

const databases = new Databases(client);

function generateSecureToken(length = 32) {
  return crypto.randomBytes(length).toString('hex');
}

module.exports = async (req, res) => {
  try {
    // Validate request
    if (req.method !== 'POST') {
      return res.json(
        { error: 'Method not allowed' },
        { statusCode: 405 }
      );
    }

    const { userId } = req.body;

    if (!userId) {
      return res.json(
        { error: 'Missing required field: userId' },
        { statusCode: 400 }
      );
    }

    // Generate secure token
    const shareToken = generateSecureToken();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    try {
      // Create share record in database
      const share = await databases.createDocument(
        process.env.APPWRITE_DATABASE_ID!,
        'ProfileShares', // Collection name
        ID.unique(),
        {
          userId,
          token: shareToken,
          createdAt: new Date().toISOString(),
          expiresAt: expiresAt.toISOString(),
          views: 0,
          shareSource: 'unknown', // Will be populated by client
          utmSource: '', // Will be populated by client
          utmCampaign: '', // Will be populated by client
          status: 'active'
        }
      );

      // Generate shareable URL
      const APP_URL = process.env.APP_URL || 'http://localhost:3000';
      const shareUrl = new URL(
        `/profile/${userId}/shared`,
        APP_URL
      );
      shareUrl.searchParams.set('token', shareToken);
      shareUrl.searchParams.set('utm_source', 'profile_share');
      shareUrl.searchParams.set('utm_campaign', 'recognition_viral');

      // Log to audit trail
      await databases.createDocument(
        process.env.APPWRITE_DATABASE_ID!,
        'RecognitionAudit',
        ID.unique(),
        {
          eventCode: 'profile_share_created',
          actor: userId,
          target: userId,
          details: {
            token: shareToken,
            expiresAt: expiresAt.toISOString()
          },
          timestamp: new Date().toISOString(),
          ipAddress: req.headers['x-forwarded-for'] || 'unknown',
          userAgent: req.headers['user-agent'] || 'unknown'
        }
      );

      return res.json({
        shareToken,
        expiresAt: expiresAt.toISOString(),
        shareUrl: shareUrl.toString(),
        expiresIn: '24 hours'
      });
    } catch (dbError: any) {
      console.error('Database error:', dbError);
      return res.json(
        {
          error: 'Failed to create share token',
          details: dbError.message
        },
        { statusCode: 500 }
      );
    }
  } catch (error: any) {
    console.error('Error creating profile share:', error);
    return res.json(
      {
        error: 'Internal server error',
        details: error.message
      },
      { statusCode: 500 }
    );
  }
};
