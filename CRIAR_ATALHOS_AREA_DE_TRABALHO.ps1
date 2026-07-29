$projectPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$desktopPath = [Environment]::GetFolderPath('Desktop')

if ([string]::IsNullOrWhiteSpace($desktopPath)) {
  $oneDriveDesktop = Join-Path $env:USERPROFILE 'OneDrive\Desktop'
  if (Test-Path $oneDriveDesktop) {
    $desktopPath = $oneDriveDesktop
  } else {
    $desktopPath = $projectPath
  }
}

$shortcuts = @(
  @{
    Name = 'Radar de Precos - Abrir App e Bot.lnk'
    Target = Join-Path $projectPath 'INICIAR_APP_E_BOT.cmd'
    Description = 'Abre o Radar de Precos e o coletor automatico do WhatsApp'
  },
  @{
    Name = 'Radar de Precos - Gerar QR Code WhatsApp.lnk'
    Target = Join-Path $projectPath 'GERAR_QR_CODE_WHATSAPP.cmd'
    Description = 'Reinicia a sessao do WhatsApp e mostra um novo QR Code'
  }
)

$shell = New-Object -ComObject WScript.Shell

foreach ($item in $shortcuts) {
  $shortcutPath = Join-Path $desktopPath $item.Name
  $shortcut = $shell.CreateShortcut($shortcutPath)
  $shortcut.TargetPath = $item.Target
  $shortcut.WorkingDirectory = $projectPath
  $shortcut.Description = $item.Description
  $shortcut.IconLocation = "$env:SystemRoot\System32\shell32.dll,220"
  $shortcut.Save()
}

Write-Host 'Atalhos criados na Area de Trabalho.'
