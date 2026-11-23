# Fase 1 do plano de incorporação: migração de tb_documento, GRANT para o MCP,
# md_path das escalas reclassificadas do PA Zanaga e sincronização do catálogo.
# Uso, na raiz do repositório:
#   powershell -ExecutionPolicy Bypass -File scripts\testes-f1-mysql.ps1              (migração se pendente + catálogo)
#   powershell -ExecutionPolicy Bypass -File scripts\testes-f1-mysql.ps1 -AplicarSql  (também GRANT e md_path; pede a senha)
# A senha do usuário hospital do MariaDB (app-db) não é gravada nem exibida. Saída em logs\testes-f1-mysql.log.
# No PowerShell, `npm run x -- --arg` perde o `--`; por isso os scripts Node são chamados direto.
param([switch]$AplicarSql)

$ErrorActionPreference = 'Continue'
$OutputEncoding = [Text.UTF8Encoding]::new($false)
Set-Location (Split-Path $PSScriptRoot -Parent)
New-Item -ItemType Directory -Force logs | Out-Null
$log = 'logs\testes-f1-mysql.log'
function Passo($t) { "`n=== $t ===" | Out-File $log -Append -Encoding utf8; Write-Host "`n=== $t ===" }
function Registra { process { $_ | Out-File $log -Append -Encoding utf8; $_ } }
"Início: $(Get-Date -Format s)" | Out-File $log -Encoding utf8

Passo 'Node e FTS5'
node -v 2>&1 | Registra
node -e "const s=require('node:sqlite');try{new s.DatabaseSync(':memory:').exec('CREATE VIRTUAL TABLE t USING fts5(x)');console.log('FTS5: disponível')}catch(e){console.log('FTS5: indisponível (busca por varredura; atualize o Node)')}" 2>$null | Registra

Passo 'Migração de tb_documento'
$status = npx sequelize-cli db:migrate:status 2>&1 | Out-String
if ($status -match 'down 20261122120000-create-tb-documento') {
    npx sequelize-cli db:migrate --name 20261122120000-create-tb-documento.js 2>&1 | Registra
    if ($LASTEXITCODE -ne 0) { 'Migração falhou; parando.' | Registra; exit 1 }
} else { 'Já aplicada.' | Registra }

if ($AplicarSql) {
    Passo 'GRANT de tb_documento e md_path das escalas'
    $sec = Read-Host 'Senha do usuário hospital do MariaDB (app-db)' -AsSecureString
    $senha = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec))
    Get-Content -Raw -Encoding UTF8 'prestacao-vault\reclassificacao\f1_mysql.sql' |
        docker exec -i -e MYSQL_PWD=$senha app-db mariadb -uhospital oss 2>&1 | Registra
    Remove-Variable senha, sec
}

Passo 'Catálogo para tb_documento'
node src/incorporacao/catalogo.js --unidade=pa_zanaga,upa_dona_rosa --ano=2026 --banco 2>&1 |
    Where-Object { "$_" -notmatch 'ExperimentalWarning|trace-warnings' } | Registra

"`nFim: $(Get-Date -Format s)" | Registra
