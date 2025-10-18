# Integration Documentation

This document provides examples and configuration details for Slack, Teams, and generic webhook integrations.

## Environment Variables

### Required for All Integrations

```env
# Appwrite Configuration
APPWRITE_FUNCTION_ENDPOINT=https://cloud.appwrite.io/v1
APPWRITE_FUNCTION_PROJECT_ID=your-project-id
APPWRITE_API_KEY=your-api-key
APPWRITE_DATABASE_ID=main
RECOGNITION_AUDIT_COLLECTION_ID=recognition_audit

# Security
SLACK_SIGNING_SECRET=your-slack-signing-secret
SLACK_BOT_TOKEN=xoxb-your-bot-token
TEAMS_APP_ID=your-teams-app-id
TEAMS_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----

# Webhook Relay
GITHUB_WEBHOOK_SECRET=your-github-webhook-secret
GITLAB_WEBHOOK_SECRET=your-gitlab-webhook-secret
JIRA_WEBHOOK_SECRET=your-jira-webhook-secret
GENERIC_WEBHOOK_SECRET=your-generic-webhook-secret
```

## Slack Integration

### Slack App Manifest

```yaml
_metadata:
  major_version: 1
  minor_version: 1
display_information:
  name: Recognition Bot
  description: Employee recognition and feedback platform
  background_color: "#2c3e50"
features:
  bot_user:
    display_name: Recognition Bot
    always_online: false
  slash_commands:
    - command: /recognize
      url: https://your-domain.com/v1/functions/slack-integration/command
      description: Recognize a team member publicly
      usage_hint: "@user for great work #teamwork"
      should_escape: false
    - command: /recognize-private
      url: https://your-domain.com/v1/functions/slack-integration/command
      description: Recognize a team member privately
      usage_hint: "@user for great work #leadership"
      should_escape: false
    - command: /recognition-stats
      url: https://your-domain.com/v1/functions/slack-integration/command
      description: View your recognition statistics
      should_escape: false
  interactivity:
    is_enabled: true
    request_url: https://your-domain.com/v1/functions/slack-integration/interactive
oauth_config:
  scopes:
    bot:
      - commands
      - chat:write
      - users:read
      - users:read.email
      - channels:read
      - groups:read
      - im:read
      - mpim:read
settings:
  event_subscriptions:
    request_url: https://your-domain.com/v1/functions/slack-integration/webhook
    bot_events:
      - app_mention
      - message.channels
  interactivity:
    is_enabled: true
    request_url: https://your-domain.com/v1/functions/slack-integration/interactive
  org_deploy_enabled: false
  socket_mode_enabled: false
  token_rotation_enabled: false
```

### Slack Usage Examples

```bash
# Public recognition
/recognize @john.doe for excellent leadership on the Q4 project #leadership #excellence

# Private recognition  
/recognize-private @jane.smith for mentoring new team members #mentorship

# Get your stats
/recognition-stats
```

### Slack Interactive Components

The bot supports interactive verification buttons for managers:

```json
{
  "type": "block_actions",
  "actions": [
    {
      "action_id": "verify_recognition",
      "type": "button",
      "value": "recognition-id-here"
    }
  ]
}
```

## Microsoft Teams Integration

### Teams App Manifest

```json
{
  "$schema": "https://developer.microsoft.com/en-us/json-schemas/teams/v1.16/MicrosoftTeams.schema.json",
  "manifestVersion": "1.16",
  "version": "1.0.0",
  "id": "your-app-id-guid",
  "packageName": "com.yourcompany.recognition",
  "developer": {
    "name": "Your Company",
    "websiteUrl": "https://yourcompany.com",
    "privacyUrl": "https://yourcompany.com/privacy",
    "termsOfUseUrl": "https://yourcompany.com/terms"
  },
  "icons": {
    "color": "color.png",
    "outline": "outline.png"
  },
  "name": {
    "short": "Recognition",
    "full": "Employee Recognition Platform"
  },
  "description": {
    "short": "Recognize and celebrate team achievements",
    "full": "A comprehensive platform for employee recognition, feedback, and team building through seamless Teams integration."
  },
  "accentColor": "#FFFFFF",
  "composeExtensions": [
    {
      "botId": "your-bot-id",
      "commands": [
        {
          "id": "createRecognition",
          "type": "action",
          "title": "Send Recognition",
          "description": "Recognize a team member for their great work",
          "context": ["compose", "message"],
          "parameters": [
            {
              "name": "recognitionText",
              "title": "Recognition",
              "description": "Enter recognition with @mentions and #tags",
              "inputType": "textarea"
            },
            {
              "name": "visibility",
              "title": "Visibility",
              "description": "Choose recognition visibility",
              "inputType": "choiceSet",
              "choices": [
                {
                  "title": "Team (Public)",
                  "value": "team"
                },
                {
                  "title": "Private",
                  "value": "private"
                }
              ]
            }
          ]
        },
        {
          "id": "searchRecognitions",
          "type": "query",
          "title": "Search Recognitions",
          "description": "Find existing recognitions",
          "context": ["compose"],
          "parameters": [
            {
              "name": "searchTerm",
              "title": "Search",
              "description": "Search recognitions by name or keyword",
              "inputType": "text"
            }
          ]
        }
      ]
    }
  ],
  "permissions": [
    "identity",
    "messageTeamMembers"
  ],
  "validDomains": [
    "your-domain.com"
  ],
  "webApplicationInfo": {
    "id": "your-azure-app-id",
    "resource": "https://graph.microsoft.com/"
  }
}
```

### Teams Usage Examples

#### Compose Extension
1. Click the ... menu in Teams compose box
2. Select "Recognition" app
3. Choose "Send Recognition"
4. Enter: "@John Doe for exceptional project delivery #excellence #leadership"
5. Select visibility: Team or Private
6. Submit

#### Search Existing Recognitions
1. Use the search command in compose extension
2. Enter keywords like "leadership" or person names
3. Browse results and share relevant recognitions

## Generic Webhook Integration

### Supported Sources

- **GitHub**: Push events, PR events, Issue events
- **GitLab**: Push events, Merge request events, Issue events  
- **Jira**: Issue created/updated events
- **Confluence**: Page created/updated events

### Webhook URLs

```
# GitHub webhooks
POST https://your-domain.com/v1/functions/webhook-relay/github

# GitLab webhooks  
POST https://your-domain.com/v1/functions/webhook-relay/gitlab

# Jira webhooks
POST https://your-domain.com/v1/functions/webhook-relay/jira

# Confluence webhooks
POST https://your-domain.com/v1/functions/webhook-relay/confluence

# Generic webhooks
POST https://your-domain.com/v1/functions/webhook-relay/generic
```

### GitHub Webhook Configuration

```json
{
  "name": "recognition-integration",
  "active": true,
  "events": [
    "push",
    "pull_request", 
    "issues"
  ],
  "config": {
    "url": "https://your-domain.com/v1/functions/webhook-relay/github",
    "content_type": "json",
    "secret": "your-github-webhook-secret",
    "insecure_ssl": "0"
  }
}
```

### GitLab Webhook Configuration

1. Go to Project Settings > Webhooks
2. URL: `https://your-domain.com/v1/functions/webhook-relay/gitlab`
3. Secret Token: `your-gitlab-webhook-secret`
4. Trigger Events:
   - Push events
   - Issues events  
   - Merge request events
5. Enable SSL verification

### Jira Webhook Configuration

```json
{
  "name": "Recognition Integration",
  "url": "https://your-domain.com/v1/functions/webhook-relay/jira",
  "events": [
    "jira:issue_created",
    "jira:issue_updated"
  ],
  "filters": {
    "issue-related-events-section": ""
  }
}
```

## Security Configuration

### Signature Verification

All integrations implement signature verification for security:

- **Slack**: HMAC-SHA256 with `x-slack-signature` header
- **Teams**: JWT token validation with RSA-256  
- **GitHub**: HMAC-SHA256 with `x-hub-signature-256` header
- **GitLab**: HMAC-SHA256 with `x-gitlab-token` header

### Rate Limiting

Implement rate limiting in your API gateway:

```yaml
# Example Kong rate limiting
plugins:
  - name: rate-limiting
    config:
      minute: 100
      hour: 1000
      policy: local
```

### IP Allowlisting

Consider allowlisting known IP ranges:

```yaml
# Slack IP ranges
slack_ips:
  - "35.171.147.0/24"
  - "52.203.14.55/32"
  
# GitHub IP ranges  
github_ips:
  - "192.30.252.0/22"
  - "185.199.108.0/22"
```

## Audit Logging

All integration events are logged to the `recognition_audit` collection with:

- **Event Code**: `INTEGRATION_CALLED`
- **Actor ID**: Hashed user/system identifier
- **Target ID**: Hashed recognition/resource identifier  
- **Metadata**: Integration-specific context
- **Timestamp**: ISO 8601 formatted

### Sample Audit Entry

```json
{
  "$id": "audit-entry-123",
  "eventCode": "INTEGRATION_CALLED",
  "actorId": "sha256-hash-of-user-id",
  "targetId": "sha256-hash-of-recognition-id",
  "metadata": {
    "integration": "slack",
    "type": "COMMAND_USED", 
    "teamId": "T1234567890",
    "channelId": "C1234567890",
    "message": "/recognize command used successfully",
    "success": true
  },
  "createdAt": "2025-10-18T10:00:00.000Z"
}
```

## Error Handling

### Common Error Codes

- **400**: Invalid request format or missing required fields
- **401**: Authentication/signature verification failed
- **404**: Integration endpoint not found
- **429**: Rate limit exceeded  
- **500**: Internal server error

### Error Response Format

```json
{
  "success": false,
  "error": "Signature verification failed",
  "code": "INVALID_SIGNATURE",
  "timestamp": "2025-10-18T10:00:00.000Z",
  "requestId": "req-123456"
}
```

## Testing Integration

### Test Slack Commands Locally

```bash
# Test signature verification
curl -X POST http://localhost:3000/command \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -H "x-slack-signature: v0=..." \
  -H "x-slack-request-timestamp: 1234567890" \
  -d "command=/recognize&text=@user for great work&user_id=U123&team_id=T123"
```

### Test Teams Compose Extension

```bash
# Test JWT validation
curl -X POST http://localhost:3000/compose \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-jwt-token" \
  -d '{
    "type": "composeExtension/submitAction",
    "commandId": "createRecognition",
    "parameters": [
      {"name": "recognitionText", "value": "@user for excellent work #leadership"}
    ]
  }'
```

### Test Webhook Relay

```bash
# Test GitHub webhook
curl -X POST http://localhost:3000/github \
  -H "Content-Type: application/json" \
  -H "x-github-event: push" \
  -H "x-hub-signature-256: sha256=..." \
  -d '{
    "repository": {"name": "test-repo"},
    "commits": [{"message": "feat: add recognition feature"}]
  }'
```

## Monitoring and Observability

### Key Metrics to Track

- Integration response times
- Signature verification success rates
- Recognition creation success rates  
- Webhook delivery success rates
- User engagement by integration source

### Log Analysis Queries

```sql
-- Most active Slack teams
SELECT metadata->teamId as team_id, COUNT(*) as usage_count
FROM recognition_audit 
WHERE metadata->integration = 'slack'
AND createdAt > NOW() - INTERVAL '30 days'
GROUP BY team_id
ORDER BY usage_count DESC;

-- Failed integration attempts
SELECT metadata->integration, metadata->error, COUNT(*)
FROM recognition_audit
WHERE metadata->success = false
AND createdAt > NOW() - INTERVAL '7 days'  
GROUP BY metadata->integration, metadata->error
ORDER BY count DESC;
```