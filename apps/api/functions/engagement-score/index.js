/**
 * Engagement Score Calculation Service
 * Calculates engagement score for recognitions based on verification, shares, and views
 * 
 * Score Formula:
 * engagementScore = base_weight * (
 *   1 +
 *   (verified ? 0.3 : 0) +
 *   (shares / 100) * 0.2 +
 *   (views / 1000) * 0.1
 * )
 */

const { Client, Databases } = require('appwrite');

const client = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT)
  .setProject(process.env.APPWRITE_PROJECT_ID)
  .setKey(process.env.APPWRITE_KEY);

const databases = new Databases(client);

/**
 * Calculate engagement score for a recognition
 * @param {object} recognition - Recognition document
 * @param {number} shareCount - Total shares count
 * @param {number} viewCount - Total views count
 * @returns {object} Score breakdown and total score
 */
function calculateEngagementScore(recognition, shareCount = 0, viewCount = 0) {
  const baseWeight = recognition.weight || 1;
  const verificationBonus = recognition.verified ? 0.3 : 0;
  const shareBonus = (Math.min(shareCount, 100) / 100) * 0.2;
  const viewBonus = (Math.min(viewCount, 1000) / 1000) * 0.1;

  const multiplier = 1 + verificationBonus + shareBonus + viewBonus;
  const score = Math.round(baseWeight * multiplier * 10) / 10; // Round to 1 decimal

  return {
    score,
    breakdown: {
      baseWeight,
      verificationBonus: Math.round(verificationBonus * 100) / 100,
      shareBonus: Math.round(shareBonus * 100) / 100,
      viewBonus: Math.round(viewBonus * 100) / 100,
      multiplier: Math.round(multiplier * 100) / 100,
    },
  };
}

/**
 * Get share count for a recognition
 */
async function getShareCount(recognitionId) {
  try {
    const shares = await databases.listDocuments(
      process.env.DATABASE_ID,
      'social-shares',
      [
        { type: 'equal', attribute: 'recognitionId', value: recognitionId }
      ]
    );
    return shares.documents.length;
  } catch (error) {
    console.warn('Failed to get share count:', error);
    return 0;
  }
}

/**
 * Get total views for a recognition from all its shares
 */
async function getViewCount(recognitionId) {
  try {
    const shares = await databases.listDocuments(
      process.env.DATABASE_ID,
      'social-shares',
      [
        { type: 'equal', attribute: 'recognitionId', value: recognitionId }
      ]
    );

    return shares.documents.reduce((total, share) => {
      return total + (share.viewCount || 0) + (share.clickCount || 0);
    }, 0);
  } catch (error) {
    console.warn('Failed to get view count:', error);
    return 0;
  }
}

/**
 * Calculate engagement score for multiple users (for leaderboard)
 * @param {array} userIds - Array of user IDs
 * @param {string} period - Time period (week|month|all)
 * @returns {array} Sorted user scores
 */
async function calculateUserEngagementScores(userIds, period = 'month') {
  try {
    const periodDays = period === 'week' ? 7 : period === 'month' ? 30 : 365;
    const cutoffDate = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);

    const scores = [];

    for (const userId of userIds) {
      try {
        // Get recognitions for this user
        const recognitions = await databases.listDocuments(
          process.env.DATABASE_ID,
          'recognitions',
          [
            { type: 'equal', attribute: 'giverId', value: userId },
            { type: 'greaterThan', attribute: 'createdAt', value: cutoffDate.toISOString() }
          ]
        );

        let totalScore = 0;
        const userRecognitions = [];

        for (const rec of recognitions.documents) {
          const shareCount = await getShareCount(rec.$id);
          const viewCount = await getViewCount(rec.$id);
          const scoreData = calculateEngagementScore(rec, shareCount, viewCount);

          totalScore += scoreData.score;
          userRecognitions.push({
            recognitionId: rec.$id,
            score: scoreData.score,
          });
        }

        // Calculate average score
        const avgScore = userRecognitions.length > 0 
          ? Math.round((totalScore / userRecognitions.length) * 10) / 10
          : 0;

        scores.push({
          userId,
          totalScore: Math.round(totalScore * 10) / 10,
          avgScore,
          recognitionCount: recognitions.documents.length,
          recognitions: userRecognitions,
        });
      } catch (error) {
        console.warn(`Failed to calculate score for user ${userId}:`, error);
        scores.push({
          userId,
          totalScore: 0,
          avgScore: 0,
          recognitionCount: 0,
          recognitions: [],
        });
      }
    }

    // Sort by total score descending
    return scores.sort((a, b) => b.totalScore - a.totalScore);
  } catch (error) {
    console.error('Failed to calculate user scores:', error);
    return [];
  }
}

/**
 * Calculate received recognitions score for a user
 */
async function calculateReceivedScore(userId, period = 'month') {
  try {
    const periodDays = period === 'week' ? 7 : period === 'month' ? 30 : 365;
    const cutoffDate = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);

    const recognitions = await databases.listDocuments(
      process.env.DATABASE_ID,
      'recognitions',
      [
        { type: 'equal', attribute: 'recipientId', value: userId },
        { type: 'greaterThan', attribute: 'createdAt', value: cutoffDate.toISOString() }
      ]
    );

    let totalScore = 0;
    let verifiedCount = 0;

    for (const rec of recognitions.documents) {
      totalScore += rec.weight || 0;
      if (rec.verified) verifiedCount += 1;
    }

    return {
      score: Math.round(totalScore * 10) / 10,
      recognitionCount: recognitions.documents.length,
      verifiedCount,
      avgWeight: recognitions.documents.length > 0
        ? Math.round((totalScore / recognitions.documents.length) * 10) / 10
        : 0,
    };
  } catch (error) {
    console.error('Failed to calculate received score:', error);
    return {
      score: 0,
      recognitionCount: 0,
      verifiedCount: 0,
      avgWeight: 0,
    };
  }
}

/**
 * Main handler for score calculation endpoint
 */
module.exports = async (req, res) => {
  try {
    const { type, userId, userIds, period = 'month' } = req.body;

    if (!type) {
      return res.status(400).json({ error: 'Type required (given|received|bulk)' });
    }

    if (type === 'given' && userId) {
      // Calculate given score for single user
      const scores = await calculateUserEngagementScores([userId], period);
      return res.json({
        success: true,
        data: scores[0] || { userId, totalScore: 0, avgScore: 0, recognitionCount: 0 },
      });
    }

    if (type === 'received' && userId) {
      // Calculate received score for single user
      const score = await calculateReceivedScore(userId, period);
      return res.json({
        success: true,
        data: { userId, ...score },
      });
    }

    if (type === 'bulk' && userIds && Array.isArray(userIds)) {
      // Calculate scores for multiple users
      const scores = await calculateUserEngagementScores(userIds, period);
      return res.json({
        success: true,
        data: scores,
      });
    }

    return res.status(400).json({ error: 'Invalid parameters for score calculation' });
  } catch (error) {
    console.error('Engagement score error:', error);
    return res.status(500).json({
      error: 'Failed to calculate engagement score',
      details: error.message,
    });
  }
};

// Export for use in other functions
module.exports.calculateEngagementScore = calculateEngagementScore;
module.exports.calculateUserEngagementScores = calculateUserEngagementScores;
module.exports.calculateReceivedScore = calculateReceivedScore;
