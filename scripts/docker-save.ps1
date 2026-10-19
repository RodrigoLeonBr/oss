# Monta a imagem no dev e salva em tar para subir em servidor fraco (sem compilar lá).
# Uso: pwsh scripts/docker-save.ps1
# Depois copie oss-deploy.tar + docker-compose.deploy.yml + .env para o servidor.
$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
$tar  = Join-Path $root "oss-deploy.tar"

Write-Host "==> build oss-app:latest" -ForegroundColor Cyan
# --provenance=false: evita manifest list de atestação que docker load antigo rejeita
docker build --provenance=false -t oss-app:latest $root
if ($LASTEXITCODE -ne 0) { throw "build falhou" }

# redis junto -> servidor offline não precisa puxar do registry
Write-Host "==> pull redis:7-alpine" -ForegroundColor Cyan
docker pull redis:7-alpine

Write-Host "==> save -> $tar" -ForegroundColor Cyan
docker save -o $tar oss-app:latest redis:7-alpine
if ($LASTEXITCODE -ne 0) { throw "save falhou" }

$mb = [math]::Round((Get-Item $tar).Length / 1MB, 1)
Write-Host "OK: $tar ($mb MB)" -ForegroundColor Green
