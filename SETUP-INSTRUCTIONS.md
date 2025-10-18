# 🚀 Appwrite Integration Setup Instructions

## ⚠️ Important: API Key Requirements

The setup script requires an **API Key** (not OAuth token) with full permissions to:
- Create databases and collections
- Create storage buckets
- Modify collection attributes and indexes

### Getting the Correct API Key

**For Appwrite Cloud (SaaS):**

1. Go to your Appwrite project console at https://syd.cloud.appwrite.io
2. Navigate to **Settings → API Keys**
3. Click **Create API Key**
4. Set name: `Setup Script Key`
5. Grant these permissions:
   - ✅ `databases.read`
   - ✅ `databases.write`
   - ✅ `collections.read`
   - ✅ `collections.write`
   - ✅ `attributes.read`
   - ✅ `attributes.write`
   - ✅ `indexes.read`
   - ✅ `indexes.write`
   - ✅ `buckets.read`
   - ✅ `buckets.write`
   - ✅ `files.read`
   - ✅ `files.write`
6. Copy the API Key and update `/apps/api/.env.development.example`:
   ```
   APPWRITE_KEY=your-new-api-key-here
   ```

**For Self-Hosted Appwrite:**

1. Navigate to your Appwrite console
2. Settings → API Keys
3. Create a new API Key with the same permissions as above
4. Update the `APPWRITE_KEY` in the env file

---

## Setup Steps

### Step 1: Update Credentials

Edit `/apps/api/.env.development.example` with your Appwrite credentials:

```bash
# Appwrite Configuration for Development
APPWRITE_ENDPOINT=https://syd.cloud.appwrite.io/v1  # Your Appwrite URL
APPWRITE_PROJECT_ID=68f2542a00381179cfb1             # Your project ID
APPWRITE_KEY=your-api-key-with-full-permissions     # API Key with full permissions
```

### Step 2: Set Environment Variables (PowerShell)

Run these commands in PowerShell:

```powershell
$env:APPWRITE_ENDPOINT='https://syd.cloud.appwrite.io/v1'
$env:APPWRITE_PROJECT_ID='68f2542a00381179cfb1'
$env:APPWRITE_KEY='your-api-key-here'
```

### Step 3: Run Setup Script

```bash
npm run appwrite:setup
```

**Expected Output:**
```
[INFO] 🚀 Starting Appwrite complete integration setup...
[INFO] Endpoint: https://syd.cloud.appwrite.io/v1
[INFO] Project ID: 68f2542a00381179cfb1

[INFO] Setting up database: recognition-db
[SUCCESS] Database created: recognition-db
[INFO] Setting up collection: recognitions
[SUCCESS] Collection created: recognitions
...
[SUCCESS] Appwrite integration setup completed successfully!
```

### Step 4: Verify Integration

```bash
npm run appwrite:test
```

**Expected Output:**
```
✅ Passed: 10
❌ Failed: 0
Total: 10
Pass Rate: 100%

🎉 All integration tests passed!
```

---

## Troubleshooting

### Error: "The current user is not authorized to perform the requested action"

**Cause:** The API Key doesn't have the required permissions.

**Fix:**
1. Create a new API Key with all necessary permissions (see above)
2. Update `APPWRITE_KEY` in `.env.development.example`
3. Re-run: `npm run appwrite:setup`

### Error: "Collection already exists"

**This is OK!** The setup script detects existing collections and skips them. You can safely re-run the setup script.

### Error: "Project not found"

**Cause:** Invalid `APPWRITE_PROJECT_ID`

**Fix:**
1. Go to Appwrite console Settings
2. Copy the correct Project ID
3. Update `APPWRITE_PROJECT_ID` in `.env.development.example`

### Error: "Endpoint connection refused"

**Cause:** Appwrite server not running or incorrect URL

**Fix:**
1. Verify Appwrite is running
2. Check the endpoint URL is correct
3. For self-hosted: ensure it's accessible from your machine

---

## What Gets Created

Running `npm run appwrite:setup` creates:

### Database: `recognition-db`
- **recognitions** - User recognition records
- **users** - User profiles with roles
- **teams** - Team management
- **abuse-flags** - Flagged recognitions
- **audit-entries** - Audit trail logs
- **telemetry-events** - Analytics events
- **rate-limit-breaches** - Rate limit monitoring

### Storage: `evidence`
- Max file size: 50MB
- Encryption: Enabled
- Purpose: Store recognition evidence files

---

## Next Steps

After successful setup:

1. **Test OAuth** - Navigate to `http://localhost:3000/sign-in` and test OAuth flow
2. **Review Collections** - Go to Appwrite console → Database to see created collections
3. **Start Development** - `npm run dev:all`
4. **Test Features** - Create recognitions, verify audit logs appear

---

## Quick Reference: One-Liner Setup

If you already have the correct credentials in `.env.development.example`:

```powershell
# Set variables and run setup
$env:APPWRITE_ENDPOINT=(Get-Content apps/api/.env.development.example | Select-String "^APPWRITE_ENDPOINT=" | ForEach-Object { $_ -replace "APPWRITE_ENDPOINT=" }); $env:APPWRITE_PROJECT_ID=(Get-Content apps/api/.env.development.example | Select-String "^APPWRITE_PROJECT_ID=" | ForEach-Object { $_ -replace "APPWRITE_PROJECT_ID=" }); $env:APPWRITE_KEY=(Get-Content apps/api/.env.development.example | Select-String "^APPWRITE_KEY=" | ForEach-Object { $_ -replace "APPWRITE_KEY=" }); npm run appwrite:setup
```

Or use the helper script:

```bash
powershell -ExecutionPolicy Bypass -File setup-env.ps1
npm run appwrite:setup
```

---

## Support

- **Appwrite Docs**: https://appwrite.io/docs
- **Appwrite API Keys**: https://appwrite.io/docs/references/cloud/client-web/account#createSession
- **Project Settings**: Go to your Appwrite console → Settings

---

**You're ready to go! 🎉**

Next: Start development with `npm run dev:all`
