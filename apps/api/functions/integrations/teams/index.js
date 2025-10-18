const { Client, Databases, Functions, ID } = require('node-appwrite');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// Initialize Appwrite client
const client = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1')
  .setProject(process.env.APPWRITE_PROJECT_ID)
  .setKey(process.env.APPWRITE_API_KEY);

const databases = new Databases(client);
const functions = new Functions(client);

/**
 * Teams Integration Handler - JWT validation and compose extension
 * Supports compose extensions for recognition creation and search
 */
module.exports = async ({ req, res, log, error }) => {
  try {
    const { path = '', method = 'POST' } = req;
    log(`Teams integration: ${method} ${path}`);

    // Route based on path
    if (path === '/compose') {
      return await handleComposeExtension(req, res, log, error);
    } else if (path === '/action') {
      return await handleAdaptiveCardAction(req, res, log, error);
    } else if (path === '/webhook') {
      return await handleWebhookNotification(req, res, log, error);
    } else {
      return res.status(404).json({ error: 'Not found' });
    }
  } catch (err) {
    error('Teams integration error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Verify Teams JWT token
 */
async function verifyTeamsToken(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Missing or invalid authorization header');
  }

  const token = authHeader.substring(7);
  
  try {
    // Verify JWT with Teams app private key
    const decoded = jwt.verify(token, process.env.TEAMS_PRIVATE_KEY, {
      audience: process.env.TEAMS_APP_ID,
      algorithms: ['RS256']
    });

    return decoded;
  } catch (err) {
    throw new Error(`JWT verification failed: ${err.message}`);
  }
}

/**
 * Handle Teams compose extension requests
 */
async function handleComposeExtension(req, res, log, error) {
  try {
    // Verify JWT token
    const tokenPayload = await verifyTeamsToken(req.headers.authorization);
    log(`Authenticated user: ${tokenPayload.sub} from tenant: ${tokenPayload.tid}`);

    // Parse request body
    let body;
    try {
      body = JSON.parse(req.body);
    } catch (err) {
      return res.status(400).json({ error: 'Invalid JSON body' });
    }

    const { type, commandId, parameters = [] } = body;

    if (type === 'composeExtension/submitAction') {
      return await handleComposeSubmitAction(commandId, parameters, tokenPayload, res, log, error);
    } else if (type === 'composeExtension/query') {
      return await handleComposeQuery(commandId, parameters, tokenPayload, res, log, error);
    } else {
      return res.json({
        composeExtension: {
          type: 'message',
          text: 'Unknown compose extension type'
        }
      });
    }
  } catch (err) {
    error('Compose extension error:', err);
    if (err.message.includes('Missing or invalid authorization header')) {
      return res.status(401).json({ error: 'Missing or invalid authorization header' });
    } else if (err.message.includes('JWT') || err.message.includes('authorization')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    return res.json({
      composeExtension: {
        type: 'message',
        text: '❌ An error occurred. Please try again or contact support.'
      }
    });
  }
}

/**
 * Handle compose extension submit actions (create recognition)
 */
async function handleComposeSubmitAction(commandId, parameters, tokenPayload, res, log, error) {
  if (commandId === 'createRecognition') {
    return await handleCreateRecognition(parameters, tokenPayload, res, log, error);
  } else {
    return res.json({
      composeExtension: {
        type: 'message',
        text: 'Unknown action. Available commands: createRecognition, searchRecognitions'
      }
    });
  }
}

/**
 * Handle compose extension queries (search recognitions)
 */
async function handleComposeQuery(commandId, parameters, tokenPayload, res, log, error) {
  if (commandId === 'searchRecognitions') {
    return await handleSearchRecognitions(parameters, tokenPayload, res, log, error);
  } else {
    return res.json({
      composeExtension: {
        type: 'message',
        text: 'Unknown query command'
      }
    });
  }
}

/**
 * Create recognition from Teams compose extension
 */
async function handleCreateRecognition(parameters, tokenPayload, res, log, error) {
  try {
    // Extract parameters
    const recognitionText = getParameter(parameters, 'recognitionText');
    const visibility = getParameter(parameters, 'visibility') || 'team';

    // Validate input
    if (!recognitionText || recognitionText.trim().length === 0) {
      return res.json({
        composeExtension: {
          type: 'message',
          text: 'Please provide recognition text with @mentions'
        }
      });
    }

    // Parse recognition text for mentions and tags
    const parsed = parseTeamsRecognitionText(recognitionText);
    
    if (parsed.mentions.length === 0) {
      return res.json({
        composeExtension: {
          type: 'message',
          text: 'Please mention someone to recognize using @username'
        }
      });
    }

    if (parsed.reason.length < 10) {
      return res.json({
        composeExtension: {
          type: 'message',
          text: 'Please provide a reason for recognition (minimum 10 characters)'
        }
      });
    }

    // Create recognition via function
    const recognitionPayload = {
      giverId: tokenPayload.sub,
      giverName: tokenPayload.name,
      recipientTeamsUserIds: parsed.mentions,
      reason: parsed.reason,
      tags: parsed.tags,
      visibility: visibility.toUpperCase(),
      source: 'TEAMS',
      tenantId: tokenPayload.tid
    };

    log('Creating recognition:', JSON.stringify(recognitionPayload, null, 2));

    const execution = await functions.createExecution(
      'create-recognition',
      JSON.stringify(recognitionPayload)
    );

    const result = JSON.parse(execution.responseBody);
    
    // Create audit entry
    await createAuditEntry({
      eventCode: 'INTEGRATION_CALLED',
      actorId: crypto.createHash('sha256').update(tokenPayload.sub).digest('hex'),
      metadata: {
        integration: 'teams',
        type: 'RECOGNITION_CREATED',
        tenantId: tokenPayload.tid,
        recognitionId: result.recognitionId,
        success: result.success
      }
    });

    if (result.success) {
      return res.json({
        composeExtension: {
          type: 'result',
          attachmentLayout: 'list',
          attachments: [{
            contentType: 'application/vnd.microsoft.card.adaptive',
            content: {
              type: 'AdaptiveCard',
              version: '1.4',
              body: [
                {
                  type: 'TextBlock',
                  text: '🎉 Recognition Sent Successfully',
                  weight: 'Bolder',
                  size: 'Medium',
                  color: 'Good'
                },
                {
                  type: 'TextBlock',
                  text: `Recognized: ${parsed.mentions.join(', ')}`,
                  wrap: true
                },
                {
                  type: 'TextBlock',
                  text: `Reason: ${parsed.reason}`,
                  wrap: true
                },
                {
                  type: 'TextBlock',
                  text: `Tags: ${parsed.tags.map(tag => '#' + tag).join(' ')}`,
                  wrap: true,
                  isSubtle: true
                }
              ]
            }
          }]
        }
      });
    } else {
      return res.json({
        composeExtension: {
          type: 'message',
          text: `❌ Failed to create recognition: ${result.error || 'Unknown error'}`
        }
      });
    }
  } catch (err) {
    error('Create recognition error:', err);
    
    // Create audit entry for failure
    try {
      await createAuditEntry({
        eventCode: 'INTEGRATION_CALLED',
        actorId: crypto.createHash('sha256').update(tokenPayload.sub).digest('hex'),
        metadata: {
          integration: 'teams',
          type: 'RECOGNITION_CREATED',
          tenantId: tokenPayload.tid,
          success: false,
          error: err.message
        }
      });
    } catch (auditErr) {
      error('Failed to create audit entry:', auditErr);
    }

    return res.json({
      composeExtension: {
        type: 'message',
        text: '❌ Failed to create recognition. Please try again or contact support.'
      }
    });
  }
}

/**
 * Search recognitions from Teams compose extension
 */
async function handleSearchRecognitions(parameters, tokenPayload, res, log, error) {
  try {
    const searchTerm = getParameter(parameters, 'searchTerm') || '';
    
    log(`Searching recognitions for: "${searchTerm}"`);

    // Search via function
    const searchPayload = {
      query: searchTerm,
      tenantId: tokenPayload.tid,
      actorId: tokenPayload.sub,
      limit: 10
    };

    const execution = await functions.createExecution(
      'search-recognitions',
      JSON.stringify(searchPayload)
    );

    const result = JSON.parse(execution.responseBody);

    if (result.success && result.data && result.data.length > 0) {
      const attachments = result.data.map(recognition => ({
        contentType: 'application/vnd.microsoft.card.hero',
        content: {
          title: `Recognition for ${recognition.recipientName}`,
          subtitle: recognition.reason,
          text: `Tags: ${recognition.tags.map(tag => '#' + tag).join(' ')} | ${recognition.verified ? '✅ Verified' : '⏳ Pending'}`,
          tap: {
            type: 'imBack',
            value: `View recognition ${recognition.id}`
          }
        }
      }));

      return res.json({
        composeExtension: {
          type: 'result',
          attachmentLayout: 'list',
          attachments
        }
      });
    } else {
      return res.json({
        composeExtension: {
          type: 'message',
          text: `No recognitions found for "${searchTerm}"`
        }
      });
    }
  } catch (err) {
    error('Search recognitions error:', err);
    return res.json({
      composeExtension: {
        type: 'message',
        text: '❌ Search failed. Please try again.'
      }
    });
  }
}

/**
 * Handle adaptive card actions
 */
async function handleAdaptiveCardAction(req, res, log, error) {
  try {
    // Verify JWT token
    const tokenPayload = await verifyTeamsToken(req.headers.authorization);

    let body;
    try {
      body = JSON.parse(req.body);
    } catch (err) {
      return res.status(400).json({ error: 'Invalid JSON body' });
    }

    const { action, data } = body;

    if (action === 'verify') {
      return await handleVerifyAction(data, tokenPayload, res, log, error);
    } else {
      return res.json({
        type: 'task/submit',
        value: {
          title: '❌ Unknown Action',
          card: {
            type: 'AdaptiveCard',
            version: '1.4',
            body: [{
              type: 'TextBlock',
              text: 'Unknown action requested.',
              color: 'Attention'
            }]
          }
        }
      });
    }
  } catch (err) {
    error('Adaptive card action error:', err);
    if (err.message.includes('JWT') || err.message.includes('authorization')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Handle recognition verification action
 */
async function handleVerifyAction(data, tokenPayload, res, log, error) {
  try {
    const { recognitionId } = data;
    
    log(`Verifying recognition: ${recognitionId}`);

    // Verify recognition via function
    const verificationPayload = {
      recognitionId,
      verifierId: tokenPayload.sub,
      verifierName: tokenPayload.name,
      tenantId: tokenPayload.tid
    };

    const execution = await functions.createExecution(
      'verify-recognition',
      JSON.stringify(verificationPayload)
    );

    const result = JSON.parse(execution.responseBody);

    if (result.success) {
      return res.json({
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
    } else {
      return res.json({
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
    }
  } catch (err) {
    error('Verify action error:', err);
    return res.json({
      type: 'task/submit',
      value: {
        title: '❌ Error',
        card: {
          type: 'AdaptiveCard',
          version: '1.4',
          body: [{
            type: 'TextBlock',
            text: '❌ An error occurred during verification.',
            weight: 'Bolder',
            color: 'Attention'
          }]
        }
      }
    });
  }
}

/**
 * Handle webhook notifications for Teams channels
 */
async function handleWebhookNotification(req, res, log, error) {
  try {
    let body;
    try {
      body = JSON.parse(req.body);
    } catch (err) {
      return res.status(400).json({ error: 'Invalid JSON body' });
    }

    const { type, data } = body;
    
    if (type === 'recognition.created') {
      return await handleRecognitionCreatedNotification(data, res, log, error);
    } else {
      log(`Unknown webhook type: ${type}`);
      return res.json({ success: true });
    }
  } catch (err) {
    error('Webhook notification error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Send Teams notification for new recognition
 */
async function handleRecognitionCreatedNotification(data, res, log, error) {
  try {
    const { tenantId, recognitionId, giverName, recipientName, reason, tags, verified, requiresVerification } = data;

    log(`Sending Teams notification for recognition: ${recognitionId}`);

    // Get tenant Teams webhook configuration
    const tenantsResult = await databases.listDocuments(
      process.env.APPWRITE_DATABASE_ID,
      'tenants',
      [`tenantId=${tenantId}`]
    );

    if (tenantsResult.documents.length === 0) {
      log(`No tenant found for ID: ${tenantId}`);
      return res.json({ success: true });
    }

    const tenant = tenantsResult.documents[0];
    const { settings = {}, webhookUrl } = tenant;

    if (!settings.notifyOnRecognition || !webhookUrl) {
      log('Teams notifications disabled or no webhook URL configured');
      return res.json({ success: true });
    }

    // Create Teams webhook message
    const teamsMessage = {
      type: 'message',
      attachments: [{
        contentType: 'application/vnd.microsoft.card.adaptive',
        content: {
          type: 'AdaptiveCard',
          version: '1.4',
          body: [
            {
              type: 'TextBlock',
              text: '🎉 New Recognition',
              weight: 'Bolder',
              size: 'Medium'
            },
            {
              type: 'FactSet',
              facts: [
                { title: 'From:', value: giverName },
                { title: 'To:', value: recipientName },
                { title: 'Reason:', value: reason },
                { title: 'Tags:', value: tags.map(tag => '#' + tag).join(' ') },
                { title: 'Status:', value: verified ? '✅ Verified' : (requiresVerification ? '⏳ Pending Verification' : '✅ Auto-Approved') }
              ]
            }
          ],
          actions: requiresVerification ? [{
            type: 'Action.Submit',
            title: 'Verify Recognition',
            data: { action: 'verify', recognitionId }
          }] : []
        }
      }]
    };

    // Send webhook
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(teamsMessage)
    });

    if (response.ok) {
      log('Teams webhook sent successfully');
    } else {
      error(`Teams webhook failed: ${response.status} ${response.statusText}`);
    }

    return res.json({ success: true });
  } catch (err) {
    error('Teams notification error:', err);
    return res.json({ success: false, error: err.message });
  }
}

/**
 * Parse Teams recognition text for mentions, tags, and reason
 */
function parseTeamsRecognitionText(text) {
  // Find all mentions (both types) with their positions
  const mentionMatches = [];
  
  // Find Teams-style mentions: @<at>John Doe</at>
  const teamsRegex = /@<at>([^<]+)<\/at>/g;
  let match;
  while ((match = teamsRegex.exec(text)) !== null) {
    mentionMatches.push({
      index: match.index,
      value: match[1]
    });
  }
  
  // Find simple mentions: @username (but not those inside Teams mentions)
  const simpleRegex = /@([a-zA-Z0-9_.-]+)(?!\w)/g;
  const textWithoutTeamsMentions = text.replace(/@<at>[^<]+<\/at>/g, ' '.repeat(20)); // Replace with spaces to preserve indices
  
  while ((match = simpleRegex.exec(textWithoutTeamsMentions)) !== null) {
    mentionMatches.push({
      index: match.index,
      value: match[1]
    });
  }
  
  // Sort by position and extract values
  const allMentions = mentionMatches
    .sort((a, b) => a.index - b.index)
    .map(m => m.value);

  // Extract hashtags
  const tags = [...text.matchAll(/#([a-zA-Z0-9_-]+)/g)].map(match => match[1]);

  // Extract reason (remove mentions and tags)
  let reason = text
    .replace(/@<at>[^<]+<\/at>/g, '')
    .replace(/@[a-zA-Z0-9_.-]+/g, '')
    .replace(/#[a-zA-Z0-9_-]+/g, '')
    .trim();

  // Clean up extra whitespace
  reason = reason.replace(/\s+/g, ' ').trim();

  return {
    mentions: allMentions,
    tags: tags.slice(0, 3), // Max 3 tags
    reason
  };
}

/**
 * Get parameter value by name
 */
function getParameter(parameters, name) {
  const param = parameters.find(p => p.name === name);
  return param ? param.value : null;
}

/**
 * Create audit entry for integration events
 */
async function createAuditEntry(auditData) {
  try {
    await databases.createDocument(
      process.env.APPWRITE_DATABASE_ID,
      'recognition_audit',
      ID.unique(),
      {
        ...auditData,
        timestamp: new Date().toISOString()
      }
    );
  } catch (err) {
    console.error('Failed to create audit entry:', err);
  }
}