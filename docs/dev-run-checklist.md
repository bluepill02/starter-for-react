# Development Run Checklist

This document provides step-by-step commands to set up and run the Recognition System in development mode.

## Prerequisites

Before starting, ensure you have:
- ✅ **Docker** installed and running
- ✅ **Node.js** 18+ installed
- ✅ **npm** or **yarn** package manager
- ✅ **Git** for version control
- ✅ **Bash** shell (Git Bash on Windows, Terminal on macOS/Linux)

## Quick Start (Copy-Paste Commands)

### 1. Clone and Setup

```bash
# Clone the repository
git clone <repository-url>
cd starter-for-react

# Install dependencies
npm install

# Install dependencies for sub-packages
cd apps/web && npm install && cd ../..
cd apps/api && npm install && cd ../..
cd packages/tests && npm install && npm run playwright:install && cd ../..
```

### 2. Start Appwrite Emulator

```bash
# Start the Appwrite emulator with all required services
npm run dev:emulator
```

**Expected Output:**
```
🚀 Starting Appwrite Emulator for Recognition System
=======================================================
📋 Configuration:
  Appwrite Version: 1.4.13
  Project ID: recognition-dev
  HTTP Port: 8080
  HTTPS Port: 8443
  MariaDB Port: 3306
  Redis Port: 6379

🐳 Starting Appwrite emulator containers...
⏳ Waiting for services to be ready...
✅ Appwrite API is ready!
🎉 Appwrite Emulator Setup Complete!
====================================

📡 Service Endpoints:
   Appwrite API:     http://localhost:8080
   Appwrite Console: http://localhost:8080/console
   MariaDB:          localhost:3306
   Redis:            localhost:6379

🔧 Configuration:
   Project ID:       recognition-dev
   Database ID:      recognition-db
   Storage Bucket:   evidence
```

### 3. Setup Environment Files

```bash
# Copy environment example files
cp apps/api/.env.development.example apps/api/.env.development
cp apps/web/.env.development.example apps/web/.env.development
```

### 4. Seed Test Data

```bash
# Run seed data script
npm run dev:seed
```

**Expected Output:**
```
🌱 Recognition System - Seed Data Script
=========================================

1️⃣ Running bootstrap seed...
✅ Bootstrap seed completed successfully!
📊 Results: {
  users: { created: 6, total: 6 },
  teams: { created: 3, total: 3 },
  recognitions: { created: 5, total: 5 }
}

🔐 Test Accounts:
   admin: carol.admin@company.com (Password123!)
   manager: alice.manager@company.com (Password123!)
   employee: bob.employee@company.com (Password123!)
   designer: david.employee@company.com (Password123!)

2️⃣ Creating sample evidence files...
✅ Created 4 sample evidence files

3️⃣ Verifying seed data integrity...
✅ Seed data verification passed!

📋 Verification Results:
   users: ✅
   teams: ✅
   recognitions: ✅
   roles: ✅
   statuses: ✅
```

### 5. Wait for Services Ready

```bash
# Check that all services are ready
npm run dev:health
```

**Expected Output:**
```
⏳ Waiting for Recognition System services to be ready...
========================================================
📋 Configuration:
   Health Check:     http://localhost:8080/v1/functions/health-check/executions
   API Health:       http://localhost:8080/v1/health
   Max Attempts:     60
   Wait Interval:    5s
   Total Timeout:    300s

🔍 Checking service availability...
   Appwrite API:      ✅ Ready (attempt 3/60)

🏥 Checking service health...
   Health Function:   ✅ Ready

📈 Service Status Summary:
   Appwrite API:      ✅
   Database:          ✅
   Redis:             ✅
   Storage:           ✅
   Functions:         ✅

🎉 Services are ready!
==============================

🚀 Ready to start development:
   Frontend:         npm run dev:web
   Functions:        npm run dev:api
   Full Stack:       npm run dev:all
```

### 6. Start Development Servers

```bash
# Option A: Start all services at once
npm run dev:all

# Option B: Start services individually
# Terminal 1: Start web frontend
npm run dev:web

# Terminal 2: Start API functions
npm run dev:api
```

**Expected Output (dev:web):**
```
> recognition-web@1.0.0 dev
> next dev

   ▲ Next.js 14.0.0
   - Local:        http://localhost:3000
   - Network:      http://192.168.1.100:3000

 ✓ Ready in 1.2s
```

**Expected Output (dev:api):**
```
> recognition-api@1.0.0 dev
> concurrently "npm run watch:functions" "npm run serve:local"

[0] Watching functions for changes...
[1] Local server started on http://localhost:3001
[0] Functions compiled successfully
[1] Health check endpoint: /health
[1] Functions endpoint: /functions/*
```

## Verification Steps

### 1. Access Appwrite Console

```bash
# Open in browser
open http://localhost:8080/console
```

- **Login:** Use the console credentials
- **Verify:** Project "Recognition System (Dev)" exists
- **Check:** Database "recognition-db" with collections
- **Confirm:** Storage bucket "evidence" is created

### 2. Test Web Application

```bash
# Open in browser
open http://localhost:3000
```

**Login with test accounts:**
- **Admin:** carol.admin@company.com / Password123!
- **Manager:** alice.manager@company.com / Password123!  
- **Employee:** bob.employee@company.com / Password123!

**Test basic functionality:**
- ✅ Login/logout works
- ✅ Feed shows existing recognitions
- ✅ Give recognition form works
- ✅ File upload works
- ✅ Manager verification works (admin/manager accounts)
- ✅ Profile export works

### 3. Run Health Check

```bash
# Test health endpoint directly
curl http://localhost:8080/v1/functions/health-check/executions -X POST -H "Content-Type: application/json" -d '{}'
```

**Expected Response:**
```json
{
  "status": "healthy",
  "timestamp": "2023-12-07T10:30:00Z",
  "services": {
    "database": {"status": "up", "responseTime": 45},
    "storage": {"status": "up", "responseTime": 23},
    "functions": {"status": "up", "responseTime": 12},
    "queue": {"status": "up", "responseTime": 8}
  }
}
```

### 4. Run Tests

```bash
# Unit tests
npm test

# E2E smoke tests
npm run test:e2e

# Specific smoke test
npm run test:smoke
```

## Troubleshooting

### Common Issues

#### 1. Appwrite Emulator Not Starting

```bash
# Check Docker is running
docker ps

# Check port conflicts
netstat -an | grep 8080

# Clean restart
npm run dev:reset
```

#### 2. Database Connection Errors

```bash
# Check emulator logs
docker logs appwrite-emulator

# Restart database
docker restart appwrite-mariadb

# Verify collections exist
curl http://localhost:8080/v1/databases/recognition-db/collections
```

#### 3. Seed Data Issues

```bash
# Clear and reseed
npm run dev:reset

# Manual verification
open http://localhost:8080/console
```

#### 4. Function Deployment Issues

```bash
# Check function logs
docker logs appwrite-executor

# Redeploy functions
cd apps/api
npm run deploy:functions
```

#### 5. Frontend Build Issues

```bash
# Clear Next.js cache
cd apps/web
rm -rf .next
npm run build
```

### Port Configuration

| Service | Port | Purpose |
|---------|------|---------|
| Next.js Web | 3000 | Frontend application |
| API Server | 3001 | Local API server |
| Appwrite | 8080 | Main API endpoint |
| Appwrite SSL | 8443 | HTTPS endpoint |
| MariaDB | 3306 | Database |
| Redis | 6379 | Cache/Queue |

### Environment Variables

**Required for apps/api/.env.development:**
```env
APPWRITE_ENDPOINT=http://localhost:8080/v1
APPWRITE_PROJECT_ID=recognition-dev
APPWRITE_KEY=dev-api-key-recognition-system
DATABASE_ID=recognition-db
```

**Required for apps/web/.env.development:**
```env
NEXT_PUBLIC_APPWRITE_ENDPOINT=http://localhost:8080/v1
NEXT_PUBLIC_APPWRITE_PROJECT_ID=recognition-dev
NEXT_PUBLIC_DATABASE_ID=recognition-db
```

## Development Workflow

### Daily Development

```bash
# 1. Start emulator (if not running)
npm run dev:emulator

# 2. Wait for ready
npm run dev:health

# 3. Start development
npm run dev:all

# 4. Code, test, repeat...

# 5. Run tests before commits
npm test
npm run test:smoke
```

### After Pull/Changes

```bash
# 1. Update dependencies
npm install

# 2. Reset environment (if schema changed)
npm run dev:reset

# 3. Start development
npm run dev:all
```

### Production Deployment Prep

```bash
# 1. Run full test suite
npm test
npm run test:coverage
npm run test:e2e

# 2. Build applications
cd apps/web && npm run build
cd apps/api && npm run build

# 3. Check TypeScript
npm run type-check
```

## Support

If you encounter issues not covered here:

1. **Check logs:** Docker logs, browser console, terminal output
2. **Verify prerequisites:** Ensure all required software is installed
3. **Clean restart:** `npm run dev:reset` to start fresh
4. **Check ports:** Ensure no conflicts with other services
5. **Update dependencies:** `npm install` in all directories

## Quick Reference

```bash
# Complete setup from scratch
git clone <repo> && cd starter-for-react
npm install && cd apps/web && npm install && cd ../api && npm install && cd ../..
npm run dev:emulator
npm run dev:seed
npm run dev:all

# Daily restart
npm run dev:all

# Clean restart
npm run dev:reset

# Test everything
npm test && npm run test:e2e
```

## 🔧 CI/CD Pipeline & Code Quality

### Git Hooks (Automatic)
The project includes pre-commit hooks that run automatically:

```bash
# Setup hooks (run once after clone)
npm run prepare
```

**Pre-commit checks:**
- ✅ ESLint with auto-fix
- ✅ Prettier code formatting  
- ✅ TypeScript type checking
- ✅ Unit tests for changed files
- ✅ Conventional commit validation

### GitHub Actions CI Pipeline

The project includes a comprehensive CI pipeline that runs on PRs and main branch:

**Pipeline Steps:**
1. **Lint and TypeCheck** - Code quality validation
2. **Unit Tests** - Jest test suite with coverage
3. **E2E Tests** - Playwright tests against Appwrite emulator
4. **Migration Dry Run** - Database migration validation
5. **Security Scan** - npm audit and secrets detection
6. **Build Verification** - Web and API build validation
7. **Deployment Readiness** - Final deployment checks

**Manual CI Commands:**
```bash
# Run full CI locally
npm run lint
npm run type-check
npm run test:unit
npm run test:e2e
npm run build:web
npm run build:api

# Check commit message format
npx commitlint --from HEAD~1 --to HEAD

# Security audit
npm audit --audit-level=high
```

### Code Quality Standards

**Commit Message Format:**
```
feat: Add new recognition feature
fix: Resolve upload timeout issue  
docs: Update API documentation
test: Add unit tests for abuse detection
chore: Update dependencies
```

**Code Formatting:**
- Prettier with 2-space tabs
- Single quotes for JS/TS
- Trailing commas
- 80 character line limit

### Deployment Readiness Checklist

Before deploying to production:

- [ ] All CI checks pass ✅
- [ ] E2E tests pass against emulator ✅  
- [ ] Security scan clean ✅
- [ ] Build artifacts verified ✅
- [ ] Documentation updated ✅
- [ ] Environment variables configured ✅
- [ ] Migration scripts ready ✅

🚀 **Ready for Production Deployment!**