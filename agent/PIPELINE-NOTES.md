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

## Agendamento
A rotina roda pelo *trigger* do Claude Code on the web (não por cron do repo
nem da sessão — `CronCreate` é só de sessão e não sobrevive). Para mudar o
horário (ex.: **09:00 BRT**), editar a agenda do trigger no painel da rotina.
Docs: https://code.claude.com/docs/en/claude-code-on-the-web
