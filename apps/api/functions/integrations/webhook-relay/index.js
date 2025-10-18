// Generic Webhook Relay - Secure inbound webhook handling for future integrations
const { Client, Databases, ID } = require('node-appwrite');
const crypto = require('crypto');

// Generic signature verification for different webhook sources
function verifyWebhookSignature(body, signature, timestamp, source) {
  const secretKey = process.env[`${source.toUpperCase()}_WEBHOOK_SECRET`];
  if (!secretKey) {
    throw new Error(`${source.toUpperCase()}_WEBHOOK_SECRET not configured`);
  }

  let expectedSignature;
  
  switch (source.toLowerCase()) {
    case 'github':
      // GitHub webhook signature format: sha256=<hash>
      expectedSignature = 'sha256=' + crypto
        .createHmac('sha256', secretKey)
        .update(body, 'utf8')
        .digest('hex');
      break;
    
    case 'gitlab':
      // GitLab webhook signature format: <hash>
      expectedSignature = crypto
        .createHmac('sha256', secretKey)
        .update(body, 'utf8')
        .digest('hex');
      break;
    
    case 'generic':
      // Generic HMAC signature format with timestamp
      const sigBasestring = `${timestamp}:${body}`;
      expectedSignature = 'v1=' + crypto
        .createHmac('sha256', secretKey)
        .update(sigBasestring, 'utf8')
        .digest('hex');
      break;
    
    default:
      throw new Error(`Unsupported webhook source: ${source}`);
  }

  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
    throw new Error('Invalid webhook signature');
  }
}

// Create audit entry for webhook events
async function createWebhookAuditEntry(databases, data) {
  try {
    await databases.createDocument(
      process.env.APPWRITE_DATABASE_ID || 'main',
      process.env.RECOGNITION_AUDIT_COLLECTION_ID || 'recognition_audit',
      ID.unique(),
      {
        eventCode: 'INTEGRATION_CALLED',
        actorId: crypto.createHash('sha256').update(data.source + ':' + (data.userId || 'system')).digest('hex'),
        targetId: data.targetId ? crypto.createHash('sha256').update(data.targetId).digest('hex') : undefined,
        metadata: {
          integration: 'webhook-relay',
          source: data.source,
          event: data.event,
          webhookId: data.webhookId,
          message: data.message,
          success: data.success,
          error: data.error
        },
        createdAt: new Date().toISOString()
      }
    );
  } catch (error) {
    console.error('Failed to create webhook audit entry:', error);
  }
}

// Route webhook to appropriate handler
async function routeWebhook(functions, source, event, payload) {
  const routingMap = {
    'github': {
      'push': 'handle-git-push',
      'pull_request': 'handle-git-pr',
      'issues': 'handle-git-issue'
    },
    'gitlab': {
      'push': 'handle-git-push',
      'merge_request': 'handle-git-pr',
      'issue': 'handle-git-issue'
    },
    'jira': {
      'issue_updated': 'handle-jira-issue',
      'issue_created': 'handle-jira-issue'
    },
    'confluence': {
      'page_created': 'handle-confluence-page',
      'page_updated': 'handle-confluence-page'
    }
  };

  const functionName = routingMap[source]?.[event];
  if (!functionName) {
    throw new Error(`No handler found for ${source}:${event}`);
  }

  try {
    const response = await functions.createExecution(
      functionName,
      JSON.stringify(payload)
    );

    return JSON.parse(response.responseBody || '{}');
  } catch (error) {
    throw new Error(`Handler execution failed: ${error.message}`);
  }
}

// Main function handler
module.exports = async ({ req, res, log, error }) => {
  try {
    const { path, method, headers, body } = req;
    
    // Only handle POST requests
    if (method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    // Initialize Appwrite client
    const client = new Client();
    client
      .setEndpoint(process.env.APPWRITE_FUNCTION_ENDPOINT || 'https://cloud.appwrite.io/v1')
      .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID || '')
      .setKey(process.env.APPWRITE_API_KEY || '');

    const databases = new Databases(client);
    const functions = new Functions(client);

    // Extract webhook source from path (/github, /gitlab, /jira, etc.)
    const source = path.substring(1) || 'generic';
    const webhookId = `${source}-${Date.now()}`;

    log(`Webhook received from ${source}`);

    // Parse request body
    let payload;
    try {
      payload = typeof body === 'string' ? JSON.parse(body) : body;
    } catch (err) {
      await createWebhookAuditEntry(databases, {
        source,
        event: 'unknown',
        webhookId,
        message: 'Invalid JSON payload',
        success: false,
        error: 'Invalid JSON'
      });
      return res.status(400).json({ error: 'Invalid JSON payload' });
    }

    // Verify webhook signature based on source
    const signature = headers['x-hub-signature-256'] || // GitHub
                     headers['x-gitlab-token'] ||       // GitLab
                     headers['x-webhook-signature'] ||  // Generic
                     headers['authorization'];          // Bearer token

    const timestamp = headers['x-webhook-timestamp'] || Math.floor(Date.now() / 1000).toString();

    if (signature && process.env[`${source.toUpperCase()}_WEBHOOK_SECRET`]) {
      try {
        verifyWebhookSignature(body, signature, timestamp, source);
        log(`Webhook signature verified for ${source}`);
      } catch (err) {
        error('Webhook signature verification failed:', err);
        
        await createWebhookAuditEntry(databases, {
          source,
          event: 'unknown',
          webhookId,
          message: 'Signature verification failed',
          success: false,
          error: err.message
        });
        
        return res.status(401).json({ error: 'Unauthorized' });
      }
    } else {
      log(`No signature verification configured for ${source}`);
    }

    // Determine event type based on source
    let eventType;
    switch (source) {
      case 'github':
        eventType = headers['x-github-event'];
        break;
      case 'gitlab':
        eventType = headers['x-gitlab-event'];
        break;
      case 'jira':
        eventType = payload.webhookEvent;
        break;
      case 'confluence':
        eventType = payload.eventType;
        break;
      default:
        eventType = payload.event || payload.type || 'unknown';
    }

    if (!eventType) {
      await createWebhookAuditEntry(databases, {
        source,
        event: 'unknown',
        webhookId,
        message: 'Event type not determined',
        success: false,
        error: 'Missing event type'
      });
      return res.status(400).json({ error: 'Event type not determined' });
    }

    log(`Processing ${source} webhook event: ${eventType}`);

    try {
      // Route to appropriate handler
      const result = await routeWebhook(functions, source, eventType, {
        source,
        event: eventType,
        webhookId,
        headers: {
          userAgent: headers['user-agent'],
          deliveryId: headers['x-github-delivery'] || headers['x-gitlab-event-uuid'] || webhookId
        },
        payload
      });

      // Log successful processing
      await createWebhookAuditEntry(databases, {
        source,
        event: eventType,
        webhookId,
        targetId: result.targetId,
        message: `${source} ${eventType} event processed successfully`,
        success: true
      });

      return res.json({
        success: true,
        webhookId,
        event: eventType,
        result: result.success ? 'processed' : 'failed'
      });

    } catch (err) {
      error(`Webhook processing failed for ${source}:${eventType}:`, err);
      
      await createWebhookAuditEntry(databases, {
        source,
        event: eventType,
        webhookId,
        message: `${source} ${eventType} event processing failed`,
        success: false,
        error: err.message
      });

      return res.status(500).json({
        success: false,
        webhookId,
        event: eventType,
        error: 'Processing failed'
      });
    }

  } catch (err) {
    error('Webhook relay error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};