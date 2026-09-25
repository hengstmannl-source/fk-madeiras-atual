$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$ComposeFile = Join-Path $ProjectRoot "docker-compose.local.yml"
$EnvFile = Join-Path $ProjectRoot ".env.docker"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "       FK MADEIRAS - INICIALIZADOR" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Host "ERRO: Docker nao foi encontrado." -ForegroundColor Red
    exit 1
}

Write-Host "[1/4] Verificando Docker..." -ForegroundColor Yellow

try {
    docker info *> $null
    if ($LASTEXITCODE -ne 0) {
        throw "Docker Engine indisponivel."
    }
}
catch {
    Write-Host "ERRO: Docker Desktop nao esta iniciado." -ForegroundColor Red
    Write-Host "Abra o Docker Desktop e execute novamente." -ForegroundColor Red
    exit 1
}

Write-Host "Docker OK." -ForegroundColor Green
Write-Host ""

Write-Host "[2/4] Iniciando MySQL..." -ForegroundColor Yellow

docker compose --env-file $EnvFile -f $ComposeFile start mysql

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERRO: Nao foi possivel iniciar o MySQL." -ForegroundColor Red
    exit 1
}

Write-Host "MySQL iniciado." -ForegroundColor Green
Write-Host ""

Write-Host "[3/4] Aguardando MySQL ficar saudavel..." -ForegroundColor Yellow

$Healthy = $false

for ($i = 1; $i -le 60; $i++) {
    $Status = docker inspect --format "{{.State.Health.Status}}" fk-madeiras-mysql 2>$null

    if ($Status -eq "healthy") {
        $Healthy = $true
        break
    }

    Write-Host "  Aguardando... ($i/60) Status: $Status"
    Start-Sleep -Seconds 2
}

if (-not $Healthy) {
    Write-Host "ERRO: MySQL nao ficou saudavel dentro do tempo esperado." -ForegroundColor Red
    exit 1
}

Write-Host "MySQL saudavel." -ForegroundColor Green
Write-Host ""

Write-Host "[4/4] Iniciando FK Madeiras..." -ForegroundColor Yellow

$DistIndex = Join-Path $ProjectRoot "dist\index.js"

if (-not (Test-Path $DistIndex)) {
    Write-Host "ERRO: dist\index.js nao encontrado." -ForegroundColor Red
    Write-Host "Execute 'pnpm.cmd run build' antes de iniciar o sistema." -ForegroundColor Red
    exit 1
}

Start-Process -FilePath "cmd.exe" -ArgumentList "/c", "cd /d `"$ProjectRoot`" && set NODE_ENV=production&& node dist\index.js" -WindowStyle Hidden

Write-Host "Servidor iniciado." -ForegroundColor Green
Write-Host ""

Start-Sleep -Seconds 3

Write-Host "Abrindo FK Madeiras..." -ForegroundColor Yellow
Start-Process "http://localhost:3000"

Write-Host ""
Write-Host "FK Madeiras iniciado com sucesso." -ForegroundColor Green
Write-Host "Nao feche o Docker Desktop enquanto estiver usando o sistema."
Write-Host ""