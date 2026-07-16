#!/usr/bin/env bash
# fetch-transcript.sh — busca e limpa a legenda de um morning call do YouTube.
#
# Contexto (achado em 2026-07-16): no sandbox de nuvem, o download de MÍDIA
# (áudio/vídeo) do CDN googlevideo.com retorna 403 de forma consistente —
# então um fallback via Whisper local (baixar áudio + transcrever) NÃO É
# VIÁVEL nesse ambiente. O que funciona é o endpoint de LEGENDA (timedtext),
# que é um host/caminho diferente e não sofre o mesmo bloqueio. Duas causas
# reais de falha na legenda, tratadas separadamente:
#   1) vídeo ainda AO VIVO (is_live=true) — a legenda automática só existe
#      depois que a transmissão termina e é processada. Retry não resolve;
#      só dá para tentar de novo mais tarde na rotina (ou aceitar a falha).
#   2) vídeo já terminou mas a legenda automática ainda não foi processada
#      pelo YouTube (comum nos primeiros ~15-20min após publicação) —
#      aqui RETRY com poucos segundos de intervalo costuma resolver.
# youtube-transcript-api (fallback antigo) fica de fora do caminho principal:
# no sandbox de nuvem ele falha de forma consistente com RequestBlocked
# (IP de cloud provider bloqueado pelo YouTube) — não é flakiness pontual.
#
# USO:
#   agent/fetch-transcript.sh <video_id> <output_dir>
# SAÍDA:
#   <output_dir>/<video_id>.clean.txt  (se sucesso)
#   Código de saída / stdout final:
#     OK               legenda obtida e limpa
#     AINDA_AO_VIVO    vídeo em transmissão — não adianta tentar de novo agora
#     SEM_LEGENDA      vídeo encerrado mas sem legenda após as tentativas
set -uo pipefail

VIDEO_ID="${1:?uso: fetch-transcript.sh <video_id> <output_dir>}"
OUTDIR="${2:?uso: fetch-transcript.sh <video_id> <output_dir>}"
URL="https://youtube.com/watch?v=${VIDEO_ID}"
mkdir -p "$OUTDIR"
cd "$OUTDIR"

# 1) Checagem barata de status (só metadados, não baixa mídia).
IS_LIVE="$(timeout 30 yt-dlp --dump-json --skip-download "$URL" 2>/dev/null \
  | python3 -c "import json,sys
try:
    d=json.load(sys.stdin)
    print('live' if d.get('is_live') else 'ended')
except Exception:
    print('unknown')" 2>/dev/null)"

if [ "$IS_LIVE" = "live" ]; then
  echo "AINDA_AO_VIVO"
  exit 2
fi

# 2) Tenta baixar a legenda, com poucas tentativas rápidas (a legenda de
#    vídeo recém-encerrado pode levar alguns minutos para ser processada).
N=0
MAX_TRIES=4
DELAYS=(0 20 40 60)
while [ $N -lt $MAX_TRIES ]; do
  [ "${DELAYS[$N]}" -gt 0 ] && sleep "${DELAYS[$N]}"
  timeout 60 yt-dlp --skip-download --write-auto-sub --write-sub \
    --sub-lang "pt,pt-BR,pt-orig" --sub-format vtt --convert-subs vtt \
    -o "%(id)s.%(ext)s" "$URL" >/tmp/fetch-transcript-attempt-$$.log 2>&1
  VTT="$(ls "${VIDEO_ID}".pt.vtt "${VIDEO_ID}".pt-BR.vtt "${VIDEO_ID}".pt-orig.vtt 2>/dev/null | head -1)"
  if [ -n "$VTT" ] && [ -s "$VTT" ]; then
    OUT="${OUTDIR}/${VIDEO_ID}.clean.txt"
    grep -v -E "^(WEBVTT|NOTE|Kind:|Language:|$)" "$VTT" \
      | grep -v -E "^[0-9]{2}:[0-9]{2}:[0-9]{2}" \
      | sed -E 's/<[^>]+>//g' \
      | awk '!seen[$0]++' > "$OUT"
    rm -f /tmp/fetch-transcript-attempt-$$.log
    echo "OK (tentativa $((N+1))/${MAX_TRIES}): $OUT"
    exit 0
  fi
  N=$((N+1))
done
rm -f /tmp/fetch-transcript-attempt-$$.log
echo "SEM_LEGENDA (${MAX_TRIES} tentativas, ~2min)"
exit 1
