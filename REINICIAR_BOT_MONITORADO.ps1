$ErrorActionPreference = 'SilentlyContinue'
$projectPath = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host 'Encerrando todas as instancias anteriores do coletor...'
$botProcesses = Get-CimInstance Win32_Process | Where-Object {
    $_.Name -eq 'node.exe' -and $_.CommandLine -like '*whatsapp-bot.js*'
}
foreach ($botProcess in $botProcesses) {
    Stop-Process -Id $botProcess.ProcessId -Force
}

Start-Sleep -Seconds 2
$whatsAppBrowsers = Get-CimInstance Win32_Process | Where-Object {
    $_.Name -eq 'chrome.exe' -and $_.CommandLine -like '*session-radar-precos*'
}
foreach ($whatsAppBrowser in $whatsAppBrowsers) {
    Stop-Process -Id $whatsAppBrowser.ProcessId -Force
}

Start-Sleep -Seconds 3
$remainingBots = Get-CimInstance Win32_Process | Where-Object {
    $_.Name -eq 'node.exe' -and $_.CommandLine -like '*whatsapp-bot.js*'
}
if ($remainingBots) {
    Write-Host 'Nao foi possivel encerrar uma instancia antiga. Tente novamente.'
    Read-Host 'Pressione Enter para fechar'
    exit 1
}

Write-Host 'Abrindo uma unica instancia do coletor monitorado...'
$command = "cd /d `"$projectPath`" && npm run bot"
Start-Process -FilePath 'cmd.exe' -ArgumentList '/k', $command -WorkingDirectory $projectPath
