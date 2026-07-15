#!/bin/bash
# SessionStart hook — garante a fonte padrão da capa do "Café com Mercado".
#
# Por que existe (incidente 2026-07-10): o sandbox de nuvem do Claude Code na web
# vem só com fonts-dejavu-core (DejaVuSans-Bold, LARGA). A capa padronizada usa
# DejaVu Sans Condensed Bold (pacote fonts-dejavu-extra). Sem ela, a rotina caía
# no fallback largo e a capa perdia o padrão. Este hook instala a fonte no início
# de toda sessão de nuvem, de forma idempotente.
set -euo pipefail

# Só na nuvem (Claude Code na web). No PC local a fonte já existe / não usar apt.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

FONT="/usr/share/fonts/truetype/dejavu/DejaVuSansCondensed-Bold.ttf"
if [ -f "$FONT" ]; then
  echo "session-start: fonte da capa (DejaVu Sans Condensed Bold) já presente."
  exit 0
fi

echo "session-start: instalando fonts-dejavu-extra (fonte padrão da capa)..."
# Sandbox novo pode vir sem as listas do apt — sem o update o install falha
# em silêncio (foi a causa provável da capa fora do padrão em 2026-07-15).
LOG=/tmp/session-start-font.log
{ apt-get update -qq && apt-get install -y --no-install-recommends fonts-dejavu-extra; } >"$LOG" 2>&1 || true

if [ -f "$FONT" ]; then
  echo "session-start: OK — fonte condensada disponível para a capa."
else
  echo "session-start: AVISO — não instalou a fonte condensada (detalhes em $LOG)." >&2
  echo "  O compose-capa.py vai tentar de novo e FALHA se não conseguir — não publique capa no fallback." >&2
fi
