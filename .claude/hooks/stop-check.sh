#!/bin/bash
# Stop hook: ao fim de cada resposta do Claude, avisa QUEM ESTÁ USANDO se há
# commits locais que ainda não subiram para o GitHub. É só aviso (systemMessage):
# não bloqueia nem manda o Claude empurrar sozinho — em máquina de colaborador o
# destino certo é uma branch com PR, não a main.
#
# Barato de propósito (sem fetch): roda depois de toda resposta.

cd "${CLAUDE_PROJECT_DIR:-.}" 2>/dev/null || exit 0
git rev-parse --git-dir >/dev/null 2>&1 || exit 0

branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)
msg=""
if upstream=$(git rev-parse --abbrev-ref '@{u}' 2>/dev/null); then
  ahead=$(git rev-list --count "$upstream..HEAD" 2>/dev/null || echo 0)
  [ "$ahead" -gt 0 ] 2>/dev/null && msg="$ahead commit(s) na branch $branch ainda não foram enviados ao GitHub. Os colegas não enxergam trabalho que ficou só neste PC."
elif [ "$branch" != "main" ] && git rev-parse --verify -q origin/main >/dev/null; then
  ahead=$(git rev-list --count origin/main..HEAD 2>/dev/null || echo 0)
  [ "$ahead" -gt 0 ] 2>/dev/null && msg="A branch $branch tem $ahead commit(s) e nunca foi enviada: git push -u origin $branch e abra o PR."
fi

if [ -n "$msg" ]; then
  # JSON mínimo; a mensagem não tem aspas nem barras invertidas.
  printf '{"systemMessage": "%s"}\n' "$msg"
fi
exit 0
