#!/usr/bin/env bash
# fetch-transcript.sh — busca e limpa a legenda de um morning call do YouTube.
#
# CAMINHOS, em ordem de preferência:
#   1) RELAY próprio (agent/transcript-relay/ num servidor 24/7 com IP limpo),
#      usado quando TRANSCRIPT_RELAY_URL + TRANSCRIPT_RELAY_TOKEN existem no
#      ambiente. É o caminho robusto: o YouTube bloqueia IP de datacenter do
#      sandbox de nuvem de forma intermitente (bot-check/429 no yt-dlp — em
#      15/07/2026 derrubou TODOS os vídeos) ou estrutural (RequestBlocked no
#      youtube-transcript-api; 403 no CDN de mídia — por isso Whisper local
#      também não é saída). O relay tira o YouTube da frente do sandbox.
#   2) DIRETO (yt-dlp local, endpoint de legenda) — reserva quando o relay não
#      está configurado ou falhou; funciona na maioria dos dias.
#
# Duas causas reais de falha de legenda, tratadas separadamente:
#   a) vídeo ainda AO VIVO (is_live=true) — legenda automática só existe
#      depois que a transmissão termina e é processada. Retry não resolve;
#      tentar de novo mais tarde na rotina (ou aceitar a falha).
#   b) vídeo já terminou mas a legenda ainda não foi processada (comum nos
#      primeiros ~15-20min após publicação) — aqui RETRY resolve.
#
# USO:
#   agent/fetch-transcript.sh <video_id> <output_dir>
# SAÍDA:
#   <output_dir>/<video_id>.clean.txt  (se sucesso)
#   Código de saída / stdout final:
#     OK               legenda obtida e limpa (indica se veio do relay)
#     AINDA_AO_VIVO    vídeo em transmissão — não adianta tentar de novo agora
#     SEM_LEGENDA      vídeo encerrado mas sem legenda após as tentativas
set -uo pipefail

VIDEO_ID="${1:?uso: fetch-transcript.sh <video_id> <output_dir>}"
OUTDIR="${2:?uso: fetch-transcript.sh <video_id> <output_dir>}"
URL="https://youtube.com/watch?v=${VIDEO_ID}"
mkdir -p "$OUTDIR"
OUT="${OUTDIR}/${VIDEO_ID}.clean.txt"

RELAY_URL="${TRANSCRIPT_RELAY_URL:-}"
RELAY_TOKEN="${TRANSCRIPT_RELAY_TOKEN:-}"

MAX_TRIES=4
DELAYS=(0 20 40 60)

# ---------- caminho 1: relay próprio ----------
# Uma chamada por rodada do loop de retry (o relay é single-shot; o retry para
# "legenda ainda não processada" fica aqui do lado do cliente).
try_relay() {  # -> 0 ok | 2 live | 1 sem legenda/erro (cai pro direto)
  local resp status
  resp="$(curl -fsS -m 150 -H "X-Api-Key: ${RELAY_TOKEN}" \
    "${RELAY_URL%/}/transcript/${VIDEO_ID}" 2>/dev/null)" || return 1
  status="$(printf '%s' "$resp" | python3 -c "import json,sys
try: print(json.load(sys.stdin).get('status','error'))
except Exception: print('error')" 2>/dev/null)"
  case "$status" in
    ok)
      printf '%s' "$resp" | python3 -c "import json,sys
print(json.load(sys.stdin)['text'])" > "$OUT" 2>/dev/null || return 1
      [ -s "$OUT" ] || return 1
      return 0;;
    live) return 2;;
    *)    return 1;;
  esac
}

# ---------- caminho 2: direto (yt-dlp local) ----------
direct_is_live() {  # -> imprime live|ended|unknown
  timeout 30 yt-dlp --dump-json --skip-download "$URL" 2>/dev/null \
    | python3 -c "import json,sys
try:
    d=json.load(sys.stdin)
    print('live' if d.get('is_live') else 'ended')
except Exception:
    print('unknown')" 2>/dev/null
}

try_direct() {  # -> 0 ok | 1 falhou nesta rodada
  ( cd "$OUTDIR" && timeout 60 yt-dlp --skip-download --write-auto-sub --write-sub \
      --sub-lang "pt,pt-BR,pt-orig" --sub-format vtt --convert-subs vtt \
      -o "%(id)s.%(ext)s" "$URL" ) >/tmp/fetch-transcript-attempt-$$.log 2>&1
  local vtt
  vtt="$(ls "${OUTDIR}/${VIDEO_ID}".pt.vtt "${OUTDIR}/${VIDEO_ID}".pt-BR.vtt \
          "${OUTDIR}/${VIDEO_ID}".pt-orig.vtt 2>/dev/null | head -1)"
  [ -n "$vtt" ] && [ -s "$vtt" ] || return 1
  grep -v -E "^(WEBVTT|NOTE|Kind:|Language:|$)" "$vtt" \
    | grep -v -E "^[0-9]{2}:[0-9]{2}:[0-9]{2}" \
    | sed -E 's/<[^>]+>//g' \
    | awk '!seen[$0]++' > "$OUT"
  [ -s "$OUT" ]
}

# ---------- orquestração ----------
HAVE_RELAY=0
[ -n "$RELAY_URL" ] && [ -n "$RELAY_TOKEN" ] && HAVE_RELAY=1

# Sem relay, detecção de live é feita aqui (com relay, ele mesmo responde
# "live" na primeira chamada — checagem separada seria redundante).
if [ "$HAVE_RELAY" = "0" ] && [ "$(direct_is_live)" = "live" ]; then
  echo "AINDA_AO_VIVO"
  exit 2
fi

N=0
while [ $N -lt $MAX_TRIES ]; do
  [ "${DELAYS[$N]}" -gt 0 ] && sleep "${DELAYS[$N]}"
  if [ "$HAVE_RELAY" = "1" ]; then
    try_relay; RC=$?
    if [ $RC -eq 0 ]; then
      rm -f /tmp/fetch-transcript-attempt-$$.log
      echo "OK (relay, tentativa $((N+1))/${MAX_TRIES}): $OUT"
      exit 0
    elif [ $RC -eq 2 ]; then
      echo "AINDA_AO_VIVO (via relay)"
      exit 2
    fi
  fi
  # caminho direto: principal sem relay; reserva quando o relay falhou
  if try_direct; then
    rm -f /tmp/fetch-transcript-attempt-$$.log
    echo "OK (direto, tentativa $((N+1))/${MAX_TRIES}): $OUT"
    exit 0
  fi
  N=$((N+1))
done

rm -f /tmp/fetch-transcript-attempt-$$.log
echo "SEM_LEGENDA (${MAX_TRIES} tentativas)"
exit 1
