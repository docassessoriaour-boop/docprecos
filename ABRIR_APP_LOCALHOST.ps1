$project = $PSScriptRoot
$port = 5173

if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) {
  Write-Host 'Node.js/NPM nao encontrado. Instale a versao LTS em https://nodejs.org.' -ForegroundColor Yellow
  exit 1
}

$existing = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue

if (-not $existing) {
  Start-Process -FilePath 'npm.cmd' -ArgumentList 'run dev -- --host 127.0.0.1 --port 5173' -WorkingDirectory $project -WindowStyle Hidden
  Start-Sleep -Seconds 5
}

Start-Process 'http://localhost:5173/'

