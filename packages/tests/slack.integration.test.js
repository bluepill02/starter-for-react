// Slack Integration Tests - Mock signature verification and interaction payloads
const crypto = require('crypto');

// Mock Appwrite SDK
jest.mock('node-appwrite', () => ({
  Client: jest.fn().mockImplementation(() => ({
    setEndpoint: jest.fn().mockReturnThis(),
    setProject: jest.fn().mockReturnThis(),
    setKey: jest.fn().mockReturnThis(),
  })),
  Databases: jest.fn().mockImplementation(() => ({
    createDocument: jest.fn().mockResolvedValue({ $id: 'mock-doc-id' }),
    listDocuments: jest.fn().mockResolvedValue({ documents: [] }),
  })),
  Functions: jest.fn().mockImplementation(() => ({
    createExecution: jest.fn().mockResolvedValue({
      responseBody: JSON.stringify({ success: true, recognitionId: 'rec-123' })
    }),
  })),
  ID: {
    unique: jest.fn(() => 'mock-id-123'),
  },
}));

// Mock crypto for signature verification
const mockCreateHmac = jest.fn();
const mockTimingSafeEqual = jest.fn();

jest.mock('crypto', () => ({
  createHmac: mockCreateHmac,
  timingSafeEqual: mockTimingSafeEqual,
  createHash: jest.fn(() => ({
    update: jest.fn().mockReturnThis(),
    digest: jest.fn(() => 'mock-hash'),
  })),
}));

describe('Slack Integration', () => {
  let slackHandler;
  let mockReq, mockRes, mockLog, mockError;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Setup environment
    process.env.SLACK_SIGNING_SECRET = 'test-signing-secret';
    process.env.APPWRITE_DATABASE_ID = 'test-db';
    
    // Setup mock functions
    mockCreateHmac.mockImplementation(() => ({
      update: jest.fn().mockReturnThis(),
      digest: jest.fn(() => 'expected-signature'),
    }));
    
    mockTimingSafeEqual.mockReturnValue(true);

    // Mock request/response objects
    mockReq = {
      path: '/command',
      method: 'POST',
      headers: {
        'x-slack-request-timestamp': '1234567890',
        'x-slack-signature': 'v0=expected-signature',
      },
      body: 'command=/recognize&text=@user123 for great work #teamwork&user_id=U123&user_name=testuser&team_id=T123&channel_id=C123',
    };

    mockRes = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis(),
    };

    mockLog = jest.fn();
    mockError = jest.fn();

    // Import the handler after mocking
    slackHandler = require('../../apps/api/functions/integrations/slack/index.js');
  });

  describe('Signature Verification', () => {
    test('should verify valid Slack signature', async () => {
      await slackHandler({ req: mockReq, res: mockRes, log: mockLog, error: mockError });

      expect(mockCreateHmac).toHaveBeenCalledWith('sha256', 'test-signing-secret');
      expect(mockTimingSafeEqual).toHaveBeenCalled();
    });

    test('should reject invalid signature', async () => {
      mockTimingSafeEqual.mockReturnValue(false);

      await slackHandler({ req: mockReq, res: mockRes, log: mockLog, error: mockError });

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
    });

    test('should reject expired timestamp', async () => {
      mockReq.headers['x-slack-request-timestamp'] = String(Math.floor(Date.now() / 1000) - 400); // 400 seconds ago

      await slackHandler({ req: mockReq, res: mockRes, log: mockLog, error: mockError });

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
    });

    test('should reject missing headers', async () => {
      delete mockReq.headers['x-slack-signature'];

      await slackHandler({ req: mockReq, res: mockRes, log: mockLog, error: mockError });

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Missing Slack headers' });
    });
  });

  describe('/recognize Command', () => {
    test('should create recognition successfully', async () => {
      await slackHandler({ req: mockReq, res: mockRes, log: mockLog, error: mockError });

      expect(mockRes.json).toHaveBeenCalledWith({
        response_type: 'in_channel',
        text: '🎉 Recognition sent successfully!',
        attachments: [{
          color: 'good',
          fields: [{
            title: 'Recognition',
            value: 'for great work\n\nTags: #teamwork',
            short: false
          }]
        }]
      });
    });

    test('should require @mention', async () => {
      mockReq.body = 'command=/recognize&text=great work #teamwork&user_id=U123&user_name=testuser&team_id=T123&channel_id=C123';

      await slackHandler({ req: mockReq, res: mockRes, log: mockLog, error: mockError });

      expect(mockRes.json).toHaveBeenCalledWith({
        response_type: 'ephemeral',
        text: 'Please mention someone to recognize using @username'
      });
    });

    test('should require minimum reason length', async () => {
      mockReq.body = 'command=/recognize&text=@user123 short&user_id=U123&user_name=testuser&team_id=T123&channel_id=C123';

      await slackHandler({ req: mockReq, res: mockRes, log: mockLog, error: mockError });

      expect(mockRes.json).toHaveBeenCalledWith({
        response_type: 'ephemeral',
        text: 'Please provide a reason for recognition (minimum 10 characters)'
      });
    });

    test('should handle private recognition', async () => {
      mockReq.body = 'command=/recognize-private&text=@user123 for great work #teamwork&user_id=U123&user_name=testuser&team_id=T123&channel_id=C123';

      await slackHandler({ req: mockReq, res: mockRes, log: mockLog, error: mockError });

      expect(mockRes.json).toHaveBeenCalledWith({
        response_type: 'ephemeral',
        text: '🎉 Recognition sent successfully!',
        attachments: [{
          color: 'good',
          fields: [{
            title: 'Recognition',
            value: 'for great work\n\nTags: #teamwork',
            short: false
          }]
        }]
      });
    });
  });

  describe('/recognition-stats Command', () => {
    test('should return user statistics', async () => {
      mockReq.body = 'command=/recognition-stats&user_id=U123&user_name=testuser&team_id=T123&channel_id=C123';

      const { Functions } = require('node-appwrite');
      const mockFunctions = new Functions();
      mockFunctions.createExecution.mockResolvedValue({
        responseBody: JSON.stringify({
          success: true,
          data: {
            given: 5,
            received: 3,
            totalWeight: 12,
            verified: 2
          }
        })
      });

      await slackHandler({ req: mockReq, res: mockRes, log: mockLog, error: mockError });

      expect(mockRes.json).toHaveBeenCalledWith({
        response_type: 'ephemeral',
        text: '📊 Your Recognition Stats',
        attachments: [{
          color: '#36C5F0',
          fields: [
            { title: 'Given', value: '5', short: true },
            { title: 'Received', value: '3', short: true },
            { title: 'Total Weight', value: '12', short: true },
            { title: 'Verified', value: '2', short: true }
          ]
        }]
      });
    });
  });

  describe('Interactive Components', () => {
    beforeEach(() => {
      mockReq.path = '/interactive';
      mockReq.body = 'payload=' + encodeURIComponent(JSON.stringify({
        type: 'block_actions',
        actions: [{
          action_id: 'verify_recognition',
          value: 'rec-123'
        }],
        user: { id: 'U123' },
        team: { id: 'T123' }
      }));
    });

    test('should handle verification button click', async () => {
      const { Functions } = require('node-appwrite');
      const mockFunctions = new Functions();
      mockFunctions.createExecution.mockResolvedValue({
        responseBody: JSON.stringify({ success: true })
      });

      await slackHandler({ req: mockReq, res: mockRes, log: mockLog, error: mockError });

      expect(mockRes.json).toHaveBeenCalledWith({
        text: '✅ Recognition verified successfully!',
        replace_original: true
      });
    });

    test('should handle verification failure', async () => {
      const { Functions } = require('node-appwrite');
      const mockFunctions = new Functions();
      mockFunctions.createExecution.mockResolvedValue({
        responseBody: JSON.stringify({ success: false })
      });

      await slackHandler({ req: mockReq, res: mockRes, log: mockLog, error: mockError });

      expect(mockRes.json).toHaveBeenCalledWith({
        text: '❌ Verification failed. Please try again.',
        replace_original: true
      });
    });
  });

  describe('Webhook Notifications', () => {
    beforeEach(() => {
      mockReq.path = '/webhook';
      mockReq.body = JSON.stringify({
        type: 'recognition.created',
        data: {
          teamId: 'T123',
          recognitionId: 'rec-123',
          giverId: 'U123',
          giverName: 'John Doe',
          recipientName: 'Jane Smith',
          reason: 'Excellent leadership',
          tags: ['leadership'],
          requiresVerification: true
        }
      });
    });

    test('should send notification to configured webhook', async () => {
      const { Databases } = require('node-appwrite');
      const mockDatabases = new Databases();
      mockDatabases.listDocuments.mockResolvedValue({
        documents: [{
          settings: { notifyOnRecognition: true },
          webhookUrl: 'https://hooks.slack.com/test'
        }]
      });

      // Mock fetch for webhook call
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200
      });

      await slackHandler({ req: mockReq, res: mockRes, log: mockLog, error: mockError });

      expect(global.fetch).toHaveBeenCalledWith(
        'https://hooks.slack.com/test',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        })
      );

      expect(mockRes.json).toHaveBeenCalledWith({ success: true });
    });
  });

  describe('Command Parsing', () => {
    test('should parse mentions correctly', () => {
      // This would test the parseSlackCommand function if exported
      // For now, we test through the full integration
      const testCases = [
        {
          input: '@user123 for great work #teamwork',
          expected: {
            mentions: ['user123'],
            tags: ['teamwork'],
            reason: 'for great work'
          }
        },
        {
          input: '@user1 @user2 excellent collaboration #teamwork #leadership',
          expected: {
            mentions: ['user1', 'user2'],
            tags: ['teamwork', 'leadership'],
            reason: 'excellent collaboration'
          }
        },
        {
          input: '"quoted reason with @user123" #tag',
          expected: {
            mentions: ['user123'],
            tags: ['tag'],
            reason: 'quoted reason with'
          }
        }
      ];

      // Test parsing through the integration endpoint
      testCases.forEach(async (testCase) => {
        mockReq.body = `command=/recognize&text=${encodeURIComponent(testCase.input)}&user_id=U123&user_name=testuser&team_id=T123&channel_id=C123`;
        
        await slackHandler({ req: mockReq, res: mockRes, log: mockLog, error: mockError });
        
        // Verify the call to Functions.createExecution contains parsed data
        const { Functions } = require('node-appwrite');
        const mockFunctions = new Functions();
        const executionCall = mockFunctions.createExecution.mock.calls.find(call => 
          call[0] === 'create-recognition'
        );
        
        if (executionCall) {
          const payload = JSON.parse(executionCall[1]);
          expect(payload.recipientSlackUserIds).toEqual(testCase.expected.mentions);
          expect(payload.tags).toEqual(testCase.expected.tags);
        }
      });
    });
  });

  describe('Error Handling', () => {
    test('should handle function execution errors', async () => {
      const { Functions } = require('node-appwrite');
      const mockFunctions = new Functions();
      mockFunctions.createExecution.mockRejectedValue(new Error('Function execution failed'));

      await slackHandler({ req: mockReq, res: mockRes, log: mockLog, error: mockError });

      expect(mockRes.json).toHaveBeenCalledWith({
        response_type: 'ephemeral',
        text: '❌ Failed to create recognition. Please try again or contact support.'
      });
    });

    test('should handle invalid request body', async () => {
      mockReq.body = 'invalid-body-format';

      await slackHandler({ req: mockReq, res: mockRes, log: mockLog, error: mockError });

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Invalid request body' });
    });

    test('should handle unknown routes', async () => {
      mockReq.path = '/unknown';

      await slackHandler({ req: mockReq, res: mockRes, log: mockLog, error: mockError });

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Not found' });
    });
  });

  describe('Audit Logging', () => {
    test('should create audit entries for successful commands', async () => {
      await slackHandler({ req: mockReq, res: mockRes, log: mockLog, error: mockError });

      const { Databases } = require('node-appwrite');
      const mockDatabases = new Databases();
      
      expect(mockDatabases.createDocument).toHaveBeenCalledWith(
        'test-db',
        'recognition_audit',
        'mock-id-123',
        expect.objectContaining({
          eventCode: 'INTEGRATION_CALLED',
          actorId: 'mock-hash',
          metadata: expect.objectContaining({
            integration: 'slack',
            type: 'COMMAND_USED',
            teamId: 'T123',
            channelId: 'C123',
            success: true
          })
        })
      );
    });

    test('should create audit entries for failed commands', async () => {
      const { Functions } = require('node-appwrite');
      const mockFunctions = new Functions();
      mockFunctions.createExecution.mockRejectedValue(new Error('Test error'));

      await slackHandler({ req: mockReq, res: mockRes, log: mockLog, error: mockError });

      const { Databases } = require('node-appwrite');
      const mockDatabases = new Databases();
      
      expect(mockDatabases.createDocument).toHaveBeenCalledWith(
        'test-db',
        'recognition_audit',
        'mock-id-123',
        expect.objectContaining({
          eventCode: 'INTEGRATION_CALLED',
          metadata: expect.objectContaining({
            integration: 'slack',
            type: 'COMMAND_USED',
            success: false,
            error: 'Test error'
          })
        })
      );
    });
  });
});

// Test data helpers
const createMockSlackPayload = (overrides = {}) => ({
  command: '/recognize',
  text: '@user123 for great work #teamwork',
  user_id: 'U123',
  user_name: 'testuser',
  team_id: 'T123',
  channel_id: 'C123',
  response_url: 'https://hooks.slack.com/test',
  ...overrides
});

const createMockInteractivePayload = (overrides = {}) => ({
  type: 'block_actions',
  actions: [{
    action_id: 'verify_recognition',
    value: 'rec-123',
    type: 'button'
  }],
  user: { id: 'U123', name: 'testuser' },
  team: { id: 'T123' },
  channel: { id: 'C123' },
  ...overrides
});

module.exports = {
  createMockSlackPayload,
  createMockInteractivePayload
};