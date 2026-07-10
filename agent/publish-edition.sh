#!/usr/bin/env bash
# publish-edition.sh — prepara a publicação de uma edição do "Café com Mercado".
#
# MODELO ATUAL (incidente 2026-07-10 — nuvem Claude Code na web):
# O proxy do GitHub da sessão só permite `git push` na BRANCH DE TRABALHO da
# sessão (não direto na `main`), e a escrita na Contents API é bloqueada. Logo,
# NÃO se publica com push direto na main. O fluxo compatível é:
#     commit + push na branch da sessão  ->  abrir PR para `main`  ->  merge
# O merge na `main` dispara o deploy (Vercel Git integration; e o push da capa
# .jpg, non-.md, também aciona o deploy-vercel.yml). O deploy NÃO sai só do push
# na branch — precisa do MERGE na main.
#
# Este helper faz a parte de GIT (copia os arquivos, commita só os nossos, e dá
# push na branch atual). A abertura e o MERGE do PR são feitos pelo AGENTE com as
# ferramentas do GitHub (MCP) — ver Passo 7 do prompt da rotina. Ele imprime a
# branch e o SHA para o passo do PR.
#
# Autenticação do git: é a credencial da sessão (configurada uma vez por
# `/web-setup` no terminal do PC). NÃO usa mais GITHUB_PAT_COWORK — o proxy
# traduz a credencial escopada da sessão. Se `git push` der 403 "denied", a
# sessão está sem escrita: rode `/web-setup` (ver agent/PIPELINE-NOTES.md).
#
# USO (a partir do checkout da sessão, na branch de trabalho):
#   agent/publish-edition.sh --date 2026-07-10 --md /tmp/edicao.md \
#     --cover /tmp/capa.jpg [--snapshot /tmp/snapshot.md]
set -euo pipefail

DATE="" MD="" COVER="" SNAP=""
while [ $# -gt 0 ]; do
  case "$1" in
    --date) DATE="$2"; shift 2;;
    --md) MD="$2"; shift 2;;
    --cover) COVER="$2"; shift 2;;
    --snapshot) SNAP="$2"; shift 2;;
    *) echo "arg desconhecido: $1" >&2; exit 2;;
  esac
done

[ -z "$DATE" ] && { echo "ERRO: --date obrigatório (YYYY-MM-DD)" >&2; exit 2; }
[ -f "$MD" ]    || { echo "ERRO: --md não encontrado: $MD" >&2; exit 2; }
[ -f "$COVER" ] || { echo "ERRO: --cover não encontrado: $COVER" >&2; exit 2; }

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"
BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [ "$BRANCH" = "main" ] || [ "$BRANCH" = "HEAD" ]; then
  echo "ERRO: publique a partir da BRANCH DE TRABALHO da sessão (branch atual: $BRANCH)." >&2
  echo "      Na nuvem o push direto na main é bloqueado; use branch -> PR -> merge." >&2
  exit 3
fi

# Copia os arquivos da edição (higiene do .md: remove NUL bytes).
mkdir -p content/cafe-com-mercado public/capas/cafe-com-mercado agent/state
tr -d '\000' < "$MD" > "content/cafe-com-mercado/${DATE}.md"
cp "$COVER" "public/capas/cafe-com-mercado/${DATE}.jpg"
[ -n "$SNAP" ] && [ -f "$SNAP" ] && cp "$SNAP" "agent/state/previous-day-snapshot.md"

git config user.email "noreply@anthropic.com"
git config user.name  "Claude"

# Adiciona SÓ os nossos arquivos (outra sessão/Cursor pode rodar em paralelo).
git add "content/cafe-com-mercado/${DATE}.md" \
        "public/capas/cafe-com-mercado/${DATE}.jpg" \
        agent/state/previous-day-snapshot.md 2>/dev/null || true

if git diff --cached --quiet; then
  echo "Nada a publicar (sem mudanças)."; exit 0
fi

git commit -q -m "content(cafe-com-mercado): edição ${DATE} + capa"

# Push na branch da sessão, com backoff só p/ falha de rede.
n=0; until [ $n -ge 5 ]; do
  if git push -u origin "HEAD:${BRANCH}"; then
    echo "PUSH OK — branch: ${BRANCH} (SHA $(git rev-parse --short HEAD))"
    echo "PROXIMO PASSO (agente, via GitHub MCP): abrir PR base=main head=${BRANCH} e fazer MERGE."
    echo "  O merge na main dispara o deploy. Depois verifique 200 no site (Passo 7.3)."
    exit 0
  fi
  n=$((n+1)); sleep $((2**n))
  echo "retry push #$n... (se for 403 'denied', a sessão está sem escrita — rode /web-setup)"
done
echo "ERRO: push falhou após 5 tentativas" >&2
exit 4
