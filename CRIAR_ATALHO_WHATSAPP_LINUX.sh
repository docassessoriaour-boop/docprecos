#!/usr/bin/env bash

# Cria, para o usuário atual, o atalho do WhatsApp na Área de Trabalho.
set -euo pipefail

project_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
template="$project_dir/INICIAR_BOT_WHATSAPP.desktop"

if ! command -v gnome-terminal >/dev/null 2>&1; then
  printf 'Não foi possível criar o atalho: o gnome-terminal não está instalado.\n' >&2
  exit 1
fi

if command -v xdg-user-dir >/dev/null 2>&1; then
  desktop_dir="$(xdg-user-dir DESKTOP)"
else
  desktop_dir="$HOME/Desktop"
fi

if [[ -z "$desktop_dir" || "$desktop_dir" == "$HOME" ]]; then
  desktop_dir="$HOME/Desktop"
fi

mkdir -p "$desktop_dir"
shortcut="$desktop_dir/Radar de Preços - Iniciar WhatsApp.desktop"

escaped_project_dir=${project_dir//\\/\\\\}
escaped_project_dir=${escaped_project_dir//&/\\&}
sed "s|__PROJECT_DIR__|$escaped_project_dir|g" "$template" > "$shortcut"
chmod +x "$shortcut" "$project_dir/iniciar-bot-whatsapp.sh"

printf 'Atalho criado em: %s\n' "$shortcut"
printf 'Se necessário, clique com o botão direito no atalho e escolha “Permitir iniciar”.\n'
