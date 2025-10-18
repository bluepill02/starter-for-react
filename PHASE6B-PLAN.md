# Phase 6B: Viral Features - Detailed Implementation Plan

**Phase Goal**: Build social amplification features to drive adoption through peer engagement  
**Duration**: 20 hours  
**Status**: PLANNING  
**Date Started**: October 18, 2025

---

## 📊 Phase 6B Overview

| Feature | Hours | Deliverables | Priority |
|---------|-------|--------------|----------|
| Social Sharing API | 5h | share API, URL generation, link tracking | P0 |
| Leaderboard System | 8h | leaderboard page, ranking logic, stats | P0 |
| Real-time Notifications | 5h | notification service, UI toast system | P0 |
| Analytics Dashboard | 2h | engagement metrics, views, shares | P1 |
| **Total** | **20h** | **15+ files** | - |

---

## 🎯 Feature Breakdown

### Feature 6B.1: Social Sharing API (5 hours)

**Goal**: Enable sharing recognitions to Slack, Teams, LinkedIn, and via direct link

**Deliverables**:
1. **`/apps/api/functions/integrations/social-share/index.js`** (120 LOC)
   - POST /api/social-share
   - Params: `recognitionId`, `platform` (slack|teams|linkedin|link), `includeProfile`
   - Returns: `{ shareUrl, shareToken, expiresAt, platform, trackingId }`
   - Security: RBAC, token TTL validation
   - Audit: Create audit entry with platform and recipient count

2. **`/apps/api/functions/track-share/index.js`** (80 LOC)
   - POST /api/track-share
   - Params: `shareToken`, `action` (click|view|react)
   - Updates: track views/clicks per share
   - Returns: `{ tracked: true, currentCount }`
   - Purpose: Analytics on share effectiveness

3. **`/packages/schema/src/types.ts`** (updates)
   - Add `ShareEvent` type
   - Add `SocialShareAudit` type
   - Share tracking fields to Recognition schema

4. **UI Hook: `/apps/web/src/lib/useSocialShare.ts`** (95 LOC)
   - `useSocialShare(recognitionId)`
   - Methods: `shareToSlack()`, `shareToTeams()`, `shareToLinkedIn()`, `copyLink()`
   - Handles: Loading states, error handling, toast notifications
   - Returns: `{ loading, error, share, track }`

**API Design**:
```js
// POST /api/social-share
{
  recognitionId: "rec_123",
  platform: "slack|teams|linkedin|link",
  includeProfile: true,
  message: "Check out this recognition!" // optional
}
// Returns:
{
  shareUrl: "https://app.recognition.com/share/share_abc123?ref=slack",
  shareToken: "share_abc123",
  expiresAt: "2025-10-25T12:00:00Z",
  platform: "slack",
  trackingId: "track_xyz789",
  previewUrl: "https://..." // OG image for link preview
}
```

**Test Coverage**:
- Unit: Share token generation, URL formatting, audit logging (8 tests)
- E2E: Share to each platform, link copy, tracking (6 tests)
- Security: Token validation, RBAC enforcement, rate limiting (4 tests)

---

### Feature 6B.2: Leaderboard System (8 hours)

**Goal**: Gamify recognition by showing top givers/receivers with engagement metrics

**Deliverables**:

1. **`/apps/api/functions/leaderboard/index.js`** (150 LOC)
   - GET /api/leaderboard?type=givers|receivers&period=week|month|all
   - Returns top 20 with stats:
     ```js
     [{
       userId: "user_123",
       rank: 1,
       displayName: "Sarah",
       avatar: "...",
       givenCount: 47,     // if type=givers
       receivedCount: 15,
       engagementScore: 92, // weight * (verifications + shares + views)
       trend: "up"|"down"|"flat",
       streak: 7            // consecutive days with recognitions
     }, ...]
     ```
   - Caching: 5-minute Redis cache (update on new recognition)
   - Period logic: Week (last 7d), Month (last 30d), All-time

2. **`/apps/api/functions/engagement-score/index.js`** (85 LOC)
   - Utility function to compute engagement score
   - Formula: `base_weight * (1 + verifications_ratio + shares_count/10 + views_count/100)`
   - Params: `recognitionId`, `userId`, `timeWindow`
   - Returns: `{ score, breakdown: { weightComponent, verificationBonus, shareBonus, viewBonus } }`

3. **`/apps/web/src/pages/leaderboard.tsx`** (280 LOC)
   - Tabs: Givers | Receivers
   - Filters: Week | Month | All-time
   - Display: Rank card with stats, trend indicator, streak badge
   - Responsive: 3-col desktop → 2-col tablet → 1-col mobile
   - Dark mode: Full support with high contrast
   - Accessibility: ARIA labels, keyboard nav, focus traps

4. **`/apps/web/src/components/LeaderboardCard.tsx`** (120 LOC)
   - Displays single leaderboard entry
   - Shows: Rank, avatar, name, stats, trend, streak
   - Trend indicator: ↑ Green | → Gray | ↓ Red
   - Streak badge: "🔥 7 day streak"
   - Click to view user profile

5. **`/apps/web/src/components/LeaderboardFilter.tsx`** (75 LOC)
   - Period selector: Week | Month | All
   - Type selector: Givers | Receivers
   - Refetch on change with loading state
   - Accessibility: Radio group with proper ARIA

**Leaderboard Logic**:
```
Engagement Score = base_weight * (
  1 +
  (recognized_count / recognized_total) * 0.3 +
  (shares_count / 100) * 0.2 +
  (views_count / 1000) * 0.1
)
```

**Test Coverage**:
- Unit: Score calculation, ranking logic, period filtering (10 tests)
- E2E: Leaderboard page load, filter switching, user click (5 tests)
- Performance: Cache invalidation, large dataset (3 tests)

---

### Feature 6B.3: Real-time Notifications (5 hours)

**Goal**: Notify users of recognition events (received, verified, shared, viewed)

**Deliverables**:

1. **`/apps/api/functions/notify/index.js`** (140 LOC)
   - Triggers on recognition events (create, verify, share, view)
   - Types: `recognition_received`, `recognition_verified`, `recognition_shared`, `recognition_viewed`
   - Payload:
     ```js
     {
       type: "recognition_received",
       userId: "user_456",
       initiatorId: "user_123",
       initiatorName: "Alice",
       recognitionId: "rec_789",
       excerpt: "Great work on...", // truncated to 100 chars
       timestamp: "2025-10-18T10:30:00Z",
       actionUrl: "/recognition/rec_789"
     }
     ```
   - Storage: Save to Notifications collection
   - Delivery: Push WebSocket event to connected user
   - Rate limiting: Max 20 notifications/hour per user

2. **`/apps/web/src/lib/useNotifications.ts`** (110 LOC)
   - Hook for WebSocket connection
   - Methods: `subscribe()`, `unsubscribe()`, `markAsRead()`
   - State: `{ notifications, unreadCount, isConnected }`
   - Auto-reconnect on disconnect
   - Local caching of last 50 notifications

3. **`/apps/web/src/components/NotificationToast.tsx`** (95 LOC)
   - Toast component for real-time notifications
   - Auto-dismiss after 5 seconds
   - Actions: View button, dismiss
   - Icon by type: ✓ (verified), 📤 (shared), 👁️ (viewed)
   - Dark mode + reduced motion support
   - Position: Top-right, stacks vertically

4. **`/apps/web/src/components/NotificationCenter.tsx`** (150 LOC)
   - Dropdown notification panel
   - Shows: Recent 10 notifications with timestamps
   - Actions: Mark all as read, clear all
   - Filter: All | Unread
   - Unread badge on bell icon
   - Keyboard accessible: Tab, Enter, Escape

5. **`/apps/web/src/components/NotificationBell.tsx`** (80 LOC)
   - Bell icon in top navigation
   - Shows unread count badge
   - Opens NotificationCenter on click
   - Animated when new notification arrives
   - Focus management for dropdown

**WebSocket Event Schema**:
```js
{
  type: "notification:new",
  data: {
    id: "notif_123",
    userId: "user_456",
    type: "recognition_received",
    initiator: { id: "user_123", name: "Alice", avatar: "..." },
    recognition: { id: "rec_789", excerpt: "..." },
    timestamp: "2025-10-18T10:30:00Z",
    read: false
  }
}
```

**Test Coverage**:
- Unit: Notification creation, WebSocket handling, state management (8 tests)
- E2E: Toast display, notification center, mark as read (5 tests)
- Real-time: WebSocket connection, event delivery, reconnection (4 tests)

---

### Feature 6B.4: Analytics Dashboard (2 hours)

**Goal**: Show engagement metrics for users and admins

**Deliverables**:

1. **`/apps/web/src/pages/analytics.tsx`** (180 LOC)
   - Personal stats: Recognitions given/received, shares, views
   - Time series charts: Last 30 days
   - Top metrics: Most shared, most viewed
   - Export: Download CSV report
   - Dark mode + responsive design

2. **`/apps/api/functions/analytics/index.js`** (95 LOC)
   - GET /api/analytics?userId=...&period=30
   - Returns: Aggregated stats for user
   - Caching: 15-minute TTL
   - Fields: given_count, received_count, shares, views, engagement_score

**Dashboard Metrics**:
- Given: Total recognitions given + trend
- Received: Total recognitions received + trend
- Shares: Total times recognition was shared + breakdown by platform
- Views: Total recognition views (from tracking)
- Engagement Score: Calculated from all metrics
- 30-day chart: Daily values for each metric

**Test Coverage**:
- Unit: Analytics calculation, aggregation (4 tests)
- E2E: Dashboard load, export, chart display (3 tests)

---

## 📁 File Structure

```
/apps/web/src/
  components/
    LeaderboardCard.tsx          (120 LOC) ✨ NEW
    LeaderboardFilter.tsx        (75 LOC)  ✨ NEW
    NotificationToast.tsx        (95 LOC)  ✨ NEW
    NotificationCenter.tsx       (150 LOC) ✨ NEW
    NotificationBell.tsx         (80 LOC)  ✨ NEW
  pages/
    leaderboard.tsx             (280 LOC) ✨ NEW
    analytics.tsx               (180 LOC) ✨ NEW
    [userId].tsx                (UPDATE - add share button)
    feed.tsx                    (UPDATE - add share buttons)
  lib/
    useSocialShare.ts           (95 LOC)  ✨ NEW
    useNotifications.ts         (110 LOC) ✨ NEW

/apps/api/functions/
  integrations/
    social-share/
      index.js                  (120 LOC) ✨ NEW
  track-share/
    index.js                    (80 LOC)  ✨ NEW
  leaderboard/
    index.js                    (150 LOC) ✨ NEW
  engagement-score/
    index.js                    (85 LOC)  ✨ NEW
  notify/
    index.js                    (140 LOC) ✨ NEW
  analytics/
    index.js                    (95 LOC)  ✨ NEW

/packages/schema/src/
  types.ts                      (UPDATE - add ShareEvent, SocialShareAudit)

/packages/tests/
  phase6b.test.jsx              (500+ LOC) ✨ NEW
  phase6b.spec.js               (350+ LOC) ✨ NEW

/i18n/
  en-phase-6b.json              (80+ keys) ✨ NEW
  ta-phase-6b.json              (80+ keys) ✨ NEW
```

---

## 🎨 UI/UX Specifications

### Social Share Button (all pages)
```
[Share] ▼
  ├─ Slack
  ├─ Teams  
  ├─ LinkedIn
  ├─ Copy Link
  └─ View Stats
```

### Leaderboard Page
```
┌─────────────────────────────────────┐
│ 🏆 LEADERBOARD                      │
├─────────────────────────────────────┤
│ [Givers] [Receivers]                │
│ [Week] [Month] [All-time]           │
├─────────────────────────────────────┤
│ 1. 👤 Sarah    47 given  ↑ 🔥 7 day │
│ 2. 👤 Marcus   42 given  → 🔥 3 day │
│ 3. 👤 Priya    38 given  ↓          │
│    ...                               │
└─────────────────────────────────────┘
```

### Notification Center
```
┌──────────────────┐
│ 🔔 (5)           │
│  ────────────────│
│ ✓ Sarah verified │
│   your recognition
│   2 min ago      │
│                  │
│ 📤 Shared to     │
│   Slack (3 views)│
│   5 min ago      │
│                  │
│ [Mark all read] ◄─── UPDATE ALL
│ [Clear all]
└──────────────────┘
```

### Analytics Page
```
┌─────────────────────────────────────┐
│ 📊 YOUR ANALYTICS                   │
├─────────────────────────────────────┤
│ [📤 Given: 15]  [📥 Received: 8]   │
│ [👁️ Views: 342]  [📊 Score: 87]    │
├─────────────────────────────────────┤
│ Last 30 Days (LINE CHART)           │
│        ╱╲     ╱╲                    │
│       ╱  ╲   ╱  ╲                   │
│      ╱    ╲_╱    ╲                  │
├─────────────────────────────────────┤
│ Top Recognition                     │
│ "Great work on..." → 127 views      │
│                                     │
│ [Export CSV]                        │
└─────────────────────────────────────┘
```

---

## 🔒 Security & Rate Limiting

**Social Share**:
- Rate limit: 50 shares/hour per user
- Token TTL: 90 days (shareable links expire)
- RBAC: Only recognition owner can create shares
- Token validation: HMAC-SHA256 with secret key

**Notifications**:
- Rate limit: 20 notifications/hour per user
- WebSocket auth: Validate user session on connect
- Cleanup: Auto-delete notifications after 30 days
- Privacy: Never include PII in notifications (use hashed IDs)

**Leaderboard**:
- Cache: 5-minute Redis TTL
- Privacy: Only show public recognitions (not PRIVATE)
- Filter: Hide users with privacy settings

---

## 📋 Implementation Sequence

### Day 1 (8 hours)
- [ ] 6B.1.1: Create social-share API function
- [ ] 6B.1.2: Create track-share API function
- [ ] 6B.1.3: Create useSocialShare hook
- [ ] 6B.2.1: Create leaderboard API function
- [ ] 6B.2.2: Create engagement-score utility

### Day 2 (6 hours)
- [ ] 6B.2.3: Create leaderboard.tsx page
- [ ] 6B.2.4: Create LeaderboardCard component
- [ ] 6B.2.5: Create LeaderboardFilter component
- [ ] 6B.3.1: Create notify API function

### Day 3 (4 hours)
- [ ] 6B.3.2: Create useNotifications hook
- [ ] 6B.3.3: Create NotificationToast component
- [ ] 6B.3.4: Create NotificationCenter component
- [ ] 6B.3.5: Create NotificationBell component

### Day 4 (2 hours)
- [ ] 6B.4.1: Create analytics.tsx page
- [ ] 6B.4.2: Create analytics API function
- [ ] Testing & i18n integration
- [ ] Documentation

---

## ✅ Success Criteria

- [ ] All 6 API functions production-ready (tested, error handling, audit logging)
- [ ] All 5 components WCAG 2.1 AA compliant
- [ ] Full test coverage: 50+ unit tests, 8+ E2E scenarios
- [ ] i18n complete: 80+ keys for English + Tamil
- [ ] Share tracking working (can see share stats)
- [ ] Leaderboard updates in real-time
- [ ] Notifications deliver within 1 second
- [ ] Dark mode on all new features
- [ ] Mobile responsive (3 breakpoints)
- [ ] Performance: Leaderboard <200ms load time, Notifications <100ms WebSocket latency

---

## 📚 Documentation Deliverables

1. **PHASE6B-COMPLETE.md** - Completion report with metrics
2. **PHASE6B-DEPLOYMENT-GUIDE.md** - Deployment procedures
3. **PHASE6B-IMPLEMENTATION-INDEX.md** - Feature reference
4. **PHASE6B-QUICK-REFERENCE.sh** - Command reference

---

## 🎯 Ready to Start?

**Next Action**: Begin with Feature 6B.1 (Social Sharing API)

Estimated breakdown:
- Social Share API: 5 hours
- Leaderboard: 8 hours
- Notifications: 5 hours
- Analytics + Testing: 2 hours
- **Total: 20 hours**

All components will follow Phase 6A patterns:
- ✅ WCAG 2.1 AA accessibility
- ✅ Dark mode support
- ✅ Responsive design
- ✅ Comprehensive tests
- ✅ Full i18n

**Status**: Ready to implement → Proceed to 6B.1? (Y/N)
