# Windows PowerShell script to set environment variables from .env.development.example
# Run this before running npm run appwrite:setup

Write-Host "Setting Appwrite environment variables..." -ForegroundColor Cyan

# Extract values from apps/api/.env.development.example
$envFile = "apps/api/.env.development.example"

if (-Not (Test-Path $envFile)) {
    Write-Host "File not found: $envFile" -ForegroundColor Red
    exit 1
}

# Read the file and extract values
$content = Get-Content $envFile

foreach ($line in $content) {
    if ($line -match '^([^=]+)=(.*)$') {
        $key = $matches[1].Trim()
        $value = $matches[2].Trim()
        
        # Set as environment variable
        if ($key -eq "APPWRITE_ENDPOINT" -or $key -eq "APPWRITE_PROJECT_ID" -or $key -eq "APPWRITE_KEY") {
            [System.Environment]::SetEnvironmentVariable($key, $value, [System.EnvironmentVariableTarget]::Process)
            Write-Host "[OK] Set $key" -ForegroundColor Green
        }
    }
}

Write-Host ""
Write-Host "Environment variables set successfully!" -ForegroundColor Green
Write-Host ""
Write-Host 'Run: npm run appwrite:setup' -ForegroundColor Yellow
