# Authentication System Documentation

## Overview

The Recognition App authentication system provides secure OAuth-based login with role-based access control (RBAC) and enterprise SCIM integration. Built on Appwrite's authentication service with custom extensions for enterprise features.

## Features

- **OAuth Providers**: Google and Microsoft SSO
- **Email Fallback**: Direct email/password authentication
- **Role-Based Access Control**: USER, MANAGER, ADMIN roles with hierarchical permissions
- **SCIM Integration**: Automated user provisioning from identity providers
- **Audit Trail**: Complete logging of authentication events
- **Security**: JWT tokens, secure OAuth flows, audit logging

## Quick Start

### 1. Environment Setup

Create `.env.development` in `/apps/web/`:

```env
# Appwrite Configuration
VITE_APPWRITE_ENDPOINT=http://localhost/v1
VITE_APPWRITE_PROJECT_ID=recognition-app
VITE_APPWRITE_DATABASE_ID=main

# OAuth Providers
VITE_GOOGLE_CLIENT_ID=your-google-client-id
VITE_MICROSOFT_CLIENT_ID=your-microsoft-client-id

# OAuth Redirect URLs (development)
VITE_OAUTH_REDIRECT_URL=http://localhost:5173/auth/callback
```

Create `.env.development` in `/apps/api/`:

```env
# Appwrite Server Configuration
APPWRITE_ENDPOINT=http://localhost/v1
APPWRITE_PROJECT_ID=recognition-app
APPWRITE_API_KEY=your-server-api-key

# SCIM Configuration
SCIM_AUTH_TOKEN=your-scim-bearer-token

# Database Collections
USERS_DATABASE_ID=main
USERS_COLLECTION_ID=users
AUDIT_DATABASE_ID=main
AUDIT_COLLECTION_ID=audit_entries
```

### 2. OAuth Provider Setup

#### Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing project
3. Enable Google+ API
4. Create OAuth 2.0 credentials:
   - Application type: Web application
   - Authorized redirect URIs:
     - Development: `http://localhost:5173/auth/callback`
     - Production: `https://yourdomain.com/auth/callback`
5. Copy Client ID to `VITE_GOOGLE_CLIENT_ID`

#### Microsoft OAuth Setup

1. Go to [Azure Portal](https://portal.azure.com/)
2. Navigate to Azure Active Directory > App registrations
3. Create new registration:
   - Name: Recognition App
   - Redirect URI: `http://localhost:5173/auth/callback` (development)
4. Copy Application (client) ID to `VITE_MICROSOFT_CLIENT_ID`
5. Configure API permissions:
   - Microsoft Graph > User.Read (delegated)

### 3. Appwrite Configuration

#### Database Collections

Create these collections in your Appwrite database:

**Users Collection** (`users`):

```json
{
  "name": "string",
  "email": "string", 
  "role": "string",
  "department": "string",
  "managerId": "string",
  "active": "boolean",
  "createdAt": "datetime",
  "updatedAt": "datetime"
}
```

**Audit Entries Collection** (`audit_entries`):

```json
{
  "eventCode": "string",
  "actorId": "string",
  "targetId": "string", 
  "metadata": "string",
  "createdAt": "datetime"
}
```

#### Authentication Settings

1. Enable OAuth providers in Appwrite Console:
   - Google: Add Client ID and Secret
   - Microsoft: Add Client ID and Secret
2. Configure redirect URLs:
   - Success: `/auth/callback`
   - Failure: `/auth/error`

## Usage

### Basic Authentication

```tsx
import { useAuth } from '@/lib/auth';

function LoginPage() {
  const { login, loginWithGoogle, loginWithMicrosoft, loading } = useAuth();

  return (
    <div>
      {/* OAuth Login */}
      <button onClick={loginWithGoogle} disabled={loading}>
        Sign in with Google
      </button>
      
      <button onClick={loginWithMicrosoft} disabled={loading}>
        Sign in with Microsoft
      </button>

      {/* Email Login */}
      <form onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.target);
        login(data.get('email'), data.get('password'));
      }}>
        <input name="email" type="email" required />
        <input name="password" type="password" required />
        <button type="submit">Sign In</button>
      </form>
    </div>
  );
}
```

### Role-Based Access Control

```tsx
import { useAuth, RequireRole, RequireAuth } from '@/lib/auth';

function AdminPanel() {
  return (
    <RequireRole role="ADMIN">
      <h1>Admin Panel</h1>
      <p>Only admins can see this content</p>
    </RequireRole>
  );
}

function ManagerDashboard() {
  const { user, isManager, isAdmin } = useAuth();
  
  return (
    <RequireAuth>
      <div>
        <h1>Welcome, {user.name}</h1>
        
        {isManager && (
          <section>
            <h2>Manager Tools</h2>
            <p>Verify recognitions, view team reports</p>
          </section>
        )}
        
        {isAdmin && (
          <section>
            <h2>Admin Tools</h2>
            <p>Manage users, view audit logs</p>
          </section>
        )}
      </div>
    </RequireAuth>
  );
}
```

### RBAC Helpers

```tsx
import { useAuth } from '@/lib/auth';

function FeatureComponent() {
  const { 
    user, 
    isUser, 
    isManager, 
    isAdmin, 
    hasRole, 
    hasMinimumRole 
  } = useAuth();

  return (
    <div>
      {/* Check specific role */}
      {hasRole('MANAGER') && <ManagerButton />}
      
      {/* Check minimum role level */}
      {hasMinimumRole('MANAGER') && <AdminOrManagerButton />}
      
      {/* Boolean helpers */}
      {isAdmin && <AdminSettings />}
      {(isManager || isAdmin) && <ManagementTools />}
    </div>
  );
}
```

## SCIM Integration

### SCIM Endpoint Configuration

The SCIM sync function is available at:

```http
POST /functions/scim-sync/execution
```

### SCIM Authentication

Include bearer token in requests:

```bash
curl -X POST \
  -H "Authorization: Bearer your-scim-token" \
  -H "Content-Type: application/json" \
  -d '{"Users": [...]}' \
  https://your-appwrite-endpoint/v1/functions/scim-sync/execution
```

### SCIM User Schema

```json
{
  "userName": "john.doe@example.com",
  "name": {
    "givenName": "John",
    "familyName": "Doe"
  },
  "emails": [
    {
      "value": "john.doe@example.com",
      "primary": true
    }
  ],
  "active": true,
  "roles": ["user", "manager", "admin"],
  "department": "Engineering",
  "manager": {
    "value": "manager-user-id",
    "displayName": "Manager Name"
  }
}
```

### Role Mapping

SCIM roles are automatically mapped to app roles:

- `admin`, `Administrator` → `ADMIN`
- `manager`, `Manager` → `MANAGER`  
- Default → `USER`

### Bulk Operations

Send multiple users in a single request:

```json
{
  "Users": [
    {
      "userName": "user1@example.com",
      "name": { "givenName": "User", "familyName": "One" },
      "emails": [{ "value": "user1@example.com", "primary": true }],
      "active": true
    },
    {
      "userName": "user2@example.com", 
      "name": { "givenName": "User", "familyName": "Two" },
      "emails": [{ "value": "user2@example.com", "primary": true }],
      "active": false
    }
  ]
}
```

## Security Features

### Audit Trail

All authentication events are automatically logged:

- User login/logout
- OAuth provider used
- Role changes via SCIM
- Failed authentication attempts
- SCIM sync operations

### JWT Token Security

- Tokens auto-refresh before expiration
- Secure storage in httpOnly cookies (production)
- Automatic logout on token expiry

### Data Privacy

- User IDs are hashed in audit logs
- PII is never logged in telemetry
- OAuth tokens are not stored client-side

## Testing

### Running Auth Tests

```bash
# Run all auth tests
npm test auth.test.tsx

# Run SCIM tests  
npm test scim.test.ts

# Run with coverage
npm test -- --coverage
```

### Test Coverage

- OAuth login flows
- Email authentication
- Role-based access control
- SCIM user provisioning
- Error handling
- Audit trail creation

## Troubleshooting

### Common Issues

**OAuth redirect errors:**

- Verify redirect URLs match exactly in provider config
- Check HTTPS requirements in production
- Ensure `VITE_OAUTH_REDIRECT_URL` is correct

**SCIM sync failures:**

- Verify `SCIM_AUTH_TOKEN` matches provider config
- Check user email format and required fields
- Review Appwrite function logs

**Role permissions not working:**

- Verify user has correct role in Appwrite preferences
- Check role hierarchy: `ADMIN` > `MANAGER` > `USER`
- Ensure `RequireRole` components wrap protected content

### Debug Logging

Enable debug logs in development:

```tsx
// In your main App component
import { useAuth } from '@/lib/auth';

function App() {
  const { user, loading, error } = useAuth();
  
  if (process.env.NODE_ENV === 'development') {
    console.log('Auth state:', { user, loading, error });
  }
  
  return <YourApp />;
}
```

### Production Deployment

1. **Environment Variables:**
   - Set production OAuth redirect URLs
   - Use secure SCIM tokens
   - Enable HTTPS-only cookies

2. **Appwrite Configuration:**
   - Update OAuth provider settings with production URLs
   - Set appropriate session duration
   - Enable email verification if required

3. **Security Checklist:**
   - [ ] OAuth redirect URLs use HTTPS
   - [ ] SCIM endpoints use bearer authentication
   - [ ] Audit logs exclude PII
   - [ ] Rate limiting enabled on auth endpoints
   - [ ] Session tokens have appropriate expiry

## API Reference

### useAuth Hook

```tsx
const {
  // Auth state
  user,           // Current user object or null
  loading,        // Boolean: auth operation in progress
  error,          // Error message or null
  
  // Auth actions
  login,          // (email, password) => Promise<void>
  logout,         // () => Promise<void>
  register,       // (email, password, name) => Promise<void>
  
  // OAuth actions
  loginWithGoogle,    // () => Promise<void>
  loginWithMicrosoft, // () => Promise<void>
  
  // Role helpers
  isUser,         // Boolean: user has USER role
  isManager,      // Boolean: user has MANAGER role
  isAdmin,        // Boolean: user has ADMIN role
  hasRole,        // (role) => Boolean
  hasMinimumRole, // (role) => Boolean
} = useAuth();
```

### Components

```tsx
// Require authentication
<RequireAuth fallback={<LoginPage />}>
  <ProtectedContent />
</RequireAuth>

// Require specific role
<RequireRole role="MANAGER" fallback={<AccessDenied />}>
  <ManagerContent />
</RequireRole>

// Require minimum role level
<RequireRole role="MANAGER" minimum fallback={<AccessDenied />}>
  <ManagerOrAdminContent />
</RequireRole>
```

For more details, see the implementation files:

- `/apps/web/src/lib/auth.tsx` - Main auth system
- `/apps/api/functions/scim-sync/index.ts` - SCIM integration
- `/apps/api/functions/rbac-middleware/index.ts` - Server-side RBAC