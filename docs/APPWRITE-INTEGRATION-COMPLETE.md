# Complete Appwrite Integration Checklist

## ✅ Google & Microsoft OAuth Setup (Already Completed)

Your OAuth providers have been configured in Appwrite with credentials. Now we need to complete the full integration.

---

## 📋 Step-by-Step Integration Guide

### Phase 1: Database & Collections Setup

#### 1.1 Run Collection Setup Script

```bash
# Set environment variables
$env:APPWRITE_ENDPOINT="https://syd.cloud.appwrite.io/v1"
$env:APPWRITE_PROJECT_ID="your-project-id"
$env:APPWRITE_KEY="your-api-key"

# Run setup script
node scripts/setup-appwrite-collections.js
```

**What this does:**
- ✅ Creates `recognition-db` database
- ✅ Creates 7 collections:
  - `recognitions` - Recognition records
  - `users` - User profiles with roles
  - `teams` - Team data
  - `abuse-flags` - Flagged recognitions
  - `audit-entries` - Audit logs for compliance
  - `telemetry-events` - Analytics events
  - `rate-limit-breaches` - Rate limit monitoring
- ✅ Creates `evidence` storage bucket (50MB max)

#### 1.2 Verify Collections in Appwrite Console

Go to Appwrite Console → Your Project → Databases → `recognition-db`

Check that all 7 collections exist with proper indexes on:
- `eventCode`, `actorId`, `createdAt` (audit-entries)
- `limitType`, `limitKey` (rate-limit-breaches)
- `giverId`, `recipientEmail`, `createdAt` (recognitions)

### Phase 2: Configure Environment Variables

#### 2.1 Frontend Environment (apps/web/.env.production)

```bash
# Copy template and fill in your credentials
cp apps/web/.env.production.example apps/web/.env.production.local
```

**apps/web/.env.production** should contain:

```env
# Appwrite Configuration
VITE_APPWRITE_ENDPOINT=https://syd.cloud.appwrite.io/v1
VITE_APPWRITE_PROJECT_ID=your-project-id-from-console

# Optional: Feature flags
VITE_FEATURE_AUDIT_LOGGING=true
VITE_FEATURE_RATE_LIMITING=true
VITE_FEATURE_ABUSE_DETECTION=true
```

#### 2.2 Backend Environment (apps/api/.env.production)

```bash
cp apps/api/.env.development.example apps/api/.env.production
```

**apps/api/.env.production** should contain:

```env
# Appwrite Server Configuration
APPWRITE_ENDPOINT=https://syd.cloud.appwrite.io/v1
APPWRITE_PROJECT_ID=your-project-id-from-console
APPWRITE_API_KEY=your-api-key-from-console

# Database Configuration
DATABASE_ID=recognition-db
RECOGNITION_COLLECTION_ID=recognitions
USER_COLLECTION_ID=users
ABUSE_FLAGS_COLLECTION_ID=abuse-flags
AUDIT_COLLECTION_ID=audit-entries
TELEMETRY_COLLECTION_ID=telemetry-events
RATE_LIMIT_BREACHES_COLLECTION_ID=rate-limit-breaches
STORAGE_BUCKET_ID=evidence

# Security
JWT_SECRET=your-production-jwt-secret-min-32-chars
ENCRYPTION_KEY=your-production-encryption-key-32-chars
```

### Phase 3: Deploy Appwrite Functions

#### 3.1 Build Functions

```bash
# Build all API functions
npm run build:api

# Or build individual functions
cd apps/api
npm run build
```

#### 3.2 Deploy to Appwrite

Functions deploy via:
1. **Appwrite CLI** (recommended)
2. **Git integration** (via Appwrite console)
3. **Manual deployment** (zip upload)

**Using Appwrite CLI:**

```bash
# Install Appwrite CLI (if not already)
npm install -g appwrite-cli

# Login to Appwrite
appwrite login

# Deploy functions
appwrite deploy function
```

#### 3.3 Verify Functions Deployed

Check Appwrite Console → Your Project → Functions

Verify these functions exist:
- ✅ `create-recognition` - Create recognition with rate limiting
- ✅ `verify-recognition` - Manager verification
- ✅ `export-profile` - HR exports
- ✅ `health-check` - System health
- ✅ `admin/abuse-report` - Admin abuse management
- ✅ `admin/rate-limit-report` - Rate limit monitoring
- ✅ `admin/audit-logs` - Audit log queries
- ✅ `integrations/slack` - Slack integration
- ✅ `integrations/teams` - Teams integration

### Phase 4: Configure Function Permissions

#### 4.1 Set Function Execute Permissions

In Appwrite Console → Functions → Each Function → Settings:

```
For public functions (sign-in, register):
- Role: Any
- Execute: Allowed

For user functions (create-recognition):
- Role: Authenticated users
- Execute: Allowed

For admin functions (abuse-report, audit-logs):
- Role: Admin users
- Execute: Allowed
```

#### 4.2 Set Database Permissions

In Appwrite Console → Databases → recognition-db → Collections:

```
For each collection:
- Users: Read (for recognitions they own)
- Managers: Read/Update (for verification)
- Admins: Read/Write/Delete (full access)
```

### Phase 5: Test OAuth Integration

#### 5.1 Local Testing

```bash
# Start emulator
npm run dev:emulator

# In another terminal, start dev server
npm run dev

# Navigate to http://localhost:3000
# Click "Sign in with Google" or "Sign in with Microsoft"
# You should be redirected to OAuth provider
# After auth, you should be redirected back to /feed
```

#### 5.2 Verify OAuth Flow

Check browser DevTools → Network → For these requests:
1. `POST /createOAuth2Session` - Initiates OAuth
2. `GET /auth/callback?...` - OAuth provider redirects here
3. `GET /session/current` - Load user session

✅ If all succeed, OAuth is working!

#### 5.3 Test Rate Limiting

```bash
# Create 11 recognitions (limit is 10/day)
for i in {1..11}; do
  curl -X POST http://localhost:3001/v1/functions/create-recognition \
    -H "x-appwrite-key: $env:APPWRITE_KEY" \
    -d @- <<EOF
{
  "recipientEmail": "user@example.com",
  "reason": "Great job on the project! You demonstrated excellent teamwork and leadership throughout the process.",
  "tags": ["teamwork", "leadership"],
  "evidenceIds": [],
  "giverUserId": "user_123"
}
EOF
  echo "Request $i"
  Start-Sleep -Milliseconds 500
done
```

Expected result:
- Requests 1-10: `200 OK` with recognition created
- Request 11: `429 Too Many Requests` with error message

#### 5.4 Verify Audit Logging

```bash
# Query audit logs
curl -X POST http://localhost:3001/v1/functions/admin/audit-logs \
  -H "x-appwrite-key: $env:APPWRITE_KEY" \
  -d '{
    "eventCode": "RECOGNITION_CREATED",
    "limit": 10
  }'
```

Expected: Returns list of recognition creation audit entries

### Phase 6: Production Deployment

#### 6.1 Pre-deployment Checklist

- ✅ All environment variables configured
- ✅ Collections and indexes created
- ✅ Functions deployed and tested locally
- ✅ OAuth providers configured in Appwrite
- ✅ Database permissions set correctly
- ✅ Rate limiting verified working
- ✅ Audit logging verified working
- ✅ TLS/HTTPS enabled on production domain
- ✅ Backup strategy in place
- ✅ Monitoring and alerting configured

#### 6.2 Deploy Frontend

```bash
# Build production frontend
npm run build:web

# Deploy to hosting (Vercel, Netlify, AWS, etc.)
# Set environment variable in hosting provider:
VITE_APPWRITE_ENDPOINT=https://syd.cloud.appwrite.io/v1
VITE_APPWRITE_PROJECT_ID=your-project-id
```

#### 6.3 Deploy Backend

```bash
# Update functions with production database IDs
# Deploy functions to Appwrite
npm run build:api
appwrite deploy function

# Or use Git integration if configured
```

#### 6.4 Production Testing

```bash
# Test OAuth with production domain
https://yourdomain.com/sign-in

# Test API endpoints
https://yourdomain.com/api/create-recognition

# Monitor audit logs
https://yourdomain.com/admin/audit-logs
```

### Phase 7: Monitoring & Operations

#### 7.1 Set Up Monitoring

Create a monitoring dashboard for:

**Key Metrics to Track:**
- OAuth sign-in success rate
- Rate limit breaches (track spikes)
- Audit log events volume
- Error rates by endpoint
- Database query performance
- Storage usage

#### 7.2 Set Up Alerts

Configure alerts for:
- High rate limit breach rate (> 100/hour)
- Rapid auth failures from same IP (> 10 in 5 min)
- Admin function errors (CRITICAL)
- Database connection failures
- Storage quota approaching limits

#### 7.3 Regular Maintenance

**Daily:**
- Check error logs for exceptions
- Monitor rate limit breaches
- Verify auth success rates

**Weekly:**
- Review audit logs for suspicious patterns
- Check database performance metrics
- Verify backups completed successfully

**Monthly:**
- Review security audit trail
- Update Appwrite SDK versions
- Test disaster recovery procedures
- Review and optimize database queries
- Rotate API keys and secrets

### Phase 8: Troubleshooting

#### OAuth Issues

**Problem:** OAuth redirect loops
```
Solution:
1. Verify OAUTH_SUCCESS_URL matches Appwrite configuration
2. Check Google/Microsoft OAuth callback URLs
3. Verify domain in .env variables
```

**Problem:** "Invalid session" after OAuth
```
Solution:
1. Check /auth/callback page loads correctly
2. Verify user is created in users collection
3. Check browser cookies are set
```

#### Rate Limiting Issues

**Problem:** Rate limits not working
```
Solution:
1. Verify rate limiter service is imported correctly
2. Check rate limit key format is consistent
3. Verify in-memory store isn't cleared between requests
```

**Problem:** Rate limit headers missing
```
Solution:
1. Verify middleware is setting response headers
2. Check function returns all headers
3. Verify client can read X-RateLimit-* headers
```

#### Audit Logging Issues

**Problem:** Audit logs not appearing
```
Solution:
1. Verify audit-entries collection exists
2. Check createAuditLog calls are not throwing
3. Verify database permissions allow writes
4. Check API key has database write permission
```

**Problem:** Performance degradation
```
Solution:
1. Check audit-entries collection size
2. Archive old audit logs (> 90 days)
3. Add database indexes
4. Check database connection pool settings
```

---

## 🔧 Command Reference

```bash
# Setup
node scripts/setup-appwrite-collections.js

# Development
npm run dev:emulator      # Start Appwrite emulator
npm run dev:api          # Start API functions
npm run dev:web          # Start React dev server
npm run dev:seed         # Seed test data

# Testing
npm test                 # Run unit tests
npm test:e2e            # Run E2E tests with Playwright
npm test:smoke          # Run smoke tests

# Building
npm run build:web       # Build React app
npm run build:api       # Build API functions
npm run build           # Build all

# Deployment
npm run type-check      # TypeScript check
npm run lint            # ESLint check
npm run format          # Prettier format
```

---

## 📚 Documentation

- Rate Limiting Guide: `/docs/rate-limiting-and-audit-logging.md`
- Integration Guide: `/docs/rate-limiting-audit-integration.md`
- SSO Configuration: `/docs/sso-configuration.md`
- i18n Documentation: `/docs/i18n-implementation-summary.md`

---

## ✨ Next Steps After Integration

1. **User Onboarding**
   - Create user guide with screenshots
   - Setup help documentation
   - Configure support channels

2. **Data Migration** (if migrating from legacy system)
   - Export existing recognitions
   - Map to new schema
   - Run validation checks
   - Gradual rollout

3. **Custom Integrations**
   - Configure Slack workspace app
   - Setup Teams bot
   - Configure webhooks

4. **Security Hardening**
   - Enable audit log archival
   - Setup SIEM integration
   - Configure firewall rules
   - Enable API rate limiting at CDN level

5. **Performance Tuning**
   - Monitor database query performance
   - Add query indexes if needed
   - Configure caching
   - Load test before peak usage

---

**Status**: Ready for Production Integration
**Last Updated**: October 18, 2025
**Support**: Refer to inline documentation in code comments and docs folder
