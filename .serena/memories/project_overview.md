# Recognition App - Project Overview

## Purpose
Recognition app built on Appwrite React starter template for evidence-first workplace recognition with:
- Private-first UX (default PRIVATE visibility)
- Tamil-first localization (automatic Tamil detection + i18n system)
- Anti-abuse fairness (rate limits, reciprocity detection, weight adjustments)
- Manager verification workflow
- HR-grade exports (PDF, CSV with anonymization)
- Integrations (Slack, Teams)
- Comprehensive auditability
- Enterprise security (SSO with Google/Microsoft)

## Tech Stack
- **Frontend**: React 19 + TypeScript + Tailwind CSS 4 + Next.js app router
- **Backend**: Appwrite Functions (Node.js + TypeScript)
- **Database**: Appwrite Database
- **Storage**: Appwrite Storage (for evidence files)
- **Auth**: OAuth 2.0 (Google, Microsoft) + Email/password
- **Validation**: Zod (runtime validation)
- **Internationalization**: Custom useI18n hook with automatic Tamil detection
- **Testing**: Jest + Playwright
- **Package Manager**: npm
- **DevOps**: Docker (Appwrite emulator), bash scripts

## Core Features Implemented
1. ✅ Recognition Modal (one-click flow, evidence upload, evidence-weighted)
2. ✅ Feed (infinite scroll, filters)
3. ✅ Profile Timeline (analytics, export)
4. ✅ Abuse Detection (reciprocity, frequency, weight manipulation)
5. ✅ Rate Limiting (10/day, 50/week, 100/month)
6. ✅ Audit Logging (event-based, hashed IDs for privacy)
7. ✅ i18n (100+ English + Tamil keys, auto-detection)
8. ✅ SSO (Google, Microsoft OAuth)
9. ✅ Manager Verification (required for high-value)
10. ✅ HR Exports (PDF + CSV with anonymization)

## Repository Structure
```
/apps/web/                    # React frontend
  /src/appwrite/             # Appwrite client wrapper
  /src/lib/                  # Hooks (auth, i18n, evidenceUpload)
  /src/components/           # React components
  /src/pages/                # Next.js routes
  /src/pages/auth/          # Auth pages (sign-in, callback)
  /src/pages/admin/         # Admin pages (abuse dashboard)
  /src/pages/profile/       # Profile pages
  
/apps/api/                    # Appwrite Functions
  /functions/create-recognition/     # Recognition creation + rate limits + audit
  /functions/verify-recognition/     # Manager verification
  /functions/export-profile/         # HR exports
  /functions/services/abuse.ts       # Abuse detection algorithms
  /functions/integrations/           # Slack, Teams, webhook
  /functions/rbac-middleware/        # Role-based access control
  /functions/scim-sync/             # SCIM user sync

/packages/schema/src/types.ts  # Zod schemas (User, Recognition, Audit, etc.)
/packages/tests/               # Jest + Playwright tests
/i18n/                         # Translations (en.json, ta.json)
```

## Key Files
- **Auth**: `/apps/web/src/lib/auth.tsx` - OAuth + Email + RBAC
- **i18n**: `/apps/web/src/lib/i18n.ts` - Automatic Tamil detection
- **Rate Limits**: `/apps/api/functions/create-recognition/index.ts` - Already implemented
- **Audit**: `/apps/api/functions/create-recognition/index.ts` - Already implemented
- **Schemas**: `/packages/schema/src/types.ts` - Zod validation

## Existing Rate Limits
```typescript
RECOGNITION_LIMITS = {
  dailyLimit: 10,
  weeklyLimit: 50,
  monthlyLimit: 100,
  minReasonLength: 20,
  maxTags: 3,
  evidenceWeightBonus: 0.5
}
```

## Existing Audit Events
Event codes: RECOGNITION_CREATED, RECOGNITION_VERIFIED, RECOGNITION_EXPORTED, RECOGNITION_BLOCKED, RECOGNITION_ERROR, EVIDENCE_UPLOADED, EVIDENCE_PREVIEWED, ADMIN_ACTION, ADMIN_OVERRIDE, ABUSE_FLAGGED, ABUSE_REVIEWED, ABUSE_DISMISSED, USER_SYNCED, INTEGRATION_CALLED, TELEMETRY_EVENT

## Next Tasks
1. Implement dedicated rate limiter service (Redis-like persistence)
2. Add auth rate limiting (sign-in attempts)
3. Create rate limit monitoring dashboard
4. Implement comprehensive audit logging service
5. Add audit log querying/filtering
6. Create audit log monitoring dashboard
