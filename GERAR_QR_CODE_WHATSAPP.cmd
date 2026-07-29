@echo off
setlocal
title Radar de Precos - Gerar QR Code WhatsApp
cd /d "%~dp0"

echo Este atalho gera um novo QR Code do WhatsApp.
echo Use quando o coletor nao conectar ou quando quiser trocar/reconectar o celular.
echo.
choice /C SN /M "Deseja reiniciar a sessao e gerar um novo QR Code"
if errorlevel 2 (
  echo Operacao cancelada.
  pause
  exit /b
)

echo.
echo Reiniciando a sessao do WhatsApp...
npm run bot:reset

pause
