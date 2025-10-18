# SSO Configuration Guide - Google & Microsoft OAuth

## 🎯 Overview

This guide provides step-by-step instructions for configuring Single Sign-On (SSO) with Google and Microsoft OAuth providers for the Recognition app.

## 📋 Prerequisites

- Appwrite backend running and accessible
- Admin access to Google Cloud Console
- Admin access to Microsoft Azure Portal
- Recognition app deployed with OAuth callback URLs configured

---

## 🔐 Part 1: Google OAuth Configuration

### Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Select a Project" → "New Project"
3. Enter project name: `recognition-app` (or your preferred name)
4. Click "Create"
5. Wait for project to be created (1-2 minutes)

### Step 2: Enable Google+ API

1. In Google Cloud Console, search for "Google+ API"
2. Click "Enable" to enable the API
3. Also search for and enable "Google Identity Services API"

### Step 3: Create OAuth 2.0 Credentials

1. Go to **Credentials** in the left sidebar
2. Click **"+ Create Credentials"** → **"OAuth client ID"**
3. You'll be prompted to create an OAuth consent screen first:
   - Choose **External** user type
   - Click **Create**

### Step 4: Configure OAuth Consent Screen

**On "Edit app registration" page:**

1. **App name**: "Recognition System"
2. **User support email**: Your company email
3. **Developer contact**: Your email
4. Click **Save and Continue**

**On "Scopes" page:**
1. Click **Add or Remove Scopes**
2. Select these scopes:
   - `userinfo.email`
   - `userinfo.profile`
   - `openid`
3. Click **Update**
4. Click **Save and Continue**

**On "Test users" page:**
- Add test email addresses for development
- Click **Save and Continue**

### Step 5: Create OAuth 2.0 Client ID

1. Back in **Credentials**, click **"+ Create Credentials"** → **"OAuth client ID"**
2. Choose **"Web application"**
3. Under "Authorized redirect URIs", add:
   - `http://localhost:3000/auth/callback` (development)
   - `https://yourdomain.com/auth/callback` (production)
   - `http://localhost:8080/auth/callback` (Appwrite emulator)
4. Click **Create**

### Step 6: Copy Credentials

1. Google will show your credentials
2. Copy the **Client ID** - you'll need this
3. Copy the **Client Secret** - store securely (don't commit to git)

**Keep these safe!** You'll use them in the next section.

---

## 🔐 Part 2: Microsoft OAuth Configuration

### Step 1: Access Azure Portal

1. Go to [Microsoft Azure Portal](https://portal.azure.com/)
2. Sign in with your Microsoft account
3. Search for **"Azure Active Directory"**
4. Click on it from the search results

### Step 2: Create App Registration

1. In Azure AD, click **"App registrations"** in left sidebar
2. Click **"+ New registration"**
3. Enter application name: `Recognition System`
4. Under "Redirect URI", select:
   - Platform: **Web**
   - URI: `http://localhost:3000/auth/callback` (development)
5. Click **Register**

### Step 3: Configure Additional Redirect URIs

1. In your app registration, go to **Authentication** in left sidebar
2. Under "Redirect URIs", add:
   - `https://yourdomain.com/auth/callback` (production)
   - `http://localhost:8080/auth/callback` (Appwrite emulator)
3. Under "Implicit grant and hybrid flows", check:
   - ☑ **ID tokens**
   - ☑ **Access tokens**
4. Click **Save**

### Step 4: Create Client Secret

1. Go to **Certificates & secrets** in left sidebar
2. Click **"+ New client secret"**
3. Description: `Recognition App Dev`
4. Expires: Select **6 months** (or per your security policy)
5. Click **Add**
6. **Copy the secret value immediately** (it won't be shown again!)

### Step 5: Note Application Details

1. Go to **Overview** tab
2. Copy and save:
   - **Application (client) ID**
   - **Directory (tenant) ID**
   - **Client Secret** (from previous step)

---

## 🚀 Part 3: Configure Appwrite OAuth

### Step 1: Access Appwrite Console

1. Open your Appwrite console: `http://localhost:8080` (development)
2. Go to **Settings** → **OAuth2 Providers**
3. Or go to **Settings** → **Security** → **OAuth Providers**

### Step 2: Configure Google OAuth in Appwrite

1. Find **Google** in the OAuth providers list
2. Enter:
   - **Client ID**: Paste from Google Cloud Console
   - **Client Secret**: Paste from Google Cloud Console
3. Click **Save**

### Step 3: Configure Microsoft OAuth in Appwrite

1. Find **Microsoft** in the OAuth providers list
2. Enter:
   - **Client ID (Application ID)**: From Azure
   - **Client Secret**: From Azure
   - **Tenant**: Use `common` for multi-tenant or paste your Directory ID
3. Click **Save**

---

## 📝 Part 4: Update Environment Files

### Development Setup

Create or update `/apps/web/.env.development.local`:

```bash
# OAuth Configuration - Development
NEXT_PUBLIC_GOOGLE_CLIENT_ID=YOUR_GOOGLE_CLIENT_ID
NEXT_PUBLIC_MICROSOFT_CLIENT_ID=YOUR_MICROSOFT_CLIENT_ID

# Appwrite OAuth Callback
NEXT_PUBLIC_OAUTH_REDIRECT_URI=http://localhost:3000/auth/callback
```

### Production Setup

Create `/apps/web/.env.production`:

```bash
# OAuth Configuration - Production
NEXT_PUBLIC_GOOGLE_CLIENT_ID=YOUR_PROD_GOOGLE_CLIENT_ID
NEXT_PUBLIC_MICROSOFT_CLIENT_ID=YOUR_PROD_MICROSOFT_CLIENT_ID

# Appwrite OAuth Callback
NEXT_PUBLIC_OAUTH_REDIRECT_URI=https://yourdomain.com/auth/callback
```

---

## 🎨 Part 5: Update Sign-In UI

The Recognition app already has OAuth integration built-in. The sign-in flow is in:
- `/apps/web/src/lib/auth.tsx` - Authentication logic
- `/apps/web/src/components/SignInModal.tsx` - UI component

**Example usage:**

```typescript
import { useAuth } from '../lib/auth';

function SignInPage() {
  const { signInWithOAuth, signInWithEmail } = useAuth();
  
  return (
    <div>
      <button onClick={() => signInWithOAuth('google')}>
        Sign in with Google
      </button>
      <button onClick={() => signInWithOAuth('microsoft')}>
        Sign in with Microsoft
      </button>
    </div>
  );
}
```

---

## 🧪 Part 6: Testing SSO Locally

### Start the Development Environment

```bash
# Terminal 1: Start Appwrite emulator
npm run dev:emulator

# Terminal 2: Start the dev server
npm run dev

# Terminal 3: Start API functions (if needed)
npm run api:dev
```

### Test Google Sign-In

1. Navigate to `http://localhost:3000`
2. Click **"Sign in with Google"**
3. You'll be redirected to Google login
4. Sign in with a test account
5. You should be redirected back to the app with a session

### Test Microsoft Sign-In

1. Navigate to `http://localhost:3000`
2. Click **"Sign in with Microsoft"**
3. You'll be redirected to Microsoft login
4. Sign in with a test account
5. You should be redirected back to the app with a session

### Check Session Created

After successful OAuth sign-in:

```typescript
import { useAuth } from '../lib/auth';

function CheckAuth() {
  const { currentUser, session } = useAuth();
  
  if (currentUser) {
    console.log('User:', currentUser);
    console.log('Session:', session);
  }
}
```

---

## 🔍 Part 7: Troubleshooting

### Issue: "Invalid redirect URI"
**Solution**: Make sure the redirect URI in your OAuth provider matches exactly:
- Check protocol (http vs https)
- Check domain and port
- Check path (`/auth/callback`)
- No trailing slashes

### Issue: "Access denied" or "Scope not approved"
**Solution**:
- Google: Ensure you added the app to test users or published it
- Microsoft: Check that required scopes are configured

### Issue: "CORS errors"
**Solution**: Ensure Appwrite CORS settings allow your domain:
1. Go to Appwrite Console → Settings
2. Add your domain to "Allowed Domains"

### Issue: "Session not persisting"
**Solution**:
- Check cookies are enabled
- Check if localStorage is working
- Verify session cookie domain matches

---

## 🛡️ Security Best Practices

### Development

✅ Use `localhost` callback URLs
✅ Use environment variables for secrets (never commit them)
✅ Use short expiration times for test tokens
✅ Add only necessary test users

### Production

✅ Use HTTPS for all callback URLs
✅ Store secrets in secure environment (CI/CD secrets)
✅ Rotate credentials regularly (every 3-6 months)
✅ Monitor OAuth provider logs for suspicious activity
✅ Enable two-factor authentication for provider accounts
✅ Use organization/tenant isolation

---

## 📊 Integration Checklist

- [ ] Google OAuth credentials created and configured in Appwrite
- [ ] Microsoft OAuth credentials created and configured in Appwrite
- [ ] Environment variables set in development and production
- [ ] Redirect URLs configured in both OAuth providers
- [ ] Sign-in UI component displays OAuth buttons
- [ ] OAuth sign-in tested and working locally
- [ ] Session persists after OAuth sign-in
- [ ] User data properly mapped to app schema
- [ ] Error handling implemented for failed OAuth attempts
- [ ] Production environment tested with real credentials
- [ ] Monitoring/logging set up for OAuth events

---

## 📚 Additional Resources

- [Appwrite OAuth Documentation](https://appwrite.io/docs/products/auth/oauth2)
- [Google OAuth 2.0 Setup](https://developers.google.com/identity/protocols/oauth2)
- [Microsoft OAuth 2.0 Setup](https://learn.microsoft.com/en-us/graph/auth-v2-service)
- [OAuth 2.0 Best Practices](https://www.rfc-editor.org/rfc/rfc6749)

---

## 🎯 Next Steps

After SSO is configured:

1. **Test in Production** - Deploy with real OAuth credentials
2. **User Onboarding** - Create user guidance for OAuth sign-in
3. **Rate Limiting** - Set up rate limits on auth endpoints
4. **Audit Logging** - Log all OAuth sign-in events
5. **Error Handling** - Create user-friendly error pages for auth failures

---

**Created**: October 18, 2025
**Status**: Ready for Implementation