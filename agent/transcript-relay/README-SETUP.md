# Relay de transcrição do Café com Mercado — setup do servidor (uma vez só)

Por que existe: o sandbox de nuvem da rotina tem IP de datacenter que o
YouTube bloqueia (bot-check no yt-dlp em dias ruins, `RequestBlocked` no
youtube-transcript-api sempre, 403 no CDN de mídia sempre — ver
`agent/PIPELINE-NOTES.md`, incidente 2026-07-16). Este relay roda num servidor
com IP próprio e faz o trabalho de falar com o YouTube:

```
rotina de nuvem (Passo 5)
        │  GET https://SEU-DOMINIO/transcript/<video_id>  (X-Api-Key)
        ▼
servidor próprio 24/7 (este relay)
        │  yt-dlp: detecta live, baixa legenda pt, limpa o VTT
        ▼
JSON com o texto limpo de volta pra rotina
```

O `agent/fetch-transcript.sh` já sabe usar o relay: basta as variáveis
`TRANSCRIPT_RELAY_URL` e `TRANSCRIPT_RELAY_TOKEN` existirem no ambiente da
sessão. Sem elas, ele segue no caminho direto (yt-dlp local), como sempre.

## Opção A — servidor dedicado (novo)

Qualquer VPS Ubuntu 22.04/24.04 pequeno serve (1 GB de RAM já basta — o relay
não guarda estado). Portas **80 e 443** abertas; anote o **IP público**.

```bash
# 1) Docker (se ainda não tiver)
curl -fsSL https://get.docker.com | sh

# 2) Pasta + arquivos
mkdir -p /opt/transcript-relay && cd /opt/transcript-relay
# copie para cá os 5 arquivos desta pasta do repo:
#   app.py  Dockerfile  docker-compose.yml  Caddyfile  env.example

# 3) Configuração
cp env.example .env
openssl rand -hex 24   # → cole em RELAY_TOKEN no .env
# DOMAIN: IP com traços + .sslip.io  (203.0.113.10 → 203-0-113-10.sslip.io)
nano .env

# 4) Subir
docker compose up -d --build
docker compose logs -f transcript-relay   # espere "Uvicorn running"; Ctrl+C sai
```

## Opção B — aproveitar o VPS da Evolution API (WhatsApp)

No `/opt/evolution` do VPS existente:

1. Crie a subpasta e copie `app.py` + `Dockerfile` para
   `/opt/evolution/transcript-relay/`.
2. No `docker-compose.yml` da Evolution, adicione o serviço:
   ```yaml
     transcript-relay:
       build: ./transcript-relay
       container_name: transcript_relay
       restart: always
       environment:
         - RELAY_TOKEN=${RELAY_TOKEN}
       expose:
         - "8000"
   ```
3. No `.env` da Evolution, acrescente `RELAY_TOKEN=` (gere com
   `openssl rand -hex 24`).
4. No `Caddyfile` da Evolution, acrescente um bloco com subdomínio (sslip.io
   resolve qualquer subdomínio para o mesmo IP, sem DNS):
   ```
   transcript.{$DOMAIN} {
   	reverse_proxy transcript-relay:8000
   }
   ```
5. `docker compose up -d --build` e pronto — a URL fica
   `https://transcript.SEU-DOMINIO`.

## Teste (do PC ou de qualquer lugar)

```bash
# saúde (sem chave)
curl -s https://SEU-DOMINIO/health

# transcrição de verdade — use um morning call recente do inventário
curl -s -H "X-Api-Key: SUA_CHAVE" \
  https://SEU-DOMINIO/transcript/xZR86FU0N_U | python3 -m json.tool | head
```

Esperado: `"status": "ok"` com `"lines"` na casa das centenas. Se vier
`"error"` com cara de bot-check/403, o IP DESSE servidor também está mal visto
pelo YouTube — teste antes de considerar o setup concluído (é raro em VPS
pequeno de provedor comum, mas acontece; nesse caso trocar de VPS/região é
mais fácil que insistir).

## Conectar a rotina de nuvem (última etapa)

No painel do Claude Code on the web, no **environment** da rotina do Café
(onde já vive o `GITHUB_PAT_COWORK`), adicione:

- `TRANSCRIPT_RELAY_URL` = `https://SEU-DOMINIO` (opção A) ou
  `https://transcript.SEU-DOMINIO` (opção B)
- `TRANSCRIPT_RELAY_TOKEN` = o RELAY_TOKEN do .env

Nada mais muda: na próxima rodada o `fetch-transcript.sh` detecta as
variáveis e passa a usar o relay primeiro, com o yt-dlp local como reserva.

## Operação

- **Logs:** `docker compose logs -f transcript-relay`
- **Atualizar yt-dlp:** o contêiner já se atualiza a cada boot
  (`docker compose restart transcript-relay` força).
- **Trocar a chave:** edite `RELAY_TOKEN` no `.env`, `docker compose up -d`,
  e atualize `TRANSCRIPT_RELAY_TOKEN` no environment da rotina.
