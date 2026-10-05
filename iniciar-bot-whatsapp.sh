#!/usr/bin/env bash

# Permite que o projeto seja movido de pasta sem quebrar a inicialização.
project_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)" || exit 1
cd "$project_dir" || exit 1

find_npm() {
  # Uma instalação normal do Node.js é sempre a primeira opção.
  if command -v npm >/dev/null 2>&1; then
    command -v npm
    return 0
  fi

  # Compatibilidade com instalações usuais feitas por gerenciadores de versão.
  local npm_path
  for npm_path in "$HOME"/.nvm/versions/node/*/bin/npm "$HOME"/.volta/bin/npm; do
    if [[ -x "$npm_path" ]]; then
      printf '%s\n' "$npm_path"
      return 0
    fi
  done

  # O Codex Desktop fornece um Node Linux local, usado somente como alternativa.
  if [[ -x /usr/lib/chatgpt/resources/cua_node/bin/npm ]]; then
    printf '%s\n' /usr/lib/chatgpt/resources/cua_node/bin/npm
    return 0
  fi

  return 1
}

npm_command="$(find_npm)" || {
  printf 'Node.js e npm não foram encontrados. Instale o Node.js (versão LTS) e abra o atalho novamente.\n' >&2
  exit 127
}
export PATH="$(dirname "$npm_command"):$PATH"

trap 'printf "\nMonitor do bot encerrado.\n"; exit 0' INT TERM

while true; do
  "$npm_command" run bot
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
