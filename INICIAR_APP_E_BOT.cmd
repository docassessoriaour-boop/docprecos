@echo off
setlocal
title Radar de Precos - App e Coletor WhatsApp
cd /d "%~dp0"

echo Iniciando o Radar de Precos...
start "Radar de Precos - App" cmd /k "cd /d ""%~dp0"" && npm run dev"

echo Aguardando o app abrir...
timeout /t 3 /nobreak >nul

echo Iniciando o coletor automatico do WhatsApp...
start "Radar de Precos - Coletor WhatsApp" cmd /k "cd /d ""%~dp0"" && npm run bot"

echo Abrindo o app no navegador...
start http://localhost:5173

exit /b
