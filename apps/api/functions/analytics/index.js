/**
 * Analytics API Function
 * Returns personal engagement analytics for a user
 * 
 * @route GET /api/analytics?userId=...&period=30
 * @access Private (requires authentication)
 * 
 * @returns {object} Personal stats, trends, top recognitions
 */

const { Client, Databases } = require('appwrite');

const client = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT)
  .setProject(process.env.APPWRITE_PROJECT_ID)
  .setKey(process.env.APPWRITE_KEY);

const databases = new Databases(client);

/**
 * Get daily stats for last N days
 */
async function getDailyStats(userId, field, days) {
  try {
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const recognitions = await databases.listDocuments(
      process.env.DATABASE_ID,
      'recognitions',
      [
        { type: 'equal', attribute: field, value: userId },
        { type: 'greaterThan', attribute: 'createdAt', value: cutoffDate.toISOString() }
      ]
    );

    // Group by day
    const dailyData = {};
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Initialize all days with 0
    for (let i = 0; i < days; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      dailyData[dateStr] = 0;
    }

    // Count recognitions per day
    recognitions.documents.forEach(rec => {
      const date = new Date(rec.createdAt);
      date.setHours(0, 0, 0, 0);
      const dateStr = date.toISOString().split('T')[0];
      if (dateStr in dailyData) {
        dailyData[dateStr] += 1;
      }
    });

    return Object.entries(dailyData)
      .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
      .map(([date, count]) => ({ date, count }));
  } catch (error) {
    console.error('Failed to get daily stats:', error);
    return [];
  }
}

/**
 * Get shares for user's recognitions
 */
async function getUserShares(userId) {
  try {
    // Get user's recognitions
    const recognitions = await databases.listDocuments(
      process.env.DATABASE_ID,
      'recognitions',
      [
        { type: 'equal', attribute: 'giverId', value: userId }
      ],
      1000
    );

    if (recognitions.documents.length === 0) {
      return { totalShares: 0, totalViews: 0, byPlatform: {} };
    }

    let totalShares = 0;
    let totalViews = 0;
    const byPlatform = {};

    // Get shares for each recognition
    for (const rec of recognitions.documents) {
      try {
        const shares = await databases.listDocuments(
          process.env.DATABASE_ID,
          'social-shares',
          [
            { type: 'equal', attribute: 'recognitionId', value: rec.$id }
          ]
        );

        totalShares += shares.documents.length;
        shares.documents.forEach(share => {
          const views = (share.viewCount || 0) + (share.clickCount || 0);
          totalViews += views;

          const platform = share.platform || 'LINK';
          byPlatform[platform] = (byPlatform[platform] || 0) + 1;
        });
      } catch {
        // Silently continue if no shares found
      }
    }

    return { totalShares, totalViews, byPlatform };
  } catch (error) {
    console.error('Failed to get user shares:', error);
    return { totalShares: 0, totalViews: 0, byPlatform: {} };
  }
}

/**
 * Get top recognition for user
 */
async function getTopRecognition(userId, field) {
  try {
    const recognitions = await databases.listDocuments(
      process.env.DATABASE_ID,
      'recognitions',
      [
        { type: 'equal', attribute: field, value: userId }
      ]
    );

    if (recognitions.documents.length === 0) return null;

    // Sort by weight (proxy for engagement)
    const sorted = recognitions.documents.sort((a, b) => (b.weight || 0) - (a.weight || 0));
    const top = sorted[0];

    // Get view count for this recognition
    try {
      const shares = await databases.listDocuments(
        process.env.DATABASE_ID,
        'social-shares',
        [
          { type: 'equal', attribute: 'recognitionId', value: top.$id }
        ]
      );

      const totalViews = shares.documents.reduce((sum, share) => {
        return sum + (share.viewCount || 0) + (share.clickCount || 0);
      }, 0);

      return {
        id: top.$id,
        reason: top.reason?.substring(0, 100),
        weight: top.weight,
        views: totalViews,
        verified: top.verified,
        createdAt: top.createdAt,
      };
    } catch {
      return {
        id: top.$id,
        reason: top.reason?.substring(0, 100),
        weight: top.weight,
        views: 0,
        verified: top.verified,
        createdAt: top.createdAt,
      };
    }
  } catch (error) {
    console.error('Failed to get top recognition:', error);
    return null;
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

  const userId = req.query.userId || req.headers['x-user-id'];
  if (!userId) {
    return res.status(401).json({ error: 'User ID required' });
  }

  const period = parseInt(req.query.period) || 30; // Days

  try {
    // Get given recognitions
    const given = await databases.listDocuments(
      process.env.DATABASE_ID,
      'recognitions',
      [
        { type: 'equal', attribute: 'giverId', value: userId }
      ]
    );

    // Get received recognitions
    const received = await databases.listDocuments(
      process.env.DATABASE_ID,
      'recognitions',
      [
        { type: 'equal', attribute: 'recipientId', value: userId }
      ]
    );

    // Get daily stats
    const givenDaily = await getDailyStats(userId, 'giverId', period);
    const receivedDaily = await getDailyStats(userId, 'recipientId', period);

    // Get share stats
    const shareStats = await getUserShares(userId);

    // Get top recognitions
    const topGiven = await getTopRecognition(userId, 'giverId');
    const topReceived = await getTopRecognition(userId, 'recipientId');

    // Calculate trends
    const calculateTrend = (daily) => {
      if (daily.length < 2) return 0;
      const recent = daily.slice(-7).reduce((sum, d) => sum + d.count, 0);
      const previous = daily.slice(-14, -7).reduce((sum, d) => sum + d.count, 0);
      return recent - previous;
    };

    const givenTrend = calculateTrend(givenDaily);
    const receivedTrend = calculateTrend(receivedDaily);

    // Calculate totals for period
    const periodCutoff = new Date(Date.now() - period * 24 * 60 * 60 * 1000).toISOString();
    const givenInPeriod = given.documents.filter(r => r.createdAt >= periodCutoff).length;
    const receivedInPeriod = received.documents.filter(r => r.createdAt >= periodCutoff).length;

    return res.json({
      success: true,
      data: {
        userId,
        period,
        given: {
          totalAllTime: given.documents.length,
          inPeriod: givenInPeriod,
          trend: givenTrend,
          daily: givenDaily,
        },
        received: {
          totalAllTime: received.documents.length,
          inPeriod: receivedInPeriod,
          trend: receivedTrend,
          daily: receivedDaily,
          verified: received.documents.filter(r => r.verified).length,
        },
        shares: shareStats,
        topRecognitions: {
          given: topGiven,
          received: topReceived,
        },
        engagementScore: Math.round(
          (givenInPeriod * 0.5 + receivedInPeriod * 0.3 + shareStats.totalViews * 0.002) * 10
        ) / 10,
      },
    });
  } catch (error) {
    console.error('Analytics error:', error);
    return res.status(500).json({
      error: 'Failed to fetch analytics',
      details: error.message,
    });
  }
};
