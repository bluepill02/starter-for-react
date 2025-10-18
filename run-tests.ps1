# Comprehensive E2E Test Runner Script

Write-Host "=========================================="
Write-Host "RBAC System - Comprehensive E2E Test Suite"
Write-Host "=========================================="
Write-Host ""

# Navigate to tests directory
Push-Location packages/tests

# Ensure browsers are installed
Write-Host "Ensuring Playwright browsers are installed..."
npm run playwright:install 2>$null

Write-Host ""
Write-Host "Starting comprehensive E2E tests..."
Write-Host "This may take several minutes..."
Write-Host ""

# Run the comprehensive test suite
npm run test:e2e -- rbac-comprehensive.spec.js --timeout=60000 --workers=1

$testResult = $LASTEXITCODE

# Return to original directory
Pop-Location

Write-Host ""
Write-Host "=========================================="
if ($testResult -eq 0) {
    Write-Host "✅ All tests passed successfully!"
} else {
    Write-Host "❌ Some tests failed. Please review the output above."
}
Write-Host "=========================================="

exit $testResult
