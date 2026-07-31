$project = $PSScriptRoot
$port = 5173

$existing = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue

if (-not $existing) {
  Start-Process -FilePath 'npm.cmd' -ArgumentList 'run dev -- --host 127.0.0.1 --port 5173' -WorkingDirectory $project -WindowStyle Hidden
  Start-Sleep -Seconds 5
}

Start-Process 'http://localhost:5173/'
