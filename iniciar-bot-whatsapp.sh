#!/usr/bin/env bash

# Permite que o projeto seja movido de pasta sem quebrar a inicialização.
project_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)" || exit 1
cd "$project_dir" || exit 1

find_node() {
  if command -v node >/dev/null 2>&1; then
    command -v node
    return 0
  fi

  local node_path
  for node_path in "$HOME"/.nvm/versions/node/*/bin/node \
    "$HOME"/.volta/bin/node \
    "$HOME"/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node \
    /usr/lib/chatgpt/resources/cua_node/bin/node; do
    if [[ -x "$node_path" ]]; then
      printf '%s\n' "$node_path"
      return 0
    fi
  done
  return 1
}

node_command="$(find_node)" || {
  printf 'Node.js não foi encontrado. Instale o Node.js (versão LTS) e abra o atalho novamente.\n' >&2
  if [[ -t 0 ]]; then
    read -r -p 'Pressione Enter para fechar...' || true
  fi
  exit 127
}
export PATH="$(dirname "$node_command"):$PATH"

trap 'printf "\nMonitor do bot encerrado.\n"; exit 0' INT TERM

while true; do
  "$node_command" whatsapp-bot.js
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
