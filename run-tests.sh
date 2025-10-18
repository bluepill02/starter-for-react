#!/bin/bash
# Test execution script

echo "=========================================="
echo "RBAC System - Comprehensive E2E Test Suite"
echo "=========================================="
echo ""

# Install Playwright browsers if needed
echo "Ensuring Playwright browsers are installed..."
cd packages/tests
npm run playwright:install 2>/dev/null || echo "Browsers already installed"

echo ""
echo "Starting E2E tests..."
echo ""

# Run the RBAC comprehensive tests
npm run test:e2e -- rbac-comprehensive.spec.js --timeout=60000

echo ""
echo "=========================================="
echo "Test execution completed!"
echo "=========================================="
