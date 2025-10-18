# Phase 6B API Integration Guide

**Version**: 1.0.0  
**Status**: Production Ready  
**Date**: October 18, 2025

---

## Table of Contents
1. [API Overview](#api-overview)
2. [Authentication](#authentication)
3. [Endpoints](#endpoints)
4. [Error Handling](#error-handling)
5. [Rate Limiting](#rate-limiting)
6. [SDK Examples](#sdk-examples)
7. [Database Collections](#database-collections)
8. [Webhook Events](#webhook-events)

---

## API Overview

### Base URL
```
https://api.recognition.com/v1
```

### Authentication
All endpoints require Bearer token authentication via Appwrite.

### Response Format
All responses are JSON with the following structure:
```json
{
  "success": true,
  "data": { /* response data */ },
  "error": null,
  "meta": {
    "timestamp": "2025-10-18T12:00:00Z",
    "requestId": "req_abc123"
  }
}
```

---

## Authentication

### Bearer Token
```bash
Authorization: Bearer <appwrite_session_token>
```

### API Key (Server-to-Server)
```bash
Authorization: Bearer <api_key>
X-Appwrite-Key: <api_key>
```

### Required Headers
```
Content-Type: application/json
Authorization: Bearer <token>
X-Request-ID: <unique-request-id>
```

---

## Endpoints

### 1. Social Sharing

#### POST /api/social-share

**Purpose**: Generate shareable token for a recognition

**Request**
```bash
curl -X POST https://api.recognition.com/v1/api/social-share \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "recognitionId": "rec_abc123",
    "platform": "slack",
    "includeProfile": true,
    "message": "Check out this amazing recognition!"
  }'
```

**Request Parameters**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `recognitionId` | string | Yes | ID of the recognition to share |
| `platform` | string | Yes | Platform: `slack`, `teams`, `linkedin`, `link` |
| `includeProfile` | boolean | No | Include giver profile in share (default: true) |
| `message` | string | No | Custom message for share |

**Response (Success)**
```json
{
  "success": true,
  "data": {
    "shareToken": "shr_abc123def456",
    "shareUrl": "https://app.recognition.com/share/shr_abc123?ref=slack",
    "previewUrl": "https://app.recognition.com/api/og?data=eyJ...",
    "platform": "SLACK",
    "trackingId": "track_xyz789",
    "expiresAt": "2025-12-18T12:00:00Z",
    "expiresIn": 7776000
  }
}
```

**Response (Error)**
```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "INVALID_PERMISSION",
    "message": "Only the recognition giver can share"
  }
}
```

**Status Codes**
| Code | Meaning |
|------|---------|
| 200 | Success |
| 400 | Invalid parameters |
| 401 | Unauthorized |
| 403 | Forbidden (not giver) |
| 404 | Recognition not found |
| 429 | Rate limited |
| 500 | Server error |

**Rate Limit**
- 10 shares per user per day
- Window: Sliding 24 hours

---

#### POST /api/track-share

**Purpose**: Track share interactions (views, clicks, reactions)

**Request**
```bash
curl -X POST https://api.recognition.com/v1/api/track-share \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "shareToken": "shr_abc123",
    "action": "VIEW",
    "viewerId": "user_xyz"
  }'
```

**Request Parameters**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `shareToken` | string | Yes | Share token to track |
| `action` | string | Yes | Action type: `VIEW`, `CLICK`, `REACT` |
| `viewerId` | string | No | Hashed ID of viewer (for identified tracking) |
| `metadata` | object | No | Additional metadata (reaction type, etc.) |

**Response (Success)**
```json
{
  "success": true,
  "data": {
    "tracked": true,
    "stats": {
      "views": 24,
      "clicks": 8,
      "reactions": 3
    },
    "updatedAt": "2025-10-18T13:45:00Z"
  }
}
```

---

### 2. Leaderboard

#### GET /api/leaderboard

**Purpose**: Fetch ranked leaderboard with filters

**Request**
```bash
curl -X GET "https://api.recognition.com/v1/api/leaderboard?type=givers&period=month&limit=20" \
  -H "Authorization: Bearer <token>"
```

**Query Parameters**
| Parameter | Type | Options | Default |
|-----------|------|---------|---------|
| `type` | string | `givers`, `receivers` | `receivers` |
| `period` | string | `week`, `month`, `all` | `month` |
| `limit` | integer | 1-100 | 20 |
| `offset` | integer | >= 0 | 0 |

**Response (Success)**
```json
{
  "success": true,
  "data": {
    "period": "month",
    "type": "receivers",
    "generatedAt": "2025-10-18T12:00:00Z",
    "cacheHit": true,
    "rankings": [
      {
        "rank": 1,
        "userId": "user_alice",
        "name": "Alice Johnson",
        "avatar": "AJ",
        "stats": {
          "given": 15,
          "received": 42,
          "verified": 38,
          "shares": 12,
          "views": 284
        },
        "engagementScore": 98.5,
        "trend": "↑",
        "trendChange": 3,
        "streak": 15
      },
      {
        "rank": 2,
        "userId": "user_bob",
        "name": "Bob Smith",
        "avatar": "BS",
        "stats": {
          "given": 22,
          "received": 38,
          "verified": 35,
          "shares": 9,
          "views": 201
        },
        "engagementScore": 87.2,
        "trend": "↓",
        "trendChange": -2,
        "streak": 8
      }
    ],
    "meta": {
      "total": 145,
      "returned": 20,
      "hasMore": true
    }
  }
}
```

**Engagement Score Formula**
```
score = base_weight × (1 + verification_bonus + share_bonus + view_bonus)

where:
  - base_weight = sum of all recognition weights received
  - verification_bonus = 0.3 (if 80%+ of recognitions verified)
  - share_bonus = min(shares, 100) / 100 × 0.2
  - view_bonus = min(views, 1000) / 1000 × 0.1
```

**Caching**
- TTL: 5 minutes
- Header: `X-Cache-Status: HIT | MISS`
- Clear cache: `DELETE /api/leaderboard/cache`

---

### 3. Engagement Score

#### POST /api/engagement-score

**Purpose**: Calculate engagement score for recognitions or users

**Request (Single Recognition)**
```bash
curl -X POST https://api.recognition.com/v1/api/engagement-score \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "given",
    "recognitionId": "rec_abc123"
  }'
```

**Request (User Scores)**
```bash
curl -X POST https://api.recognition.com/v1/api/engagement-score \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "received",
    "userId": "user_alice"
  }'
```

**Request Parameters**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `type` | string | Yes | `given`, `received`, or `bulk` |
| `recognitionId` | string | If type=given | Recognition ID |
| `userId` | string | If type=received | User ID |
| `userIds` | array | If type=bulk | Array of user IDs |

**Response (Success)**
```json
{
  "success": true,
  "data": {
    "type": "received",
    "userId": "user_alice",
    "score": 98.5,
    "breakdown": {
      "baseWeight": 85.0,
      "verificationBonus": 0.3,
      "shareBonus": 0.15,
      "viewBonus": 0.08,
      "multiplier": 1.53
    },
    "stats": {
      "totalRecognitions": 42,
      "verifiedRecognitions": 38,
      "totalShares": 12,
      "totalViews": 284
    }
  }
}
```

---

### 4. Analytics

#### GET /api/analytics

**Purpose**: Fetch personal engagement analytics

**Request**
```bash
curl -X GET "https://api.recognition.com/v1/api/analytics?userId=user_alice&period=30" \
  -H "Authorization: Bearer <token>"
```

**Query Parameters**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `userId` | string | current user | User to fetch analytics for |
| `period` | integer | 30 | Days to look back |
| `includeDaily` | boolean | false | Include daily breakdown |

**Response (Success)**
```json
{
  "success": true,
  "data": {
    "userId": "user_alice",
    "period": 30,
    "generatedAt": "2025-10-18T12:00:00Z",
    "summary": {
      "given": {
        "allTime": 156,
        "thisPeriod": 15,
        "trend": "+3",
        "trendPercent": 25
      },
      "received": {
        "allTime": 284,
        "thisPeriod": 42,
        "trend": "+8",
        "trendPercent": 23
      },
      "verified": {
        "allTime": 268,
        "thisPeriod": 38,
        "rate": 92
      }
    },
    "engagement": {
      "score": 98.5,
      "rank": 1,
      "totalUsers": 145,
      "percentile": 99
    },
    "shares": {
      "total": 12,
      "byPlatform": {
        "slack": 5,
        "teams": 3,
        "linkedin": 2,
        "link": 2
      },
      "stats": {
        "views": 284,
        "clicks": 42,
        "reactions": 18
      }
    },
    "topRecognition": {
      "id": "rec_top123",
      "recipient": "Bob Smith",
      "reason": "Exceptional project leadership",
      "weight": 3.2,
      "shares": 8,
      "views": 156
    },
    "dailyStats": [
      {
        "date": "2025-10-18",
        "given": 2,
        "received": 3,
        "verified": 2
      },
      {
        "date": "2025-10-17",
        "given": 1,
        "received": 2,
        "verified": 2
      }
    ]
  }
}
```

**CSV Export**
```bash
curl -X GET "https://api.recognition.com/v1/api/analytics/export?userId=user_alice&format=csv" \
  -H "Authorization: Bearer <token>" \
  -o analytics.csv
```

---

## Error Handling

### Error Response Format
```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {
      "field": "fieldName",
      "reason": "Additional context"
    }
  },
  "meta": {
    "timestamp": "2025-10-18T12:00:00Z",
    "requestId": "req_abc123"
  }
}
```

### Common Error Codes

| Code | HTTP | Description | Action |
|------|------|-------------|--------|
| INVALID_PERMISSION | 403 | User lacks required permission | Check RBAC role |
| INVALID_TOKEN | 401 | Authentication token invalid | Refresh token |
| TOKEN_EXPIRED | 401 | Token has expired | Refresh token |
| NOT_FOUND | 404 | Resource not found | Verify ID |
| INVALID_PARAMETERS | 400 | Request parameters invalid | Check documentation |
| RATE_LIMIT_EXCEEDED | 429 | Rate limit hit | Wait and retry |
| INTERNAL_ERROR | 500 | Server error | Retry with exponential backoff |
| FEATURE_DISABLED | 503 | Feature temporarily disabled | Check status page |

### Retry Strategy
```javascript
async function retryRequest(fn, maxRetries = 3) {
  let lastError;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (error.status === 429) {
        // Rate limited: exponential backoff
        const delay = Math.pow(2, i) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      } else if (error.status >= 500) {
        // Server error: retry
        const delay = Math.pow(2, i) * 500;
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        // Client error: don't retry
        throw error;
      }
    }
  }
  
  throw lastError;
}
```

---

## Rate Limiting

### Limits by Endpoint

| Endpoint | Limit | Window |
|----------|-------|--------|
| POST /api/social-share | 10 | 24 hours |
| POST /api/track-share | 100 | 1 hour |
| GET /api/leaderboard | 60 | 1 minute |
| POST /api/engagement-score | 30 | 1 hour |
| GET /api/analytics | 20 | 1 hour |

### Rate Limit Headers
```
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 7
X-RateLimit-Reset: 1697625600
```

### Handling Rate Limits
```javascript
if (response.status === 429) {
  const resetTime = parseInt(response.headers['x-ratelimit-reset']);
  const waitTime = (resetTime * 1000) - Date.now();
  
  setTimeout(() => {
    // Retry request
  }, waitTime);
}
```

---

## SDK Examples

### JavaScript/TypeScript

#### Social Sharing
```typescript
import { useSocialShare } from '@recognition/hooks';

export function ShareButton({ recognitionId }) {
  const { shareToSlack, shareToTeams, copyLink } = useSocialShare();
  
  return (
    <div className="share-buttons">
      <button 
        onClick={() => shareToSlack(recognitionId)}
      >
        Share to Slack
      </button>
      <button 
        onClick={() => shareToTeams(recognitionId)}
      >
        Share to Teams
      </button>
      <button 
        onClick={() => copyLink(recognitionId)}
      >
        Copy Link
      </button>
    </div>
  );
}
```

#### Leaderboard
```typescript
import { useLeaderboard } from '@recognition/hooks';

export function LeaderboardView() {
  const { rankings, loading, error } = useLeaderboard({
    type: 'receivers',
    period: 'month',
    limit: 20
  });
  
  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  
  return (
    <table>
      <tbody>
        {rankings.map((user, index) => (
          <tr key={user.userId}>
            <td>{user.rank}</td>
            <td>{user.name}</td>
            <td>{user.engagementScore.toFixed(1)}</td>
            <td>{user.trend}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

#### Analytics
```typescript
import { useAnalytics } from '@recognition/hooks';

export function AnalyticsDashboard() {
  const { analytics, loading, export: exportData } = useAnalytics({
    period: 30
  });
  
  const handleExport = async () => {
    const csv = await exportData('csv');
    downloadFile(csv, 'analytics.csv');
  };
  
  if (loading) return <div>Loading...</div>;
  
  return (
    <div>
      <h1>Your Analytics</h1>
      <div>Given: {analytics.summary.given.thisPeriod}</div>
      <div>Received: {analytics.summary.received.thisPeriod}</div>
      <button onClick={handleExport}>Export CSV</button>
    </div>
  );
}
```

### REST API Direct Calls

#### Using Fetch
```javascript
async function getSocialShare(recognitionId) {
  const response = await fetch(
    'https://api.recognition.com/v1/api/social-share',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        recognitionId,
        platform: 'slack'
      })
    }
  );
  
  return response.json();
}
```

#### Using Axios
```javascript
import axios from 'axios';

const api = axios.create({
  baseURL: 'https://api.recognition.com/v1',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});

// Social Share
const shareResponse = await api.post('/api/social-share', {
  recognitionId: 'rec_123',
  platform: 'slack'
});

// Leaderboard
const leaderboard = await api.get('/api/leaderboard', {
  params: {
    type: 'receivers',
    period: 'month'
  }
});

// Analytics
const analytics = await api.get('/api/analytics', {
  params: {
    period: 30
  }
});
```

---

## Database Collections

### social_shares
```javascript
{
  id: "shr_abc123",
  token: "shr_abc123def456", // hashed
  recognitionId: "rec_123",
  platform: "SLACK",
  createdBy: "user_alice",
  createdAt: "2025-10-18T12:00:00Z",
  expiresAt: "2025-12-18T12:00:00Z",
  message: "Check this out!",
  includeProfile: true
}
```

### share_tracking
```javascript
{
  id: "track_xyz789",
  token: "shr_abc123", // foreign key
  action: "VIEW",
  viewerId: "hashed_user_id",
  viewerIp: "hashed_ip",
  timestamp: "2025-10-18T12:05:00Z",
  metadata: {
    reactionType: "thumbsup"
  }
}
```

### leaderboard_cache
```javascript
{
  id: "cache_abc123",
  period: "month",
  type: "receivers",
  rankings: [...], // cached rankings array
  generatedAt: "2025-10-18T12:00:00Z",
  expiresAt: "2025-10-18T12:05:00Z"
}
```

---

## Webhook Events

### Share Created
```json
{
  "event": "social.share.created",
  "timestamp": "2025-10-18T12:00:00Z",
  "data": {
    "shareId": "shr_abc123",
    "recognitionId": "rec_123",
    "platform": "SLACK"
  }
}
```

### Share Tracked
```json
{
  "event": "social.share.tracked",
  "timestamp": "2025-10-18T12:05:00Z",
  "data": {
    "shareId": "shr_abc123",
    "action": "VIEW",
    "totalViews": 24
  }
}
```

### Leaderboard Updated
```json
{
  "event": "leaderboard.updated",
  "timestamp": "2025-10-18T12:10:00Z",
  "data": {
    "period": "month",
    "type": "receivers",
    "topUser": "user_alice",
    "timestamp": "2025-10-18T12:10:00Z"
  }
}
```

---

## Support & Documentation

- **API Reference**: https://docs.recognition.com/api
- **SDK Documentation**: https://docs.recognition.com/sdk
- **Status Page**: https://status.recognition.com
- **Support Portal**: https://support.recognition.com
- **Discord Community**: https://discord.gg/recognition

---

**Document Version**: 1.0.0  
**Last Updated**: October 18, 2025  
**Next Review**: October 25, 2025
