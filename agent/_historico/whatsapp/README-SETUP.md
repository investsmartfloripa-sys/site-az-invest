# Canal WhatsApp do Café com Mercado — setup do gateway (uma vez só)

Arquitetura (decidida em 07/2026):

```
edição nova mergeada na main
        │
        ▼
GitHub Action (whatsapp-notify.yml)        ← "chamada http"
  espera a página do dia responder 200,
  monta capa + resumo + link e faz curl
        │
        ▼
VPS próprio 24/7 (Evolution API v2)        ← "vps próprio"
  sessão WhatsApp autenticada por QR,       ← "sessão autenticada"
  mantida viva no VPS
        │
        ▼
grupo do WhatsApp recebe automaticamente   ← "grupo whatsapp"
```

A rotina de nuvem do Café **não muda nada**: ela continua só publicando a
edição. Quem avisa o grupo é o repositório, no merge. Isso também cobre
edições publicadas manualmente do PC.

> **Aviso importante (número):** Evolution API usa o protocolo do WhatsApp
> Web (não é a API oficial da Meta — a oficial não posta em grupo). Para
> volume baixo (1 msg/dia) o risco é pequeno, mas **use um número dedicado**
> (chip pré-pago), nunca o seu número pessoal de assessor.

## Passo 1 — VPS (ação sua, ~10 min)

Qualquer VPS Ubuntu 22.04/24.04 com **2 GB de RAM** serve (~R$ 20–40/mês):
Hostinger VPS, Contabo, Hetzner, DigitalOcean. Requisitos:
- portas **80 e 443** abertas (padrão na maioria);
- anotar o **IP público** (ex.: `203.0.113.10`).

## Passo 2 — subir o gateway (colar no terminal do VPS)

```bash
# 0) Swap de 2 GB (essencial em VPS de 1 GB; inofensivo nos maiores)
fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab

# 1) Docker
curl -fsSL https://get.docker.com | sh

# 2) Pasta + arquivos
mkdir -p /opt/evolution && cd /opt/evolution
# copie para cá os 3 arquivos desta pasta do repo:
#   docker-compose.yml   Caddyfile   env.example
# (scp, ou cole o conteúdo com nano/cat — são pequenos)

# 3) Configuração
cp env.example .env
openssl rand -hex 24   # → cole em EVOLUTION_APIKEY no .env
openssl rand -hex 16   # → cole em POSTGRES_PASSWORD no .env
# DOMAIN: IP com traços + .sslip.io  (203.0.113.10 → 203-0-113-10.sslip.io)
nano .env

# 4) Subir
docker compose up -d
docker compose logs -f api   # espere "HTTP - ON: 8080"; Ctrl+C para sair
```

Teste do PC: `https://SEU-DOMINIO/` deve responder (JSON de boas-vindas da
Evolution API, já com cadeado HTTPS válido).

## Passo 3 — criar a instância e escanear o QR (celular com o chip dedicado)

Abra `https://SEU-DOMINIO/manager`, entre com a `EVOLUTION_APIKEY` e:
1. **+ Instance** → nome **`azinvest`** (integração Baileys) → salvar;
2. clique na instância → **Get QR Code**;
3. no celular do número dedicado: WhatsApp → Aparelhos conectados →
   Conectar um aparelho → escanear.

O estado deve ficar **open/connected**. A sessão fica viva no VPS (volume
`evolution_instances` sobrevive a reboot; `restart: always` religa tudo).

Depois, **adicione o número dedicado ao grupo** de destino.

## Passo 4 — descobrir o JID do grupo

```bash
curl -s -H "apikey: SUA_CHAVE" \
  "https://SEU-DOMINIO/group/fetchAllGroups/azinvest?getParticipants=false" \
  | python3 -m json.tool | grep -B2 -A2 subject
```

Procure o grupo pelo `subject` (nome) e copie o `id` — formato
`120363XXXXXXXXXXX@g.us`.

## Passo 5 — segredos no GitHub (do seu PC, logado no gh)

```bash
cd site-az-invest
gh secret set EVOLUTION_URL       --body "https://SEU-DOMINIO"
gh secret set EVOLUTION_APIKEY    --body "SUA_CHAVE"
gh secret set EVOLUTION_INSTANCE  --body "azinvest"
gh secret set WHATSAPP_GROUP_JID  --body "120363XXXXXXXXXXX@g.us"
```

## Passo 6 — teste de ponta a ponta

```bash
gh workflow run whatsapp-notify.yml -f date=2026-07-15   # uma edição já no ar
gh run watch
```

A capa com legenda deve chegar no grupo em ~1 min. A partir daí, **toda
edição nova posta sozinha** no merge (a espera pelo deploy já está no
workflow — ele nunca anuncia link quebrado).

## Operação

- **Caiu a sessão** (celular desconectou o aparelho): abrir `/manager`,
  Get QR Code, escanear de novo. Nada mais muda.
- **Logs de envio:** aba Actions do repo → workflow `whatsapp-notify`.
- **Logs do gateway:** `docker compose logs -f api` no VPS.
- **Atualizar o gateway:** `docker compose pull && docker compose up -d`.
- **Edição atualizada** (ex.: repostagem pós-CPI) **não** re-notifica o
  grupo — só arquivo de edição **novo** dispara o aviso.
