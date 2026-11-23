# Reconstrói o histórico de migrações (SequelizeMeta) do banco oss no app-db (MariaDB em Docker).
# Uso, na raiz do repositório:
#   powershell -ExecutionPolicy Bypass -File scripts\reconstroi-sequelize-meta.ps1          (simulação: só mostra)
#   powershell -ExecutionPolicy Bypass -File scripts\reconstroi-sequelize-meta.ps1 -Gravar  (registra as aplicadas)
# Pede a senha do usuário hospital; não grava nem exibe. Saída em logs\reconstroi-sequelize-meta.log.
param([switch]$Gravar)

$OutputEncoding = [Text.UTF8Encoding]::new($false)
Set-Location (Split-Path $PSScriptRoot -Parent)
New-Item -ItemType Directory -Force logs | Out-Null
$log = 'logs\reconstroi-sequelize-meta.log'

$sec = Read-Host 'Senha do usuário hospital do MariaDB (app-db)' -AsSecureString
$senha = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec))
$prefixo = if ($Gravar) { 'SET @gravar = 1;' } else { 'SET @gravar = 0;' }
$sql = $prefixo + "`n" + (Get-Content -Raw -Encoding UTF8 'scripts\reconstroi-sequelize-meta.sql')
$saida = $sql | docker exec -i -e MYSQL_PWD=$senha app-db mariadb -uhospital --table oss 2>&1
Remove-Variable senha, sec
$saida | Out-File $log -Encoding utf8
$saida

if ($Gravar) {
    "`nStatus depois:" | Out-File $log -Append -Encoding utf8
    npx sequelize-cli db:migrate:status 2>&1 | Select-String 'down' | Out-File $log -Append -Encoding utf8
    Get-Content $log -Tail 10
}
