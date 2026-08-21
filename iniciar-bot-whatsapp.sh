#!/usr/bin/env bash

cd "/home/koda_branca/Documentos/APP PREÇOS" || exit 1
npm run bot

printf '\nO bot foi encerrado. Pressione Enter para fechar esta janela.\n'
read -r
