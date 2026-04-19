# StudyGo Staging Stack — Start Script
# Run this in PowerShell to bring up the full 7-container staging environment
# Usage: .\start-staging.ps1

$COMPOSE = "d:\Demo SIT313\SIT313--Full-Stack-Development--Secure-Frontend-services-\HD_6.1\docker-compose.staging.yml"

# ─── Set secrets ────────────────────────────────────────────
$env:JWT_SECRET        = "abcd123"
$env:MAIL_HOST         = "smtp.gmail.com"
$env:MAIL_USER         = "adityasoodgood@gmail.com"
$env:MAIL_PASS         = "mgfyzotdzqkpfclw"
$env:CLOUD_NAME        = "de5llnb0x"
$env:API_KEY           = "994167331515316"
$env:API_SECRET        = "rz8v-jDnETABlP6ikM_CXhWo5zI"
$env:RAZORPAY_KEY      = "rzp_test_RZ9Up94XF2yFht"
$env:RAZORPAY_SECRET   = "g5nGggNDpqcTDPs7KOXL7pbb"

# NOTE: We use the LOCAL mongo container (not Atlas) because Docker containers
# cannot resolve MongoDB Atlas SRV DNS in isolated bridge networks.
# The local mongo container is sufficient for staging/demo purposes.
$env:MONGODB_URL = "mongodb://admin:staging_pass123@mongo:27017/studygo_staging?authSource=admin"

# ─── Copy monitoring files to persistent path ───────────────
$SOURCE = "d:\Demo SIT313\SIT313--Full-Stack-Development--Secure-Frontend-services-\HD_6.1\monitoring"
Copy-Item "$SOURCE\*" "C:\studygo-monitoring\" -Recurse -Force
Write-Host "Monitoring configs synced to C:\studygo-monitoring\" -ForegroundColor Green

# ─── Clean up previous containers ───────────────────────────
Write-Host "Cleaning up previous containers..." -ForegroundColor Yellow
docker rm -f studygo-mongo-staging studygo-grafana-staging studygo-prometheus-staging `
             studygo-alertmanager-staging studygo-node-exporter-staging `
             studygo-frontend-staging studygo-backend-staging 2>$null
docker network rm hd_61_studygo-staging 2>$null

# ─── Start the stack ────────────────────────────────────────
Write-Host "Starting StudyGo staging stack..." -ForegroundColor Cyan
docker compose -f $COMPOSE up -d

Write-Host "Waiting 35 seconds for services to initialise..." -ForegroundColor Yellow
Start-Sleep 35

# ─── Show status ────────────────────────────────────────────
Write-Host "`n=== Container Status ===" -ForegroundColor Green
docker compose -f $COMPOSE ps

Write-Host "`n=== Access Points ===" -ForegroundColor Cyan
Write-Host "Frontend    : http://localhost:3001" -ForegroundColor White
Write-Host "Backend API : http://localhost:4001" -ForegroundColor White
Write-Host "Prometheus  : http://localhost:9091" -ForegroundColor White
Write-Host "Grafana     : http://localhost:3002  (admin / admin123)" -ForegroundColor White
Write-Host "AlertManager: http://localhost:9094" -ForegroundColor White
