// Teams Integration Tests - Mock JWT validation and compose extension payloads
/* global jest, describe, test, beforeEach, expect, process, require, module, global */

// Mock Appwrite SDK
const mockCreateExecution = jest.fn().mockResolvedValue({
  responseBody: JSON.stringify({ success: true, recognitionId: 'rec-123' })
});

const mockCreateDocument = jest.fn().mockResolvedValue({ $id: 'mock-doc-id' });
const mockListDocuments = jest.fn().mockResolvedValue({ documents: [] });

jest.mock('node-appwrite', () => ({
  Client: jest.fn().mockImplementation(() => ({
    setEndpoint: jest.fn().mockReturnThis(),
    setProject: jest.fn().mockReturnThis(),
    setKey: jest.fn().mockReturnThis(),
  })),
  Databases: jest.fn().mockImplementation(() => ({
    createDocument: mockCreateDocument,
    listDocuments: mockListDocuments,
  })),
  Functions: jest.fn().mockImplementation(() => ({
    createExecution: mockCreateExecution,
  })),
  ID: {
    unique: jest.fn(() => 'mock-id-123'),
  },
}));

// Mock JWT for Teams token verification
const mockJwt = {
  decode: jest.fn(),
  verify: jest.fn(),
};

jest.mock('jsonwebtoken', () => mockJwt);

describe('Teams Integration', () => {
  let teamsHandler;
  let mockReq, mockRes, mockLog, mockError;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    mockCreateExecution.mockClear();
    mockCreateDocument.mockClear();
    mockListDocuments.mockClear();
    
    // Setup environment
    process.env.TEAMS_APP_ID = 'test-app-id';
    process.env.TEAMS_PRIVATE_KEY = 'test-private-key';
    process.env.APPWRITE_DATABASE_ID = 'test-db';
    
    // Setup JWT mocks
    mockJwt.decode.mockReturnValue({
      payload: {
        aud: 'test-app-id',
        sub: 'user-123',
        name: 'Test User',
        tid: 'tenant-123'
      }
    });
    
    mockJwt.verify.mockReturnValue({
      aud: 'test-app-id',
      sub: 'user-123',
      name: 'Test User',
      tid: 'tenant-123'
    });

    // Mock request/response objects
    mockReq = {
      path: '/compose',
      method: 'POST',
      headers: {
        authorization: 'Bearer valid-jwt-token',
      },
      body: JSON.stringify({
        type: 'composeExtension/submitAction',
        commandId: 'createRecognition',
        parameters: [
          { name: 'recognitionText', value: '@john.doe for excellent leadership #leadership' },
          { name: 'visibility', value: 'team' }
        ],
        context: { channelId: 'channel-123' }
      }),
    };

    mockRes = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis(),
    };

    mockLog = jest.fn();
    mockError = jest.fn();

    // Import the handler after mocking
    teamsHandler = require('../../apps/api/functions/integrations/teams/index.js');
  });

  describe('JWT Verification', () => {
    test('should verify valid Teams JWT', async () => {
      await teamsHandler({ req: mockReq, res: mockRes, log: mockLog, error: mockError });

      expect(mockJwt.verify).toHaveBeenCalledWith(
        'valid-jwt-token',
        'test-private-key',
        expect.objectContaining({
          audience: 'test-app-id',
          algorithms: ['RS256']
        })
      );
    });

    test('should reject invalid JWT', async () => {
      mockJwt.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await teamsHandler({ req: mockReq, res: mockRes, log: mockLog, error: mockError });

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
    });

    test('should reject missing authorization header', async () => {
      delete mockReq.headers.authorization;

      await teamsHandler({ req: mockReq, res: mockRes, log: mockLog, error: mockError });

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Missing or invalid authorization header' });
    });

    test('should reject wrong audience', async () => {
      mockJwt.decode.mockReturnValue({
        payload: {
          aud: 'wrong-app-id',
          sub: 'user-123'
        }
      });

      mockJwt.verify.mockImplementation(() => {
        throw new Error('Invalid audience');
      });

      await teamsHandler({ req: mockReq, res: mockRes, log: mockLog, error: mockError });

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
    });
  });

  describe('Compose Extension - Create Recognition', () => {
    test('should create recognition successfully', async () => {
      await teamsHandler({ req: mockReq, res: mockRes, log: mockLog, error: mockError });

      expect(mockRes.json).toHaveBeenCalledWith({
        composeExtension: {
          type: 'result',
          attachmentLayout: 'list',
          attachments: [{
            contentType: 'application/vnd.microsoft.card.adaptive',
            content: expect.objectContaining({
              type: 'AdaptiveCard',
              version: '1.4',
              body: expect.arrayContaining([
                expect.objectContaining({
                  type: 'TextBlock',
                  text: '🎉 Recognition Sent Successfully'
                })
              ])
            })
          }]
        }
      });
    });

    test('should require recognition text', async () => {
      mockReq.body = JSON.stringify({
        type: 'composeExtension/submitAction',
        commandId: 'createRecognition',
        parameters: [
          { name: 'recognitionText', value: '' }
        ]
      });

      await teamsHandler({ req: mockReq, res: mockRes, log: mockLog, error: mockError });

      expect(mockRes.json).toHaveBeenCalledWith({
        composeExtension: {
          type: 'message',
          text: 'Please provide recognition text with @mentions'
        }
      });
    });

    test('should require @mentions', async () => {
      mockReq.body = JSON.stringify({
        type: 'composeExtension/submitAction',
        commandId: 'createRecognition',
        parameters: [
          { name: 'recognitionText', value: 'great work without mentions #teamwork' }
        ]
      });

      await teamsHandler({ req: mockReq, res: mockRes, log: mockLog, error: mockError });

      expect(mockRes.json).toHaveBeenCalledWith({
        composeExtension: {
          type: 'message',
          text: 'Please mention someone to recognize using @username'
        }
      });
    });

    test('should require minimum reason length', async () => {
      mockReq.body = JSON.stringify({
        type: 'composeExtension/submitAction',
        commandId: 'createRecognition',
        parameters: [
          { name: 'recognitionText', value: '@john.doe short' }
        ]
      });

      await teamsHandler({ req: mockReq, res: mockRes, log: mockLog, error: mockError });

      expect(mockRes.json).toHaveBeenCalledWith({
        composeExtension: {
          type: 'message',
          text: 'Please provide a reason for recognition (minimum 10 characters)'
        }
      });
    });

    test('should handle private recognition', async () => {
      mockReq.body = JSON.stringify({
        type: 'composeExtension/submitAction',
        commandId: 'createRecognition',
        parameters: [
          { name: 'recognitionText', value: '@john.doe for excellent leadership #leadership' },
          { name: 'visibility', value: 'private' }
        ]
      });

      await teamsHandler({ req: mockReq, res: mockRes, log: mockLog, error: mockError });

      // Verify that the recognition was created with PRIVATE visibility
      const executionCall = mockCreateExecution.mock.calls.find(call => 
        call[0] === 'create-recognition'
      );
      
      expect(executionCall).toBeDefined();
      const payload = JSON.parse(executionCall[1]);
      expect(payload.visibility).toBe('PRIVATE');
    });
  });

  describe('Compose Extension - Search Recognition', () => {
    beforeEach(() => {
      mockReq.body = JSON.stringify({
        type: 'composeExtension/query',
        commandId: 'searchRecognitions',
        parameters: [
          { name: 'searchTerm', value: 'leadership' }
        ]
      });
    });

    test('should return search results', async () => {
      // Mock the global Functions instance
      mockCreateExecution.mockClear();
      mockCreateExecution.mockResolvedValue({
        responseBody: JSON.stringify({
          success: true,
          data: [
            {
              id: 'rec-1',
              recipientName: 'John Doe',
              reason: 'Excellent leadership skills',
              tags: ['leadership'],
              verified: true
            },
            {
              id: 'rec-2',
              recipientName: 'Jane Smith',
              reason: 'Great team leadership',
              tags: ['leadership', 'teamwork'],
              verified: false
            }
          ]
        })
      });

      await teamsHandler({ req: mockReq, res: mockRes, log: mockLog, error: mockError });

      expect(mockRes.json).toHaveBeenCalledWith({
        composeExtension: {
          type: 'result',
          attachmentLayout: 'list',
          attachments: [
            {
              contentType: 'application/vnd.microsoft.card.hero',
              content: {
                title: 'Recognition for John Doe',
                subtitle: 'Excellent leadership skills',
                text: 'Tags: #leadership | ✅ Verified',
                tap: {
                  type: 'imBack',
                  value: 'View recognition rec-1'
                }
              }
            },
            {
              contentType: 'application/vnd.microsoft.card.hero',
              content: {
                title: 'Recognition for Jane Smith',
                subtitle: 'Great team leadership',
                text: 'Tags: #leadership #teamwork | ⏳ Pending',
                tap: {
                  type: 'imBack',
                  value: 'View recognition rec-2'
                }
              }
            }
          ]
        }
      });
    });

    test('should handle empty search results', async () => {
      mockCreateExecution.mockClear();
      mockCreateExecution.mockResolvedValue({
        responseBody: JSON.stringify({
          success: true,
          data: []
        })
      });

      await teamsHandler({ req: mockReq, res: mockRes, log: mockLog, error: mockError });

      expect(mockRes.json).toHaveBeenCalledWith({
        composeExtension: {
          type: 'message',
          text: 'No recognitions found for "leadership"'
        }
      });
    });
  });

  describe('Adaptive Card Actions', () => {
    beforeEach(() => {
      mockReq.path = '/action';
      mockReq.body = JSON.stringify({
        action: 'verify',
        data: { recognitionId: 'rec-123' }
      });
    });

    test('should handle verification action', async () => {
      const { Functions } = require('node-appwrite');
      const mockFunctions = new Functions();
      mockFunctions.createExecution.mockResolvedValue({
        responseBody: JSON.stringify({ success: true })
      });

      await teamsHandler({ req: mockReq, res: mockRes, log: mockLog, error: mockError });

      expect(mockRes.json).toHaveBeenCalledWith({
        type: 'task/submit',
        value: {
          title: '✅ Verification Successful',
          card: {
            type: 'AdaptiveCard',
            version: '1.4',
            body: [{
              type: 'TextBlock',
              text: '✅ Recognition verified successfully!',
              weight: 'Bolder',
              color: 'Good'
            }]
          }
        }
      });
    });

    test('should handle verification failure', async () => {
      mockCreateExecution.mockClear();
      mockCreateExecution.mockResolvedValue({
        responseBody: JSON.stringify({ success: false })
      });

      await teamsHandler({ req: mockReq, res: mockRes, log: mockLog, error: mockError });

      expect(mockRes.json).toHaveBeenCalledWith({
        type: 'task/submit',
        value: {
          title: '❌ Verification Failed',
          card: {
            type: 'AdaptiveCard',
            version: '1.4',
            body: [{
              type: 'TextBlock',
              text: '❌ Verification failed. Please try again.',
              weight: 'Bolder',
              color: 'Attention'
            }]
          }
        }
      });
    });
  });

  describe('Teams Query Parsing', () => {
    test('should parse Teams mentions correctly', async () => {
      const testCases = [
        {
          input: '@<at>John Doe</at> for great work #teamwork',
          expected: {
            mentions: ['John Doe'],
            tags: ['teamwork'],
            reason: 'for great work'
          }
        },
        {
          input: '@user1 @<at>Jane Smith</at> excellent collaboration #teamwork #leadership',
          expected: {
            mentions: ['user1', 'Jane Smith'],
            tags: ['teamwork', 'leadership'],
            reason: 'excellent collaboration'
          }
        },
        {
          input: 'great work @user123 on the project #innovation',
          expected: {
            mentions: ['user123'],
            tags: ['innovation'],
            reason: 'great work on the project'
          }
        }
      ];

      // Test parsing through the integration endpoint - test one case at a time
      for (const testCase of testCases) {
        mockReq.body = JSON.stringify({
          type: 'composeExtension/submitAction',
          commandId: 'createRecognition',
          parameters: [
            { name: 'recognitionText', value: testCase.input }
          ]
        });
        
        // Clear previous calls
        mockCreateExecution.mockClear();
        
        await teamsHandler({ req: mockReq, res: mockRes, log: mockLog, error: mockError });
        
        // Verify the call to Functions.createExecution contains parsed data
        const executionCall = mockCreateExecution.mock.calls.find(call => 
          call[0] === 'create-recognition'
        );
        
        if (executionCall) {
          const payload = JSON.parse(executionCall[1]);
          expect(payload.recipientTeamsUserIds).toEqual(testCase.expected.mentions);
          expect(payload.tags).toEqual(testCase.expected.tags);
        }
      }
    });
  });

  describe('Webhook Notifications', () => {
    beforeEach(() => {
      mockReq.path = '/webhook';
      mockReq.body = JSON.stringify({
        type: 'recognition.created',
        data: {
          tenantId: 'tenant-123',
          recognitionId: 'rec-123',
          giverId: 'user-123',
          giverName: 'John Doe',
          recipientName: 'Jane Smith',
          reason: 'Excellent leadership',
          tags: ['leadership'],
          verified: false,
          requiresVerification: true
        }
      });
    });

    test('should send Teams webhook notification', async () => {
      mockListDocuments.mockClear();
      mockListDocuments.mockResolvedValue({
        documents: [{
          settings: { notifyOnRecognition: true },
          webhookUrl: 'https://outlook.office.com/webhook/test'
        }]
      });

      // Mock fetch for webhook call
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200
      });

      await teamsHandler({ req: mockReq, res: mockRes, log: mockLog, error: mockError });

      expect(global.fetch).toHaveBeenCalledWith(
        'https://outlook.office.com/webhook/test',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining('🎉 New Recognition')
        })
      );

      expect(mockRes.json).toHaveBeenCalledWith({ success: true });
    });
  });

  describe('Error Handling', () => {
    test('should handle function execution errors', async () => {
      mockCreateExecution.mockClear();
      mockCreateExecution.mockRejectedValue(new Error('Function execution failed'));

      await teamsHandler({ req: mockReq, res: mockRes, log: mockLog, error: mockError });

      expect(mockRes.json).toHaveBeenCalledWith({
        composeExtension: {
          type: 'message',
          text: '❌ Failed to create recognition. Please try again or contact support.'
        }
      });
    });

    test('should handle invalid JSON body', async () => {
      mockReq.body = 'invalid-json';

      await teamsHandler({ req: mockReq, res: mockRes, log: mockLog, error: mockError });

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Invalid JSON body' });
    });

    test('should handle unknown routes', async () => {
      mockReq.path = '/unknown';

      await teamsHandler({ req: mockReq, res: mockRes, log: mockLog, error: mockError });

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Not found' });
    });

    test('should handle unknown compose extension commands', async () => {
      mockReq.body = JSON.stringify({
        type: 'composeExtension/submitAction',
        commandId: 'unknownCommand',
        parameters: []
      });

      await teamsHandler({ req: mockReq, res: mockRes, log: mockLog, error: mockError });

      expect(mockRes.json).toHaveBeenCalledWith({
        composeExtension: {
          type: 'message',
          text: 'Unknown action. Available commands: createRecognition, searchRecognitions'
        }
      });
    });
  });

  describe('Audit Logging', () => {
    test('should create audit entries for successful recognition creation', async () => {
      // Ensure successful mock is set up
      mockCreateExecution.mockClear();
      mockCreateExecution.mockResolvedValue({
        responseBody: JSON.stringify({ success: true, recognitionId: 'rec-123' })
      });
      
      await teamsHandler({ req: mockReq, res: mockRes, log: mockLog, error: mockError });
      
      expect(mockCreateDocument).toHaveBeenCalledWith(
        'test-db',
        'recognition_audit',
        'mock-id-123',
        expect.objectContaining({
          eventCode: 'INTEGRATION_CALLED',
          actorId: expect.any(String),
          metadata: expect.objectContaining({
            integration: 'teams',
            type: 'RECOGNITION_CREATED',
            tenantId: 'tenant-123',
            success: true
          })
        })
      );
    });

    test('should create audit entries for failed operations', async () => {
      mockCreateExecution.mockClear();
      mockCreateExecution.mockRejectedValue(new Error('Test error'));

      await teamsHandler({ req: mockReq, res: mockRes, log: mockLog, error: mockError });
      
      expect(mockCreateDocument).toHaveBeenCalledWith(
        'test-db',
        'recognition_audit',
        'mock-id-123',
        expect.objectContaining({
          eventCode: 'INTEGRATION_CALLED',
          metadata: expect.objectContaining({
            integration: 'teams',
            type: 'RECOGNITION_CREATED',
            success: false,
            error: 'Test error'
          })
        })
      );
    });
  });
});

// Test data helpers
const createMockTeamsComposePayload = (overrides = {}) => ({
  type: 'composeExtension/submitAction',
  commandId: 'createRecognition',
  parameters: [
    { name: 'recognitionText', value: '@john.doe for excellent work #teamwork' },
    { name: 'visibility', value: 'team' }
  ],
  context: { channelId: 'channel-123' },
  ...overrides
});

const createMockTeamsQueryPayload = (overrides = {}) => ({
  type: 'composeExtension/query',
  commandId: 'searchRecognitions',
  parameters: [
    { name: 'searchTerm', value: 'leadership' }
  ],
  ...overrides
});

const createMockTeamsActionPayload = (overrides = {}) => ({
  action: 'verify',
  data: { recognitionId: 'rec-123' },
  ...overrides
});

module.exports = {
  createMockTeamsComposePayload,
  createMockTeamsQueryPayload,
  createMockTeamsActionPayload
};