# Monta as imagens no dev e salva em tar para subir em servidor fraco (sem compilar lá).
# Uso: pwsh scripts/docker-save.ps1
# Depois copie oss-deploy.tar + docker-compose.deploy.yml + .env para o servidor.
$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
$tar  = Join-Path $root "oss-deploy.tar"

# --provenance=false: evita manifest list de atestação que docker load antigo rejeita
Write-Host "==> build oss-api:latest (Node + build do frontend)" -ForegroundColor Cyan
docker build --provenance=false -t oss-api:latest $root
if ($LASTEXITCODE -ne 0) { throw "build api falhou" }

# web (nginx) copia o dist de dentro da oss-api -> precisa da api buildada antes
Write-Host "==> build oss-web:latest (nginx + dist)" -ForegroundColor Cyan
docker build --provenance=false -f (Join-Path $root "Dockerfile.web.prod") -t oss-web:latest $root
if ($LASTEXITCODE -ne 0) { throw "build web falhou" }

# redis junto -> servidor offline não precisa puxar do registry
Write-Host "==> pull redis:7-alpine" -ForegroundColor Cyan
docker pull redis:7-alpine

Write-Host "==> save -> $tar" -ForegroundColor Cyan
docker save -o $tar oss-api:latest oss-web:latest redis:7-alpine
if ($LASTEXITCODE -ne 0) { throw "save falhou" }

$mb = [math]::Round((Get-Item $tar).Length / 1MB, 1)
Write-Host "OK: $tar ($mb MB) — api + web + redis" -ForegroundColor Green
