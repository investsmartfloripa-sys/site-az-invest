#!/usr/bin/env bash
# bootstrap.sh — instala o relay de transcrição num servidor Ubuntu limpo.
#
# USO (uma linha, dentro da sessão SSH do servidor, como root):
#   curl -fsSL https://raw.githubusercontent.com/investsmartfloripa-sys/site-az-invest/main/agent/transcript-relay/bootstrap.sh | bash
#
# O script é idempotente: rodar de novo reaproveita o .env (mesma chave/domínio)
# e só recompõe o que faltar. Ao final imprime os dois valores que vão no
# environment da rotina (TRANSCRIPT_RELAY_URL / TRANSCRIPT_RELAY_TOKEN) e o
# resultado de um teste real contra o YouTube.
set -euo pipefail

log() { echo; echo "==== $* ===="; }

[ "$(id -u)" = "0" ] || { echo "ERRO: rode como root (entre com: sudo -i)"; exit 1; }
export DEBIAN_FRONTEND=noninteractive

log "1/6 dependências básicas"
apt-get update -qq
apt-get install -y -qq curl openssl ca-certificates >/dev/null

log "2/6 Docker"
if command -v docker >/dev/null 2>&1; then
  echo "docker já instalado: $(docker --version)"
else
  curl -fsSL https://get.docker.com | sh
fi

log "3/6 arquivos do relay (repo público)"
mkdir -p /opt/transcript-relay
cd /opt/transcript-relay
BASE="https://raw.githubusercontent.com/investsmartfloripa-sys/site-az-invest/main/agent/transcript-relay"
for f in app.py Dockerfile docker-compose.yml Caddyfile; do
  curl -fsSL "$BASE/$f" -o "$f"
  echo "ok: $f"
done

mkdir -p cookies

log "4/6 configuração (.env)"
if [ -f .env ] && grep -q "^RELAY_TOKEN=." .env && grep -q "^DOMAIN=." .env; then
  echo "reaproveitando .env existente (mesma chave e domínio)"
else
  TOKEN="$(openssl rand -hex 24)"
  IP="$(curl -fsS https://api.ipify.org)"
  DOMAIN="${IP//./-}.sslip.io"
  printf 'RELAY_TOKEN=%s\nDOMAIN=%s\n' "$TOKEN" "$DOMAIN" > .env
  echo "gerado .env novo (domínio: $DOMAIN)"
fi
set -a; . ./.env; set +a

log "5/6 subindo contêineres (o build pode levar alguns minutos)"
# Dois cenários:
#   A) servidor dedicado — sobe relay + caddy próprio (compose completo);
#   B) mesmo VPS da Evolution API (WhatsApp) — o caddy da Evolution já ocupa
#      as portas 80/443. Nesse caso sobe SÓ o relay e o pendura no caddy
#      existente com o subdomínio transcript.<dominio-da-evolution>.
if docker ps --format '{{.Names}}' | grep -q '^evolution_caddy$'; then
  echo "detectado caddy da Evolution nas portas 80/443 — integrando (cenário B)"
  docker rm -f transcript_caddy >/dev/null 2>&1 || true
  docker compose up -d --build transcript-relay

  EVODIR="/opt/evolution"
  [ -f "$EVODIR/.env" ] || { echo "ERRO: $EVODIR/.env não encontrado — a Evolution não está em /opt/evolution?"; exit 1; }
  EVODOMAIN="$(grep '^DOMAIN=' "$EVODIR/.env" | head -1 | cut -d= -f2 | tr -d '[:space:]')"
  [ -n "$EVODOMAIN" ] || { echo "ERRO: DOMAIN vazio em $EVODIR/.env"; exit 1; }
  DOMAIN="transcript.${EVODOMAIN}"
  sed -i "s/^DOMAIN=.*/DOMAIN=${DOMAIN}/" .env

  # rota no Caddyfile da Evolution (idempotente)
  if ! grep -q 'transcript_relay:8000' "$EVODIR/Caddyfile"; then
    printf '\ntranscript.{$DOMAIN} {\n\treverse_proxy transcript_relay:8000\n}\n' >> "$EVODIR/Caddyfile"
    echo "rota adicionada ao Caddyfile da Evolution"
  fi

  # coloca o relay na rede do caddy da Evolution (DNS pelo nome do contêiner)
  EVONET="$(docker inspect evolution_caddy -f '{{range $k,$_ := .NetworkSettings.Networks}}{{$k}} {{end}}' | awk '{print $1}')"
  docker network connect "$EVONET" transcript_relay >/dev/null 2>&1 || true
  docker restart evolution_caddy >/dev/null
  echo "caddy da Evolution recarregado com a nova rota (interrupção de ~2s)"
else
  docker compose up -d --build
fi

log "6/6 verificação"
echo -n "aguardando HTTPS (certificado Let's Encrypt) "
OK=0
for _ in $(seq 1 36); do
  if curl -fsS -m 5 "https://${DOMAIN}/health" >/dev/null 2>&1; then OK=1; break; fi
  echo -n "."
  sleep 5
done
echo
if [ "$OK" != "1" ]; then
  echo "AVISO: /health não respondeu em ~3min. Cheque:"
  echo "  - portas 80/443 abertas no firewall do provedor?"
  echo "  - docker compose logs caddy   (certificado)"
  echo "  - docker compose logs transcript-relay"
  exit 1
fi
echo "health: $(curl -s "https://${DOMAIN}/health")"

echo
echo "---- teste real contra o YouTube (morning call XP 16/07) ----"
curl -s -m 150 -H "X-Api-Key: ${RELAY_TOKEN}" \
  "https://${DOMAIN}/transcript/xZR86FU0N_U" | head -c 300
echo
echo "(esperado: \"status\": \"ok\" seguido do texto; \"error\"/bot-check = IP deste servidor também bloqueado)"

echo
echo "==== COPIE ESTES DOIS VALORES PARA O ENVIRONMENT DA ROTINA ===="
echo "TRANSCRIPT_RELAY_URL=https://${DOMAIN}"
echo "TRANSCRIPT_RELAY_TOKEN=${RELAY_TOKEN}"
