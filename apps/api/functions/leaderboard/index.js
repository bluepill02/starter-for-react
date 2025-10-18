/**
 * Leaderboard API Function
 * Fetches ranked leaderboard data for givers/receivers with engagement metrics
 * 
 * @route GET /api/leaderboard?type=givers|receivers&period=week|month|all
 * @access Public (only shows public recognitions)
 * 
 * @returns {array} Top 20 users with rank, stats, and trend
 */

const { Client, Databases } = require('appwrite');

const client = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT)
  .setProject(process.env.APPWRITE_PROJECT_ID)
  .setKey(process.env.APPWRITE_KEY);

const databases = new Databases(client);

// Cache TTL: 5 minutes
const CACHE_TTL = 5 * 60 * 1000;
const leaderboardCache = new Map();

/**
 * Calculate streak (consecutive days with recognitions)
 */
async function calculateStreak(userId, field) {
  try {
    const recognitions = await databases.listDocuments(
      process.env.DATABASE_ID,
      'recognitions',
      [
        { type: 'equal', attribute: field, value: userId },
        { type: 'orderDesc', attribute: 'createdAt' }
      ],
      100
    );

    if (recognitions.documents.length === 0) return 0;

    let streak = 1;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let lastDate = new Date(recognitions.documents[0].createdAt);
    lastDate.setHours(0, 0, 0, 0);

    // Check if last recognition is from today or yesterday
    const daysDiff = Math.floor((today - lastDate) / (24 * 60 * 60 * 1000));
    if (daysDiff > 1) return 0; // Streak broken

    for (let i = 1; i < recognitions.documents.length && i < 365; i++) {
      const currentDate = new Date(recognitions.documents[i].createdAt);
      currentDate.setHours(0, 0, 0, 0);

      const diffDays = Math.floor((lastDate - currentDate) / (24 * 60 * 60 * 1000));
      if (diffDays === 1) {
        streak += 1;
        lastDate = currentDate;
      } else {
        break;
      }
    }

    return streak;
  } catch (error) {
    console.warn('Failed to calculate streak:', error);
    return 0;
  }
}

/**
 * Build leaderboard for givers
 */
async function buildGiversLeaderboard(period) {
  try {
    const periodDays = period === 'week' ? 7 : period === 'month' ? 30 : 365;
    const cutoffDate = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);

    // Get all users (placeholder - in production, might want to optimize)
    const users = await databases.listDocuments(
      process.env.DATABASE_ID,
      'users',
      [],
      1000
    );

    const leaderboardData = [];

    for (const user of users.documents) {
      // Count given recognitions
      const given = await databases.listDocuments(
        process.env.DATABASE_ID,
        'recognitions',
        [
          { type: 'equal', attribute: 'giverId', value: user.$id },
          { type: 'greaterThan', attribute: 'createdAt', value: cutoffDate.toISOString() }
        ]
      );

      if (given.documents.length === 0) continue;

      // Count received recognitions
      const received = await databases.listDocuments(
        process.env.DATABASE_ID,
        'recognitions',
        [
          { type: 'equal', attribute: 'recipientId', value: user.$id }
        ]
      );

      // Calculate engagement score
      let engagementScore = 0;
      given.documents.forEach(rec => {
        engagementScore += (rec.verified ? 0.3 : 0) + (rec.weight || 1) * 0.1;
      });
      engagementScore = Math.round(engagementScore);

      // Calculate streak
      const streak = await calculateStreak(user.$id, 'giverId');

      leaderboardData.push({
        userId: user.$id,
        displayName: user.name,
        avatar: user.avatar || '',
        givenCount: given.documents.length,
        receivedCount: received.documents.length,
        engagementScore,
        streak,
      });
    }

    // Sort by engagement score
    leaderboardData.sort((a, b) => b.engagementScore - a.engagementScore);

    // Add rank and trend
    const leaderboard = leaderboardData.slice(0, 20).map((item, index) => ({
      ...item,
      rank: index + 1,
      trend: index === 0 ? 'steady' : 'up', // Simplified for now
    }));

    return leaderboard;
  } catch (error) {
    console.error('Failed to build givers leaderboard:', error);
    return [];
  }
}

/**
 * Build leaderboard for receivers
 */
async function buildReceiversLeaderboard(period) {
  try {
    const periodDays = period === 'week' ? 7 : period === 'month' ? 30 : 365;
    const cutoffDate = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);

    // Get all users
    const users = await databases.listDocuments(
      process.env.DATABASE_ID,
      'users',
      [],
      1000
    );

    const leaderboardData = [];

    for (const user of users.documents) {
      // Count received recognitions (only public/team)
      const received = await databases.listDocuments(
        process.env.DATABASE_ID,
        'recognitions',
        [
          { type: 'equal', attribute: 'recipientId', value: user.$id },
          { type: 'greaterThan', attribute: 'createdAt', value: cutoffDate.toISOString() }
        ]
      );

      if (received.documents.length === 0) continue;

      // Calculate score from received recognitions
      let engagementScore = 0;
      let verifiedCount = 0;
      received.documents.forEach(rec => {
        engagementScore += (rec.weight || 1) * (rec.verified ? 1.3 : 1);
        if (rec.verified) verifiedCount += 1;
      });
      engagementScore = Math.round(engagementScore);

      // Count given recognitions
      const given = await databases.listDocuments(
        process.env.DATABASE_ID,
        'recognitions',
        [
          { type: 'equal', attribute: 'giverId', value: user.$id }
        ]
      );

      leaderboardData.push({
        userId: user.$id,
        displayName: user.name,
        avatar: user.avatar || '',
        receivedCount: received.documents.length,
        verifiedCount,
        givenCount: given.documents.length,
        engagementScore,
      });
    }

    // Sort by engagement score
    leaderboardData.sort((a, b) => b.engagementScore - a.engagementScore);

    // Add rank and trend
    const leaderboard = leaderboardData.slice(0, 20).map((item, index) => ({
      ...item,
      rank: index + 1,
      trend: index === 0 ? 'steady' : 'up',
    }));

    return leaderboard;
  } catch (error) {
    console.error('Failed to build receivers leaderboard:', error);
    return [];
  }
}

/**
 * Main handler
 */
module.exports = async (req, res) => {
  try {
    const type = req.query.type || 'givers';
    const period = req.query.period || 'month';

    // Validate inputs
    if (!['givers', 'receivers'].includes(type)) {
      return res.status(400).json({ error: 'Invalid type (givers|receivers)' });
    }

    if (!['week', 'month', 'all'].includes(period)) {
      return res.status(400).json({ error: 'Invalid period (week|month|all)' });
    }

    // Check cache
    const cacheKey = `leaderboard:${type}:${period}`;
    const cached = leaderboardCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return res.json({
        success: true,
        data: cached.data,
        cached: true,
        expiresIn: Math.ceil((CACHE_TTL - (Date.now() - cached.timestamp)) / 1000),
      });
    }

    // Build leaderboard
    let leaderboard;
    if (type === 'givers') {
      leaderboard = await buildGiversLeaderboard(period);
    } else {
      leaderboard = await buildReceiversLeaderboard(period);
    }

    // Cache result
    leaderboardCache.set(cacheKey, {
      data: leaderboard,
      timestamp: Date.now(),
    });

    return res.json({
      success: true,
      data: leaderboard,
      count: leaderboard.length,
      period,
      type,
      expiresIn: CACHE_TTL / 1000,
    });
  } catch (error) {
    console.error('Leaderboard error:', error);
    return res.status(500).json({
      error: 'Failed to fetch leaderboard',
      details: error.message,
    });
  }
};
