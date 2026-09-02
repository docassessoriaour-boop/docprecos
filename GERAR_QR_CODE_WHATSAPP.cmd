@echo off
setlocal
title Radar de Precos - Gerar QR Code WhatsApp
cd /d "%~dp0"

for /d %%D in ("%~dp0.runtime-node\node-v*-win-x64") do set "PATH=%%~fD;%PATH%"

where npm.cmd >nul 2>nul
if errorlevel 1 (
  echo Node.js/NPM nao encontrado. Instale a versao LTS em https://nodejs.org.
  pause
  exit /b 1
)

echo Este comando desconecta a sessao atual e gera um novo QR Code.
choice /C SN /M "Deseja continuar"
if errorlevel 2 exit /b 0

npm run bot:reset
pause
