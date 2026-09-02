$ErrorActionPreference = 'Stop'
$projectPath = $PSScriptRoot
$appUrl = 'https://docprecos.vercel.app/'
$botUrl = 'http://127.0.0.1:3001/api/whatsapp-config'

$localNodeFolder = Get-ChildItem -Path (Join-Path $projectPath '.runtime-node') -Directory -Filter 'node-v*-win-x64' -ErrorAction SilentlyContinue |
    Sort-Object Name -Descending |
    Select-Object -First 1
if ($localNodeFolder) {
    $env:Path = "$($localNodeFolder.FullName);$env:Path"
}

function Test-BotOnline {
    try {
        Invoke-WebRequest -Uri $botUrl -UseBasicParsing -TimeoutSec 2 | Out-Null
        return $true
    } catch {
        return $false
    }
}

if (-not (Get-Command node.exe -ErrorAction SilentlyContinue) -or
    -not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) {
    Write-Host ''
    Write-Host 'Node.js nao foi encontrado neste computador.' -ForegroundColor Yellow
    Write-Host 'Instale a versao LTS em https://nodejs.org e execute este atalho novamente.'
    Start-Process 'https://nodejs.org/'
    exit 1
}

if (-not (Test-Path (Join-Path $projectPath '.windows-dependencies-ready'))) {
    Write-Host 'Preparando o coletor pela primeira vez...'
    Push-Location $projectPath
    try {
        & npm.cmd install
        if ($LASTEXITCODE -ne 0) { throw 'Nao foi possivel instalar as dependencias.' }
        New-Item -ItemType File -Path (Join-Path $projectPath '.windows-dependencies-ready') -Force | Out-Null
    } finally {
        Pop-Location
    }
}

if (Test-BotOnline) {
    Write-Host 'O coletor do WhatsApp ja esta ativo.' -ForegroundColor Green
} else {
    Write-Host 'Iniciando o coletor do WhatsApp...'
    $command = "cd /d `"$projectPath`" && npm run bot"
    Start-Process -FilePath 'cmd.exe' -ArgumentList '/k', $command -WorkingDirectory $projectPath

    for ($attempt = 0; $attempt -lt 20; $attempt += 1) {
        Start-Sleep -Seconds 1
        if (Test-BotOnline) { break }
    }
}

Start-Process $appUrl

if (Test-BotOnline) {
    Write-Host 'Coletor ativo. O Radar de Precos foi aberto.' -ForegroundColor Green
    exit 0
}

Write-Host 'A janela do coletor foi aberta, mas ele ainda esta conectando.' -ForegroundColor Yellow
Write-Host 'Se aparecer um QR Code, leia-o pelo WhatsApp no celular.'
exit 0
