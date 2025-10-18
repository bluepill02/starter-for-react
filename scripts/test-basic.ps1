Write-Host "Testing Development Environment" -ForegroundColor Green

Write-Host "Checking Node.js..." -ForegroundColor Yellow
node --version

Write-Host "Checking Docker..." -ForegroundColor Yellow  
docker --version

Write-Host "Checking Git..." -ForegroundColor Yellow
git --version

Write-Host "Running TypeScript check..." -ForegroundColor Yellow
npm run type-check

Write-Host "Environment test complete!" -ForegroundColor Green
Write-Host "Next: npm run dev:emulator then npm run dev:all"