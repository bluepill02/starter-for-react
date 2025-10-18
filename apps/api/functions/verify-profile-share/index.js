/**
 * Verify Profile Share Token
 * 
 * Validates a share token and increments view count.
 * Also returns basic profile data for public display.
 * 
 * GET /api/functions/verify-profile-share?userId=xxx&token=yyy
 * Returns: { valid: boolean, profile: {...}, message: string }
 */

const { Client, Databases, Query } = require('node-appwrite');

const appwriteClient = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT)
  .setProject(process.env.APPWRITE_PROJECT_ID)
  .setKey(process.env.APPWRITE_API_KEY);

const databases = new Databases(appwriteClient);

module.exports = async (req, res) => {
  try {
    const { userId, token } = req.query;

    if (!userId || !token) {
      return res.json(
        {
          valid: false,
          message: 'Missing userId or token'
        },
        { statusCode: 400 }
      );
    }

    // Validate token exists and is not expired
    const shares = await databases.listDocuments(
      process.env.APPWRITE_DATABASE_ID,
      'ProfileShares',
      [
        Query.equal('userId', userId),
        Query.equal('token', token),
        Query.equal('status', 'active')
      ]
    );

    if (shares.documents.length === 0) {
      return res.json(
        {
          valid: false,
          message: 'Invalid or expired share token'
        },
        { statusCode: 404 }
      );
    }

    const share = shares.documents[0];

    // Check expiration
    const expiresAt = new Date(share.expiresAt);
    if (expiresAt < new Date()) {
      // Mark as expired
      await databases.updateDocument(
        process.env.APPWRITE_DATABASE_ID,
        'ProfileShares',
        share.$id,
        { status: 'expired' }
      );

      return res.json(
        {
          valid: false,
          message: 'Share token has expired'
        },
        { statusCode: 410 }
      );
    }

    // Fetch public profile data
    const users = await databases.listDocuments(
      process.env.APPWRITE_DATABASE_ID,
      'Users',
      [Query.equal('$id', userId)]
    );

    if (users.documents.length === 0) {
      return res.json(
        {
          valid: false,
          message: 'User not found'
        },
        { statusCode: 404 }
      );
    }

    const user = users.documents[0];

    // Increment view count
    const newViewCount = (share.views || 0) + 1;
    await databases.updateDocument(
      process.env.APPWRITE_DATABASE_ID,
      'ProfileShares',
      share.$id,
      {
        views: newViewCount,
        lastViewedAt: new Date().toISOString()
      }
    );

    // Log view to audit trail
    await databases.createDocument(
      process.env.APPWRITE_DATABASE_ID,
      'RecognitionAudit',
      undefined,
      {
        eventCode: 'profile_shared_viewed',
        actor: 'anonymous',
        target: userId,
        details: {
          token: token.substring(0, 8) + '...',
          viewNumber: newViewCount
        },
        timestamp: new Date().toISOString(),
        ipAddress: req.headers['x-forwarded-for'] || 'unknown',
        userAgent: req.headers['user-agent'] || 'unknown'
      }
    );

    // Return public profile data
    return res.json({
      valid: true,
      profile: {
        userId: user.$id,
        name: user.name || 'Recognition Profile',
        title: user.title || 'Team Member',
        photo: user.photoUrl || null,
        bio: user.bio || null,
        recognitionCount: user.recognitionCount || 0,
        totalWeight: user.totalWeight || 0,
        joinedAt: user.createdAt,
        shareViewCount: newViewCount
      },
      expiresAt: share.expiresAt,
      message: 'Share token valid'
    });
  } catch (error) {
    console.error('Error verifying profile share:', error);
    return res.json(
      {
        valid: false,
        message: 'Internal server error'
      },
      { statusCode: 500 }
    );
  }
};
