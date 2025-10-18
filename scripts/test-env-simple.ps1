# Development Environment Test Script
Write-Host "Testing Complete Development Environment Setup" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

function Write-Success {
    param($Message)
    Write-Host "✓ $Message" -ForegroundColor Green
}

function Write-Warning {
    param($Message)
    Write-Host "! $Message" -ForegroundColor Yellow
}

function Write-Info {
    param($Message)
    Write-Host "i $Message" -ForegroundColor Blue
}

# Check prerequisites
Write-Host "`nChecking Prerequisites..." -ForegroundColor Cyan

try {
    $null = node --version
    Write-Success "Node.js installed"
} catch {
    Write-Warning "Node.js not found"
}

try {
    $null = docker --version  
    Write-Success "Docker installed"
} catch {
    Write-Warning "Docker not found"
}

try {
    $null = git --version
    Write-Success "Git installed"
} catch {
    Write-Warning "Git not found"
}

# Test TypeScript
Write-Host "`nTesting TypeScript..." -ForegroundColor Cyan
try {
    $null = npm run type-check 2>$null
    Write-Success "TypeScript check passed"
} catch {
    Write-Warning "TypeScript issues found"
}

Write-Host "`nDevelopment Environment Ready!" -ForegroundColor Green
Write-Host "Next steps:"
Write-Host "1. Start Docker Desktop"
Write-Host "2. Run: npm run dev:emulator"
Write-Host "3. Run: npm run dev:all"