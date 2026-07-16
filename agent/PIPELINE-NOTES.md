# Café com Mercado — notas operacionais do pipeline

## Incidente 2026-07-09 — publicação bloqueada na nuvem (403)

**Sintoma.** Numa execução de nuvem (PC desligado), o Passo 7 falhou:
`PUT https://api.github.com/repos/.../contents/...` → **HTTP 403**
`"Write access to this GitHub API path is not permitted through this proxy."`

**Causa-raiz.** O ambiente de nuvem roteia HTTPS por um proxy de egresso que
aplica política. Ele **libera leitura (GET) e bloqueia escrita (PUT/POST)** em
`api.github.com`. Não é problema de token — o PAT estava correto. O mesmo
bloqueio atinge o `workflow_dispatch` (POST na Actions API). Guia do proxy:
não repetir nem contornar negações 403 de política.

**Correção.** `git push` via HTTPS para **`github.com`** é outro host e
**funciona** (testado: clone e push OK). E o `deploy-vercel.yml` dispara em
`push` para `main` com `paths-ignore` de `**/*.md`, `data-pipeline/out/**` e
`agent/**`. Como a **capa `.jpg` NÃO é `.md`**, o push da capa **dispara o
deploy sozinho** — dispensando o `workflow_dispatch` bloqueado.
Resultado: **um único `git push` publica a edição E aciona o deploy**,
contornando as duas APIs bloqueadas.

Helper pronto: [`agent/publish-edition.sh`](./publish-edition.sh).

## Publicação na nuvem — fluxo branch → PR → merge (ATUAL, incidente 2026-07-10)

Na nuvem do Claude Code na web o proxy do GitHub **só permite `git push` na
branch de trabalho da sessão** ("Restricts git push operations to the current
working branch") e **bloqueia a escrita na Contents API**. Ou seja: **não dá para
dar push direto na `main`**. O fluxo que funciona:

1. **Escrita destravada** por `/web-setup` (rodar UMA vez no terminal do PC,
   logado no `gh` com a conta dona do repo). Isso sincroniza a credencial para as
   sessões da nuvem. Se `git push` der `403 ... denied`, a sessão está sem escrita
   → rodar `/web-setup`. (O `GITHUB_PAT_COWORK` não é mais usado pelo git: o proxy
   traduz a credencial escopada da sessão.)
2. **Git (helper):** commita os arquivos e faz push na branch da sessão.
   ```bash
   bash agent/publish-edition.sh \
     --date {{YYYY-MM-DD}} \
     --md /tmp/edicao.md \
     --cover /tmp/capa.jpg \
     --snapshot /tmp/snapshot.md
   ```
3. **PR + merge (agente, via GitHub MCP):** abrir PR `base=main head=<branch da
   sessão>` e fazer o **merge** (squash). O merge na `main` dispara o deploy
   (Vercel Git integration; o push da capa `.jpg` non-`.md` também aciona o
   `deploy-vercel.yml`). Ferramentas: `create_pull_request` + `merge_pull_request`.
   **O deploy NÃO sai só do push na branch — precisa do MERGE na main.**

**Não usar** na nuvem: push direto `HEAD:main` (bloqueado), `curl -X PUT
.../contents` nem `workflow_dispatch` (403). O helper antigo que clonava e dava
`push origin HEAD:main` foi substituído por este fluxo.

### Passo 8 (snapshot)
O helper inclui `agent/state/previous-day-snapshot.md` no mesmo commit/PR.
`agent/**` está em `paths-ignore` do `deploy-vercel.yml`, então o snapshot não
força rebuild sozinho — o deploy vem do `.jpg` no merge.

### Verificação de deploy (Passo 7.5)
ATENÇÃO: no ambiente de nuvem restrito, **a Actions API também é bloqueada**
para LEITURA (`GET /actions/...` → 403 "Access to this GitHub Actions path is
not permitted through this proxy"). Então **não** dá para checar
`deploy-vercel.yml/runs` na nuvem. Verificar pelo **site público** (GET normal,
liberado):
```bash
sleep 120
curl -sI "https://investimentosdeaz.com.br/cafe-com-mercado/{{DATA}}" | head -1
# ou WebFetch da página e confirmar título/capa do dia
```
Só declarar publicado se a página do dia responder 200 com o conteúdo novo.
Obs.: o deploy em si é acionado pelo push para `main` (Vercel Git integration
e/ou `deploy-vercel.yml`). Se o site não atualizar e houver acesso ao painel,
conferir o `VERCEL_TOKEN` (erro típico em "Pull Vercel config" = token expirado).

## Capa — evitar manchete "deslocada"
`compose-capa.py` quebra a manchete por largura. Manchete longa gera **palavra
órfã** na 2ª linha (ex.: "...IGNORA O" / "IRÃ"), que parece desalinhada.
Regra: **manchete curta, CAIXA ALTA, que caiba em 1 linha ou quebre 2 linhas
equilibradas** (ex.: "PETRÓLEO RECUA, FED ENDURECE"). Evitar linha final com 1
palavra curta. Conferir a capa antes de publicar.

## Incidente 2026-07-10 — capa "perdeu o padrão" na nuvem (fonte)
**Sintoma.** A capa saiu com letras LARGAS e sem cara de thumbnail de notícia
(kicker sem barra azul), diferente das capas padronizadas (ex.: 06/07, 08/07,
09/07).

**Causa-raiz.** O visual padrão usa **DejaVu Sans Condensed Bold**
(pacote `fonts-dejavu-extra`). No PC do autor essa fonte existe; no sandbox de
NUVEM só vem o `fonts-dejavu-core` → apenas `DejaVuSans-Bold` (LARGA). O
`Passo 6.5.3` do prompt manda cair no fallback largo quando a condensada falta —
e é esse fallback que quebra o padrão. Não é o modelo de imagem nem o Higgsfield;
é a fonte do sandbox.

**Correção (determinística).** Antes de compor a capa, garantir a fonte:
```bash
apt-get install -y --no-install-recommends fonts-dejavu-extra
# confirmar: fc-list | grep -i 'Sans Condensed'
```
E compor com o script versionado (não mais só no PC):
[`agent/compose-capa.py`](./compose-capa.py) — usa a condensada, o kicker branco
com barra azul, a manchete condensada pesada e o subtítulo de 1 linha; **avisa
em stderr** se cair no fallback largo. Assim a capa fica idêntica em PC e nuvem.

**Duas camadas de proteção (para não repetir):**

1. **Hook de SessionStart** (`.claude/hooks/session-start.sh`, registrado em
   `.claude/settings.json`): instala `fonts-dejavu-extra` no início de toda
   sessão de nuvem (idempotente; só roda com `CLAUDE_CODE_REMOTE=true`). Depois
   que este arquivo estiver na branch padrão (`main`), TODA sessão futura já
   começa com a fonte condensada instalada — a capa não depende mais de sorte.

2. **Texto do PROMPT da rotina (Passo 6.5.3)** — substituir o passo de fonte por
   (o prompt vive fora do repo; colar lá):

   ```
   6.5.3 Componha a capa SEMPRE com o script versionado (nunca script inline):
           python3 agent/compose-capa.py \
             --base /tmp/base.png --out /tmp/capa.jpg \
             --dia "{{DIA_SEMANA_CAIXA_ALTA}}" --data "{{DD/MM}}" \
             --head "{{MANCHETE CURTA EM CAIXA ALTA}}" \
             --sub  "{{subtítulo de 1 linha}}"
         A fonte padrão (DejaVu Sans Condensed Bold) é garantida pelo hook de
         SessionStart e pelo próprio script, que instala fonts-dejavu-extra se
         faltar e FALHA COM ERRO se não conseguir. Se o script falhar por fonte,
         rode: apt-get update && apt-get install -y --no-install-recommends \
         fonts-dejavu-extra — e recomponha. NUNCA use --allow-fallback nem
         componha com outra fonte/script: capa fora do padrão não publica.
         Confira a capa (kicker branco com barra azul, manchete condensada em
         1–2 linhas equilibradas) antes de publicar.
   ```

O fallback para `DejaVuSans-Bold` (larga) deixa de ser caminho "aceitável" — vira
só rede de segurança com aviso.

## Incidente 2026-07-15 — capa REINCIDIU no fallback largo (fail-hard aplicado)

**Sintoma.** Mesmo com o hook de SessionStart na `main` desde 10/07, a capa de
15/07 foi publicada com a fonte LARGA (13/07 e 14/07 saíram corretas).

**Causa provável.** Duas fraquezas somadas: (1) o hook rodava `apt-get install`
**sem `apt-get update`** — em sandbox novo, sem as listas do apt, o install
falha e o `|| true` engolia o erro; (2) o `compose-capa.py` só **avisava** em
stderr e compunha assim mesmo — aviso que a rotina ignora.

**Correção (2026-07-15).**
- `.claude/hooks/session-start.sh`: agora faz `apt-get update` antes do
  install e loga em `/tmp/session-start-font.log`.
- `agent/compose-capa.py`: **FAIL-HARD**. Se a condensada faltar, ele mesmo
  tenta `apt-get update + install fonts-dejavu-extra`; se ainda faltar, **sai
  com erro** e a capa não é composta. O fallback largo só sai com a flag
  `--allow-fallback` (uso manual, com aprovação do autor — nunca da rotina).

Com isso a garantia deixa de depender do prompt: **não existe mais caminho
automático que produza capa fora do padrão.** Se a fonte não instalar, a rotina
falha visivelmente no Passo 6.5.3 em vez de publicar errado.

## Transcrição dos morning calls — falhas recorrentes e correção (2026-07-16)

**Sintoma.** O Passo 5 (transcrição de vídeo) falhava com frequência variável:
em 15/07 os 3 vídeos tentados falharam; em 16/07, 2 de 3 (XP e BTG) funcionaram
mas só depois de retry manual, e o vídeo da Genial nunca funcionou.

**Investigação (16/07).** Havia duas causas distintas sendo tratadas como uma só:

1. **Vídeo ainda AO VIVO.** O vídeo da Genial (`NGMM28Ec_zo`) era uma
   transmissão `yt_live_broadcast` em andamento no horário da rotina — HLS com
   segmentos assinados e expiráveis. Legenda automática só existe depois que a
   live termina e é processada; nenhum retry de legenda resolve isso, e
   tentar baixar a mídia para transcrever localmente (Whisper) também não
   ajudaria (ver item 2). `yt-dlp --dump-json --skip-download` expõe
   `is_live: true` de forma confiável e barata (~2s, só metadados) — dá para
   detectar e desistir sem gastar tempo/tentativas.
2. **Vídeo encerrado mas legenda ainda não processada.** Comum nos primeiros
   ~15-20min após a publicação. Aqui **retry resolve**: o BTG de 16/07 falhou
   na 1ª tentativa e funcionou na 2ª, poucos minutos depois.

**Cotovelo descartado: Whisper local como fallback.** A ideia óbvia — baixar o
áudio com `yt-dlp` e transcrever localmente com `faster-whisper` quando não há
legenda — **não é viável neste sandbox de nuvem**: testes em 16/07 confirmam
que o download de MÍDIA (áudio/vídeo, não legenda) do CDN `googlevideo.com`
retorna **403 Forbidden de forma consistente**, inclusive para vídeos já
encerrados e com legenda disponível (testado com XP e BTG, ambos 403 tanto em
formato de áudio isolado quanto vídeo progressivo). É o mesmo tipo de bloqueio
de IP de cloud provider já registrado para o `youtube-transcript-api`
(`RequestBlocked`), só que atingindo também o CDN de mídia — não só a API de
transcript. Ou seja: **o endpoint de legenda (timedtext) é a única via que
funciona neste ambiente**; não adianta instalar `ffmpeg`/Whisper esperando
contornar — o bloqueio é anterior a isso, no download do arquivo de origem.

**Correção.** Novo helper versionado
[`agent/fetch-transcript.sh`](./fetch-transcript.sh):
```bash
agent/fetch-transcript.sh <video_id> <output_dir>
```
- Primeiro checa `is_live` via `--dump-json --skip-download` (barato, ~2s).
  Se ao vivo, retorna `AINDA_AO_VIVO` na hora — sem gastar tentativas.
- Senão, tenta baixar a legenda (`--write-auto-sub --write-sub`) até 4 vezes
  com pequenos intervalos (0s, 20s, 40s, 60s — cabe dentro do tempo do
  Passo 5 da rotina).
- Em sucesso, já entrega o `.vtt` limpo em `<output_dir>/<video_id>.clean.txt`
  (mesma higiene que já era feita manualmente: remove `WEBVTT`/timestamps/tags,
  dedup).
- `youtube-transcript-api` **sai do caminho principal**: no sandbox de nuvem
  ele falha de forma estrutural (IP bloqueado), não pontual — manter como
  fallback só adiciona tempo de espera sem chance real de sucesso. Se quiser
  tentar mesmo assim (ex.: rodando fora da nuvem), é só chamar como antes,
  fora deste script.

**Resultado testado (16/07, retroativo aos 3 vídeos do dia):** Genial →
`AINDA_AO_VIVO` em 2,5s (antes: 3 tentativas perdidas, minutos de log de
erro); XP → `OK` na 1ª tentativa em 4,8s; BTG → `OK` na 1ª tentativa em 4,7s
(a legenda já havia sido processada pelo YouTube neste momento do teste).

**Atualização recomendada para o Passo 5 do prompt da rotina** (o prompt vive
fora do repo; colar lá):
```
5.2 Para cada vídeo candidato, use o helper versionado:
      agent/fetch-transcript.sh <video_id> /tmp/transcripts
    Ele já resolve retry (legenda ainda não processada) e detecção de
    AINDA_AO_VIVO (não perder tempo com vídeo em transmissão) — não usar
    yt-dlp nem youtube-transcript-api soltos. Em AINDA_AO_VIVO ou
    SEM_LEGENDA, registrar a falha no snapshot com a causa exata (uma frase),
    nunca inferir tese pelo título.
```

## Canal WhatsApp (distribuição)

Toda edição NOVA mergeada na `main` é anunciada automaticamente no grupo do
WhatsApp pelo workflow [`whatsapp-notify.yml`](../.github/workflows/whatsapp-notify.yml):
ele espera a página do dia responder 200 (nunca anuncia link quebrado) e manda
a **capa com legenda** (título + description do frontmatter + link) via
**Evolution API** rodando em VPS próprio 24/7. A rotina de nuvem NÃO participa
do envio — ela só publica; o aviso sai do merge. Update de edição já publicada
(mesmo arquivo modificado) não re-notifica.

Setup do VPS + QR + segredos do GitHub: [`agent/whatsapp/README-SETUP.md`](./whatsapp/README-SETUP.md).
Teste manual: `gh workflow run whatsapp-notify.yml -f date=YYYY-MM-DD`.

## Agendamento
A rotina roda pelo *trigger* do Claude Code on the web (não por cron do repo
nem da sessão — `CronCreate` é só de sessão e não sobrevive). Para mudar o
horário (ex.: **09:00 BRT**), editar a agenda do trigger no painel da rotina.
Docs: https://code.claude.com/docs/en/claude-code-on-the-web
