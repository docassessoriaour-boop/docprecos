@echo off
setlocal
title Radar de Precos - WhatsApp
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0INICIAR_BOT_WHATSAPP.ps1"
if errorlevel 1 pause

