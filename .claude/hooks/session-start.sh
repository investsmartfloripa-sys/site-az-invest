#!/bin/bash
# SessionStart hook. O que ele imprime entra no contexto do Claude.
#
# 1. Estado do repo (local e nuvem): atrás/à frente da origin, arquivos soltos.
#    Existe porque várias pessoas e agentes trabalham aqui com o mesmo login do
#    GitHub: começar editando código velho ou commitar o que outra sessão deixou
#    pela metade são os dois erros que mais custam.
# 2. Papel desta máquina (só local): `git config az.papel` = dono | colaborador.
#    Sem configuração vale colaborador, que é o lado seguro. Regras no AGENTS.md §0.
# 3. Sync dos repos de apoio (só local): lê ~/.az-sync/status.json, gravado pela
#    tarefa agendada "AZ Sync Apoio", e avisa se algum repo ficou em conflito.
# 4. Fonte da capa do Café com Mercado (só nuvem) — incidente 2026-07-10: o
#    sandbox vem só com DejaVuSans-Bold (larga); a capa usa DejaVu Sans
#    Condensed Bold (fonts-dejavu-extra). Instalação idempotente.
#
# Nunca falha a sessão: todo passo é protegido e o hook sai com 0.

cd "${CLAUDE_PROJECT_DIR:-.}" 2>/dev/null || exit 0

echo "== Estado do repo site-az-invest (hook de início de sessão) =="

if git rev-parse --git-dir >/dev/null 2>&1; then
  branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)
  GIT_TERMINAL_PROMPT=0 git fetch -q origin 2>/dev/null
  if git rev-parse --verify -q origin/main >/dev/null; then
    behind=$(git rev-list --count HEAD..origin/main 2>/dev/null || echo 0)
    [ "$behind" -gt 0 ] 2>/dev/null && echo "- Branch $branch está $behind commit(s) ATRÁS da origin/main. Rode git pull --rebase antes de editar."
  fi
  if upstream=$(git rev-parse --abbrev-ref '@{u}' 2>/dev/null); then
    ahead=$(git rev-list --count "$upstream..HEAD" 2>/dev/null || echo 0)
    [ "$ahead" -gt 0 ] 2>/dev/null && echo "- $ahead commit(s) locais ainda sem push para $upstream."
  fi
  dirty=$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')
  if [ "$dirty" -gt 0 ] 2>/dev/null; then
    echo "- $dirty arquivo(s) modificados ou não rastreados de antes desta sessão. Não são seus: não commite, não apague, não use git add ."
  fi
  [ "$branch" != "main" ] && echo "- Você está na branch $branch, não na main."
fi

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  papel=$(git config --get az.papel 2>/dev/null)
  case "$papel" in
    dono)
      echo "- Papel desta máquina: DONO. Pode publicar direto: commit dos seus arquivos e git push origin main." ;;
    colaborador)
      echo "- Papel desta máquina: COLABORADOR. Não empurre para a main: trabalhe numa branch <seu-nome>/<assunto>, faça push dela e abra PR com gh pr create. Quem faz o merge é o dono." ;;
    *)
      echo "- Papel desta máquina: NÃO CONFIGURADO, vale COLABORADOR (branch + PR, nunca push na main). O dono configura com: git config az.papel dono" ;;
  esac

  status="$HOME/.az-sync/status.json"
  if [ -f "$status" ]; then
    problemas=$(awk '/"repo":/ {r=$0} /"result":/ { if ($0 ~ /conflito|falhou/) { gsub(/.*"repo": *"|",?$/, "", r); gsub(/.*"result": *"|",?$/, ""); print r " (" $0 ")" } }' "$status" 2>/dev/null)
    [ -n "$problemas" ] && echo "- Sync dos repos de apoio com problema: $problemas. Detalhes em ~/.az-sync/sync.log; resolver com git pull --rebase na pasta."
    if [ -n "$(find "$status" -mmin +180 2>/dev/null)" ]; then
      echo "- A tarefa AZ Sync Apoio não roda há mais de 3 horas (status.json antigo): os repos de apoio podem estar desatualizados no GitHub."
    fi
  fi
fi

echo "(Regras de trabalho em equipe: AGENTS.md §0. Armadilhas técnicas: docs/ARMADILHAS.md.)"

# Fonte da capa — só na nuvem. No PC local a fonte já existe e não se usa apt.
if [ "${CLAUDE_CODE_REMOTE:-}" = "true" ]; then
  FONT="/usr/share/fonts/truetype/dejavu/DejaVuSansCondensed-Bold.ttf"
  if [ -f "$FONT" ]; then
    echo "session-start: fonte da capa (DejaVu Sans Condensed Bold) já presente."
  else
    echo "session-start: instalando fonts-dejavu-extra (fonte padrão da capa)..."
    # Sandbox novo pode vir sem as listas do apt — sem o update o install falha
    # em silêncio (causa provável da capa fora do padrão em 2026-07-15).
    LOG=/tmp/session-start-font.log
    { apt-get update -qq && apt-get install -y --no-install-recommends fonts-dejavu-extra; } >"$LOG" 2>&1 || true
    if [ -f "$FONT" ]; then
      echo "session-start: OK — fonte condensada disponível para a capa."
    else
      echo "session-start: AVISO — não instalou a fonte condensada (detalhes em $LOG)." >&2
      echo "  O compose-capa.py vai tentar de novo e FALHA se não conseguir — não publique capa no fallback." >&2
    fi
  fi
fi

exit 0
