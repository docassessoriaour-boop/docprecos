@echo off
setlocal
title Reiniciar Coletor WhatsApp Monitorado
cd /d "%~dp0"

echo Encerrando apenas o coletor anterior da porta 3001...
powershell -NoProfile -Command "$listener = Get-NetTCPConnection -State Listen -LocalPort 3001 -ErrorAction SilentlyContinue ^| Select-Object -First 1; if ($listener) { Stop-Process -Id $listener.OwningProcess -Force }"

timeout /t 2 /nobreak >nul
echo Abrindo o coletor com monitoramento em tempo real...
start "Radar de Precos - Coletor Monitorado" cmd /k "cd /d ""%~dp0"" && npm run bot"

exit /b
