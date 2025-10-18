/**
 * Mock Slack Client for Testing
 * Simulates Slack API and verification for unit and integration tests
 */

const crypto = require('crypto');

class MockSlackClient {
  constructor(config) {
    this.config = config || {
      signingSecret: 'test-secret-123',
      teamId: 'T123456789',
      botToken: 'xoxb-test-token',
    };
    this.messages = new Map();
    this.users = new Map();
    this.interactions = [];
  }

  /**
   * Verify Slack request signature for security
   * @param {string} timestamp - Request timestamp
   * @param {string} body - Request body
   * @param {string} signature - Slack signature header
   * @returns {boolean} True if signature is valid
   */
  verifySignature(timestamp, body, signature) {
    const baseString = `v0:${timestamp}:${body}`;
    const computed = `v0=${crypto
      .createHmac('sha256', this.config.signingSecret)
      .update(baseString)
      .digest('hex')}`;

    try {
      return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(signature));
    } catch {
      return false;
    }
  }

  /**
   * Post a message to a Slack channel
   * @param {string} channel - Channel ID or name
   * @param {string} text - Message text
   * @param {Object} [options] - Additional message options
   * @returns {Promise<Object>} Response with ok, ts, channel
   */
  async postMessage(channel, text, options) {
    if (!this.messages.has(channel)) {
      this.messages.set(channel, []);
    }
    const timestamp = Date.now() / 1000;
    const message = {
      channel,
      text,
      ...options,
      ts: timestamp.toString(),
    };
    this.messages.get(channel).push(message);
    return { ok: true, ts: timestamp.toString(), channel };
  }

  /**
   * Update a Slack message
   * @param {string} channel - Channel ID
   * @param {string} ts - Message timestamp
   * @param {Object} options - Update options
   * @returns {Promise<Object>} Response with ok, channel, ts
   */
  async updateMessage(channel, ts, options) {
    const messages = this.messages.get(channel) || [];
    const messageIndex = messages.findIndex((m) => m.ts === ts);
    if (messageIndex === -1) {
      throw new Error(`Message not found: ${channel}:${ts}`);
    }
    messages[messageIndex] = { ...messages[messageIndex], ...options, ts };
    return { ok: true, channel, ts };
  }

  /**
   * Get a Slack user profile
   * @param {string} userId - Slack user ID
   * @returns {Promise<Object>} User profile object
   */
  async getUser(userId) {
    let user = this.users.get(userId);
    if (!user) {
      user = {
        id: userId,
        name: `user-${userId}`,
        email: `user-${userId}@example.com`,
        real_name: `Test User ${userId}`,
      };
    }
    return { user };
  }

  /**
   * Open a direct message conversation
   * @param {string[]} users - Array of user IDs
   * @returns {Promise<Object>} Response with channel ID
   */
  async openConversation(users) {
    const channelId = `dm-${users.sort().join('-')}`;
    return { channel: { id: channelId } };
  }

  /**
   * Record an interaction (command, action, etc)
   * @param {Object} interaction - Interaction object
   */
  recordInteraction(interaction) {
    this.interactions.push({
      ...interaction,
      timestamp: new Date().toISOString(),
      id: `interaction-${this.interactions.length}`,
    });
  }

  /**
   * Get all messages for a channel
   * @param {string} channel - Channel ID
   * @returns {Array} Messages array
   */
  getMessages(channel) {
    return this.messages.get(channel) || [];
  }

  /**
   * Get all recorded interactions
   * @returns {Array} Interactions array
   */
  getInteractions() {
    return this.interactions;
  }

  /**
   * Get interactions by type
   * @param {string} type - Interaction type (command, action, etc)
   * @returns {Array} Filtered interactions
   */
  getInteractionsByType(type) {
    return this.interactions.filter((i) => i.type === type);
  }

  /**
   * Add or update a mock user
   * @param {string} userId - User ID
   * @param {Object} userData - User data
   */
  setUser(userId, userData) {
    this.users.set(userId, { id: userId, ...userData });
  }

  /**
   * Clear all data (for test cleanup)
   */
  clear() {
    this.messages.clear();
    this.users.clear();
    this.interactions = [];
  }
}

// Singleton instance
const mockSlackInstance = new MockSlackClient();

/**
 * Create Jest mocks for Slack client
 * @returns {Object} Mocked client with jest.fn methods
 */
const createMockSlackClient = () => {
  return {
    chat: {
      postMessage: jest.fn((params) => mockSlackInstance.postMessage(params.channel, params.text, params)),
      update: jest.fn((params) =>
        mockSlackInstance.updateMessage(params.channel, params.ts, params)
      ),
    },
    users: {
      info: jest.fn((params) => mockSlackInstance.getUser(params.user)),
    },
    conversations: {
      open: jest.fn((params) => mockSlackInstance.openConversation(params.users)),
    },
  };
};

module.exports = {
  MockSlackClient,
  mockSlackInstance,
  createMockSlackClient,
};
