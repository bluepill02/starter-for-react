# SSO Implementation & Testing Guide

## 📋 Quick Reference

**OAuth Providers Configured:**
- ✅ Google OAuth 2.0
- ✅ Microsoft OAuth 2.0

**Auth Components:**
- `/apps/web/src/lib/auth.tsx` - Core auth logic
- `/apps/web/src/pages/sign-in.tsx` - Sign-in UI with OAuth buttons
- `/apps/web/src/pages/auth/callback.tsx` - OAuth callback handler

**Configuration Files:**
- `/apps/web/.env.development.example` - Development env template
- `/apps/web/.env.production.example` - Production env template
- `/docs/sso-configuration.md` - Detailed SSO setup guide

---

## 🚀 Quick Setup (Development)

### 1. Get OAuth Credentials

**Google:**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create project → Enable Google+ API
3. Create OAuth 2.0 Web Application credentials
4. Add redirect URI: `http://localhost:3000/auth/callback`
5. Copy Client ID

**Microsoft:**
1. Go to [Azure Portal](https://portal.azure.com/)
2. Register new application
3. Add redirect URI: `http://localhost:3000/auth/callback`
4. Create client secret
5. Copy Application (Client) ID

### 2. Configure Appwrite OAuth

In Appwrite Console (`http://localhost:8080`):
1. Go to **Settings** → **OAuth2 Providers**
2. **Google:**
   - Client ID: `<your-google-client-id>`
   - Client Secret: `<your-google-client-secret>`
3. **Microsoft:**
   - Client ID: `<your-microsoft-client-id>`
   - Client Secret: `<your-microsoft-client-secret>`
   - Tenant: `common`

### 3. Set Environment Variables

Create `/apps/web/.env.development.local`:

```bash
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-google-client-id
NEXT_PUBLIC_MICROSOFT_CLIENT_ID=your-microsoft-client-id
NEXT_PUBLIC_OAUTH_REDIRECT_URI=http://localhost:3000/auth/callback
```

### 4. Start Development Environment

```bash
# Terminal 1: Appwrite Emulator
npm run dev:emulator

# Terminal 2: Dev Server
npm run dev

# Terminal 3: API Functions (optional)
npm run api:dev
```

### 5. Test OAuth Sign-In

1. Navigate to `http://localhost:3000/sign-in`
2. Click **"Sign in with Google"** or **"Sign in with Microsoft"**
3. Complete OAuth flow
4. Should redirect to `/feed` after successful sign-in

---

## 🧪 Testing Procedures

### Test 1: Google OAuth Sign-In (Development)

**Setup:**
- [ ] Add test email to Google OAuth consent screen
- [ ] Verify redirect URI configured in Google Console

**Steps:**
1. Go to `http://localhost:3000/sign-in`
2. Click "Sign in with Google"
3. Sign in with test account
4. Grant permissions when prompted
5. Should redirect to `/feed`
6. Verify session cookie exists (DevTools → Application → Cookies)
7. Reload page - should stay logged in

**Expected Result:**
- ✅ User logged in with email and name populated
- ✅ Session persists across page reloads
- ✅ Redirect URL cleans up properly

### Test 2: Microsoft OAuth Sign-In (Development)

**Setup:**
- [ ] Add test account in Azure AD
- [ ] Verify redirect URI configured in Azure

**Steps:**
1. Go to `http://localhost:3000/sign-in`
2. Click "Sign in with Microsoft"
3. Sign in with Microsoft account
4. Grant permissions when prompted
5. Should redirect to `/feed`
6. Verify user info populated correctly

**Expected Result:**
- ✅ User logged in with Microsoft email
- ✅ User role properly detected
- ✅ Session established

### Test 3: Email/Password Sign-In

**Steps:**
1. Go to `http://localhost:3000/sign-in`
2. Click "Sign up" to create account
3. Enter name, email, password
4. Click "Create Account"
5. Should sign in and redirect to `/feed`

**Expected Result:**
- ✅ New user created
- ✅ Logged in immediately after sign-up
- ✅ User preferences stored

### Test 4: Sign-Out & Re-Sign-In

**Steps:**
1. After signing in, navigate to profile/settings
2. Click "Sign Out"
3. Verify redirected to `/sign-in`
4. Sign in again with OAuth
5. Should successfully sign in

**Expected Result:**
- ✅ Session cleared
- ✅ Can sign in again without errors
- ✅ New session created

### Test 5: Callback Handler Error Cases

**Test Case: Missing OAuth Parameters**
1. Manually navigate to `http://localhost:3000/auth/callback`
2. Should show error message
3. Button to "Try Again" should redirect to sign-in

**Test Case: OAuth Provider Error**
1. In browser DevTools, simulate provider rejection
2. Should catch error and display on callback page
3. Option to retry provided

---

## 🔍 Debugging

### Check Session Status

```typescript
import { useAuth } from '@/lib/auth';

function DebugAuth() {
  const { currentUser, session, loading } = useAuth();
  
  console.log('Current User:', currentUser);
  console.log('Session:', session);
  console.log('Loading:', loading);
}
```

### Browser DevTools Checks

**Cookies:**
1. Open DevTools → Application → Cookies
2. Look for `a_session_*` cookie (Appwrite session)
3. Should have domain `localhost` and HTTPOnly flag

**Local Storage:**
1. Check for `a_.*` keys (Appwrite SDK data)
2. Check for `preferred-locale` (i18n preference)

**Network Requests:**
1. Filter for OAuth provider calls
2. Check `POST` to `account.createOAuth2Session()`
3. Should see redirect to OAuth provider
4. Callback should have `userId` and `secret` parameters

### Common Issues

**Issue: OAuth redirect fails**
```
Solution:
- Check redirect URI matches exactly in provider settings
- Verify localhost:3000 is accessible
- Check browser allows cookies
- Clear browser cache and cookies
```

**Issue: "Session not established"**
```
Solution:
- Verify Appwrite OAuth provider credentials
- Check console for errors in auth.tsx
- Ensure callback page completes loading
- Try manual sign-in with email/password
```

**Issue: "Access denied" after OAuth redirect**
```
Solution:
- For Google: Add account to test users or publish app
- For Microsoft: Check permissions in Azure AD
- Verify requested scopes are approved
```

---

## 🏪 Production Deployment

### Pre-Deployment Checklist

- [ ] Google OAuth credentials created (production project)
- [ ] Microsoft OAuth credentials created (production tenant)
- [ ] HTTPS redirect URIs configured
- [ ] Appwrite OAuth providers configured with production credentials
- [ ] `.env.production` file created with credentials
- [ ] SSL/TLS certificate valid for production domain
- [ ] CORS settings updated in Appwrite
- [ ] Session timeout configured appropriately
- [ ] Error handling for auth failures in place
- [ ] Logging configured for auth events
- [ ] Rate limiting enabled for auth endpoints

### Production Environment Setup

```bash
# Set production environment variables
NEXT_PUBLIC_GOOGLE_CLIENT_ID=prod-google-client-id
NEXT_PUBLIC_MICROSOFT_CLIENT_ID=prod-microsoft-client-id
NEXT_PUBLIC_OAUTH_REDIRECT_URI=https://yourdomain.com/auth/callback

# Deploy
npm run build
npm start
```

### Production Testing

1. Test OAuth with production credentials
2. Verify redirect URLs are HTTPS
3. Test on mobile devices
4. Test with different email providers
5. Verify error pages are user-friendly
6. Check performance metrics
7. Monitor auth logs for issues

---

## 📊 Monitoring & Audit

### Enable Audit Logging

In `/apps/api/functions/create-session/index.ts`, log auth events:

```typescript
async function auditLog(userId: string, event: string, details: any) {
  const databases = new Databases(client);
  
  await databases.createDocument(
    process.env.DATABASE_ID,
    process.env.AUDIT_COLLECTION_ID,
    ID.unique(),
    {
      userId,
      event,
      details,
      timestamp: new Date().toISOString(),
      ipAddress: request.headers['x-forwarded-for'] || 'unknown'
    }
  );
}

// Log OAuth success
await auditLog(userId, 'oauth_signin_success', { provider });

// Log OAuth failure
await auditLog(userId, 'oauth_signin_failed', { provider, error });
```

### Key Metrics to Monitor

- Total OAuth sign-ins by provider
- OAuth sign-in success rate
- Average time to complete OAuth flow
- Failed sign-in attempts
- Geographic distribution of sign-ins
- Device/browser distribution

---

## 🔐 Security Checklist

### Frontend Security
- ✅ Never store secrets in frontend code
- ✅ Use environment variables for Client IDs only
- ✅ Validate all user inputs
- ✅ Implement CSRF protection
- ✅ Use secure cookies (HTTPOnly, Secure, SameSite)

### Backend Security
- ✅ Store OAuth secrets in secure vault
- ✅ Validate OAuth tokens before accepting
- ✅ Implement rate limiting on auth endpoints
- ✅ Log all authentication attempts
- ✅ Rotate OAuth credentials regularly (every 3-6 months)

### Appwrite Security
- ✅ Restrict OAuth to allowed domains
- ✅ Enable session timeout (15-30 minutes recommended)
- ✅ Use strong API keys for server functions
- ✅ Monitor for unusual authentication patterns

---

## 📞 Support & Troubleshooting

**Common Questions:**

Q: How long do sessions last?
A: Default is 24 hours. Configure in Appwrite settings.

Q: Can users sign in with multiple OAuth providers?
A: Yes, if they use the same email address.

Q: How do I force sign-out of all devices?
A: Call `signOut()` then `logout_all_sessions()` in Appwrite.

Q: What if user is in multiple organizations?
A: Handle in user preferences/roles after OAuth success.

**Getting Help:**
1. Check `/docs/sso-configuration.md` for detailed setup
2. Review console logs in browser DevTools
3. Check Appwrite logs in console
4. Review auth.tsx implementation
5. Test with curl for API-level issues

---

**Last Updated**: October 18, 2025
**Status**: Ready for Testing & Deployment
