# PowerShell script to start Loki Viewer stack

Write-Host "Starting Loki Viewer stack..." -ForegroundColor Green

# Check if Docker is running
$dockerRunning = docker info 2>$null
if (-not $dockerRunning) {
    Write-Host "Error: Docker is not running. Please start Docker Desktop." -ForegroundColor Red
    exit 1
}

# Build and start containers
Write-Host "Building and starting containers..." -ForegroundColor Yellow
docker-compose up -d --build

# Wait for services to be healthy
Write-Host "Waiting for services to be ready..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

# Check container status
Write-Host "`nContainer Status:" -ForegroundColor Cyan
docker-compose ps

# Display access information
Write-Host "`n==================================" -ForegroundColor Green
Write-Host "Loki Viewer is ready!" -ForegroundColor Green
Write-Host "==================================" -ForegroundColor Green
Write-Host "Viewer URL:  http://localhost:8080" -ForegroundColor Cyan
Write-Host "Loki API:    http://localhost:3100" -ForegroundColor Cyan
Write-Host "Health:      http://localhost:8080/health" -ForegroundColor Cyan
Write-Host "`nTo view logs:" -ForegroundColor Yellow
Write-Host "  docker-compose logs -f loki-viewer" -ForegroundColor White
Write-Host "`nTo stop:" -ForegroundColor Yellow
Write-Host "  docker-compose down" -ForegroundColor White
Write-Host "==================================`n" -ForegroundColor Green
