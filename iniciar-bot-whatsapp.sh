#!/usr/bin/env bash

cd "/home/koda_branca/Documentos/APP PREÇOS" || exit 1

trap 'printf "\nMonitor do bot encerrado.\n"; exit 0' INT TERM

while true; do
  npm run bot
  exit_code=$?

  if curl -fsS --max-time 2 http://localhost:3001/api/whatsapp-config >/dev/null 2>&1; then
    printf '\nO bot ja esta ativo em outra janela. Esta janela ficara monitorando.\n'
    while curl -fsS --max-time 2 http://localhost:3001/api/whatsapp-config >/dev/null 2>&1; do
      sleep 10
    done
    printf 'A instancia anterior parou. Reiniciando automaticamente...\n'
  else
    printf '\nO bot parou (codigo %s). Reiniciando em 5 segundos...\n' "$exit_code"
    sleep 5
  fi
done
