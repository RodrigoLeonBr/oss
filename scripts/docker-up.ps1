# Atualiza e sobe o docker de produção (compila no próprio host).
# Uso: pwsh scripts/docker-up.ps1
$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
$compose = "docker-compose.prod.yml"

Write-Host "==> build" -ForegroundColor Cyan
docker compose -f $compose build
if ($LASTEXITCODE -ne 0) { throw "build falhou" }

Write-Host "==> up" -ForegroundColor Cyan
docker compose -f $compose up -d
if ($LASTEXITCODE -ne 0) { throw "up falhou" }

Write-Host "==> aguardando app healthy" -ForegroundColor Cyan
for ($i = 0; $i -lt 30; $i++) {
  $s = docker inspect -f '{{.State.Health.Status}}' oss_app 2>$null
  if ($s -eq "healthy") { break }
  Start-Sleep -Seconds 3
}

Write-Host "==> migrate" -ForegroundColor Cyan
docker compose -f $compose exec -T app npm run db:migrate
if ($LASTEXITCODE -ne 0) { throw "migrate falhou" }

Write-Host "OK" -ForegroundColor Green
