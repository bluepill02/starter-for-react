/* eslint-env node */
/* global require, process, module */

// Slack Integration Functions - Bot Commands and Webhooks
const sdk = require('node-appwrite');
const crypto = require('crypto');

// Slack signature verification
function verifySlackSignature(body, signature, timestamp) {
  const signingSecret = process.env.SLACK_SIGNING_SECRET;
  if (!signingSecret) {
    throw new Error('SLACK_SIGNING_SECRET not configured');
  }

  // Check timestamp (should be within 5 minutes)
  const currentTime = Math.floor(Date.now() / 1000);
  if (Math.abs(currentTime - parseInt(timestamp)) > 300) {
    throw new Error('Request timestamp too old');
  }

  // Verify signature
  const sigBasestring = `v0:${timestamp}:${body}`;
  const expectedSignature = 'v0=' + crypto
    .createHmac('sha256', signingSecret)
    .update(sigBasestring)
    .digest('hex');

  if (expectedSignature !== signature) {
    throw new Error('Invalid signature');
  }
}

// Parse Slack slash command
function parseSlackCommand(text) {
  const mentions = text.match(/<@[^>]+>/g) || [];
  const tags = text.match(/#\w+/g) || [];
  
  // Remove mentions and tags to get the reason
  let reason = text.replace(/<@[^>]+>/g, '').replace(/#\w+/g, '').trim();
  
  // Remove quotes if present
  const quotedMatch = reason.match(/"([^"]*)"/);
  if (quotedMatch) {
    reason = quotedMatch[1];
  }

  return {
    mentions: mentions.map(m => m.replace(/[<@>]/g, '')),
    tags: tags.map(t => t.replace('#', '')),
    reason: reason || 'Great work!'
  };
}

// Create audit entry for Slack interactions
async function createSlackAuditEntry(databases, data) {
  try {
    await databases.createDocument(
      'main',
      'slack_notification_logs',
      sdk.ID.unique(),
      {
        type: data.type,
        teamId: data.teamId,
        channelId: data.channelId,
        userId: data.userId,
        recognitionId: data.recognitionId,
        message: data.message,
        success: data.success,
        error: data.error,
        timestamp: new Date().toISOString()
      }
    );
  } catch (error) {
    console.error('Failed to create Slack audit entry:', error);
  }
}

// Send Slack notification
async function sendSlackNotification(webhookUrl, message) {
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(message)
    });

    if (!response.ok) {
      throw new Error(`Webhook failed: ${response.status} ${response.statusText}`);
    }

    return { success: true };
  } catch (error) {
    console.error('Slack notification failed:', error);
    return { success: false, error: error.message };
  }
}

// Main function handler
module.exports = async ({ req, res, log, error }) => {
  try {
    const { path, method, headers, body } = req;
    
    // Initialize Appwrite client
    const client = new sdk.Client();
    client
      .setEndpoint(process.env.APPWRITE_FUNCTION_ENDPOINT || 'https://cloud.appwrite.io/v1')
      .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
      .setKey(process.env.APPWRITE_API_KEY);

    const databases = new sdk.Databases(client);
    const functions = new sdk.Functions(client);

    // Parse request body
    let requestData;
    try {
      requestData = typeof body === 'string' ? JSON.parse(body) : body;
    } catch {
      // Handle form-encoded Slack requests
      requestData = new URLSearchParams(body);
    }

    // Route requests
    if (path === '/command' && method === 'POST') {
      // Handle slash command (/recognize)
      const timestamp = headers['x-slack-request-timestamp'];
      const signature = headers['x-slack-signature'];
      
      // Verify Slack signature
      verifySlackSignature(body, signature, timestamp);

      const command = requestData.get('command');
      const text = requestData.get('text') || '';
      const userId = requestData.get('user_id');
      const userName = requestData.get('user_name');
      const teamId = requestData.get('team_id');
      const channelId = requestData.get('channel_id');

      log(`Slack command received: ${command} from ${userName}`);

      if (command === '/recognize' || command === '/recognize-private') {
        const isPrivate = command === '/recognize-private';
        const parsed = parseSlackCommand(text);

        if (parsed.mentions.length === 0) {
          return res.json({
            response_type: 'ephemeral',
            text: 'Please mention someone to recognize using @username'
          });
        }

        if (!parsed.reason || parsed.reason.length < 10) {
          return res.json({
            response_type: 'ephemeral',
            text: 'Please provide a reason for recognition (minimum 10 characters)'
          });
        }

        try {
          // Create recognition via function
          const recognitionData = {
            giverSlackUserId: userId,
            recipientSlackUserIds: parsed.mentions,
            reason: parsed.reason,
            tags: parsed.tags.slice(0, 3), // Max 3 tags
            visibility: isPrivate ? 'PRIVATE' : 'TEAM',
            source: 'SLACK',
            sourceData: {
              teamId,
              channelId,
              userName
            }
          };

          const createResponse = await functions.createExecution(
            'create-recognition-slack',
            JSON.stringify(recognitionData)
          );

          const result = JSON.parse(createResponse.responseBody || '{}');

          if (result.success) {
            // Log successful command usage
            await createSlackAuditEntry(databases, {
              type: 'COMMAND_USED',
              teamId,
              channelId,
              userId,
              recognitionId: result.recognitionId,
              message: `${command} command used successfully`,
              success: true
            });

            return res.json({
              response_type: isPrivate ? 'ephemeral' : 'in_channel',
              text: `🎉 Recognition sent successfully!`,
              attachments: [{
                color: 'good',
                fields: [{
                  title: 'Recognition',
                  value: `${parsed.reason}\n\nTags: ${parsed.tags.map(t => `#${t}`).join(' ')}`,
                  short: false
                }]
              }]
            });
          } else {
            throw new Error(result.error || 'Recognition creation failed');
          }
        } catch (err) {
          error('Recognition creation failed:', err);
          
          await createSlackAuditEntry(databases, {
            type: 'COMMAND_USED',
            teamId,
            channelId,
            userId,
            message: `${command} command failed`,
            success: false,
            error: err.message
          });

          return res.json({
            response_type: 'ephemeral',
            text: '❌ Failed to create recognition. Please try again or contact support.'
          });
        }
      } else if (command === '/recognition-stats') {
        try {
          // Get user statistics
          const statsResponse = await functions.createExecution(
            'get-user-stats-slack',
            JSON.stringify({ slackUserId: userId, teamId })
          );

          const stats = JSON.parse(statsResponse.responseBody || '{}');

          if (stats.success) {
            return res.json({
              response_type: 'ephemeral',
              text: `📊 Your Recognition Stats`,
              attachments: [{
                color: '#36C5F0',
                fields: [
                  {
                    title: 'Given',
                    value: stats.data.given.toString(),
                    short: true
                  },
                  {
                    title: 'Received',
                    value: stats.data.received.toString(),
                    short: true
                  },
                  {
                    title: 'Total Weight',
                    value: stats.data.totalWeight.toString(),
                    short: true
                  },
                  {
                    title: 'Verified',
                    value: stats.data.verified.toString(),
                    short: true
                  }
                ]
              }]
            });
          } else {
            throw new Error('Stats retrieval failed');
          }
        } catch (err) {
          error('Stats retrieval failed:', err);
          return res.json({
            response_type: 'ephemeral',
            text: '❌ Failed to retrieve stats. Please try again.'
          });
        }
      }

      return res.json({
        response_type: 'ephemeral',
        text: 'Unknown command. Available commands: /recognize, /recognize-private, /recognition-stats'
      });

    } else if (path === '/interactive' && method === 'POST') {
      // Handle interactive components (buttons, modals)
      const payload = JSON.parse(requestData.get('payload'));
      
      // Verify Slack signature
      const timestamp = headers['x-slack-request-timestamp'];
      const signature = headers['x-slack-signature'];
      verifySlackSignature(body, signature, timestamp);

      log(`Interactive component: ${payload.type}`);

      // Handle different interaction types
      if (payload.type === 'block_actions') {
        const action = payload.actions[0];
        
        if (action.action_id === 'verify_recognition') {
          const recognitionId = action.value;
          const userId = payload.user.id;

          try {
            // Verify recognition
            const verifyResponse = await functions.createExecution(
              'verify-recognition',
              JSON.stringify({
                recognitionId,
                action: 'APPROVE',
                verifierSlackUserId: userId,
                source: 'SLACK'
              })
            );

            const result = JSON.parse(verifyResponse.responseBody || '{}');

            if (result.success) {
              return res.json({
                text: '✅ Recognition verified successfully!',
                replace_original: true
              });
            } else {
              throw new Error('Verification failed');
            }
          } catch (err) {
            error('Verification failed:', err);
            return res.json({
              text: '❌ Verification failed. Please try again.',
              replace_original: true
            });
          }
        }
      }

      return res.json({ text: 'Action processed' });

    } else if (path === '/webhook' && method === 'POST') {
      // Handle incoming webhook notifications
      const { type, data } = requestData;

      log(`Webhook notification: ${type}`);

      if (type === 'recognition.created') {
        // Send notification to Slack about new recognition
        try {
          const integration = await databases.listDocuments(
            'main',
            'slack_integrations',
            [`teamId.equal("${data.teamId}")`, 'isActive.equal(true)']
          );

          if (integration.documents.length > 0) {
            const config = integration.documents[0];
            
            if (config.settings?.notifyOnRecognition && config.webhookUrl) {
              const message = {
                text: '🎉 New Recognition',
                attachments: [{
                  color: 'good',
                  fields: [
                    {
                      title: 'From',
                      value: data.giverName || data.giverEmail,
                      short: true
                    },
                    {
                      title: 'To',
                      value: data.recipientName || data.recipientEmail,
                      short: true
                    },
                    {
                      title: 'Recognition',
                      value: data.reason,
                      short: false
                    },
                    {
                      title: 'Tags',
                      value: data.tags?.map(t => `#${t}`).join(' ') || 'None',
                      short: true
                    }
                  ],
                  actions: data.requiresVerification ? [{
                    type: 'button',
                    text: 'Verify',
                    style: 'primary',
                    value: data.recognitionId,
                    action_id: 'verify_recognition'
                  }] : undefined
                }]
              };

              const notificationResult = await sendSlackNotification(config.webhookUrl, message);
              
              await createSlackAuditEntry(databases, {
                type: 'RECOGNITION_CREATED',
                teamId: data.teamId,
                recognitionId: data.recognitionId,
                message: 'Recognition notification sent',
                success: notificationResult.success,
                error: notificationResult.error
              });
            }
          }
        } catch (err) {
          error('Webhook processing failed:', err);
        }
      }

      return res.json({ success: true });
    }

    return res.status(404).json({ error: 'Not found' });

  } catch (err) {
    error('Slack integration error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};