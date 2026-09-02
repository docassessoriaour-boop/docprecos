$ErrorActionPreference = 'SilentlyContinue'
$projectPath = $PSScriptRoot

Write-Host 'Encerrando as instancias anteriores do coletor...'
$botProcesses = Get-CimInstance Win32_Process | Where-Object {
    $_.Name -eq 'node.exe' -and $_.CommandLine -like '*whatsapp-bot.js*'
}
foreach ($botProcess in $botProcesses) {
    Stop-Process -Id $botProcess.ProcessId -Force
}

Start-Sleep -Seconds 2
& (Join-Path $projectPath 'INICIAR_BOT_WHATSAPP.ps1')

