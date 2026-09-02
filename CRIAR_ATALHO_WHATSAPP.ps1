$ErrorActionPreference = 'Stop'
$projectPath = $PSScriptRoot
$desktopPath = [Environment]::GetFolderPath('Desktop')

if ([string]::IsNullOrWhiteSpace($desktopPath)) {
    $desktopPath = Join-Path $env:USERPROFILE 'Desktop'
}

if (-not (Test-Path -LiteralPath $desktopPath)) {
    New-Item -ItemType Directory -Path $desktopPath | Out-Null
}

$shortcutPath = Join-Path $desktopPath 'Radar de Precos - Iniciar WhatsApp.lnk'
$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = Join-Path $projectPath 'INICIAR_BOT_WHATSAPP.cmd'
$shortcut.WorkingDirectory = $projectPath
$shortcut.Description = 'Inicia o coletor do WhatsApp e abre o Radar de Precos'
$shortcut.IconLocation = "$env:SystemRoot\System32\shell32.dll,220"
$shortcut.Save()

Write-Host "Atalho criado em: $shortcutPath"

