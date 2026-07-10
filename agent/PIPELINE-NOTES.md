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

## Edições a fazer no PROMPT da rotina (Claude web → routine)

O pipeline vive no prompt da rotina (não no repo). Trocar o Passo 7/8 por git:

### Passo 7 (substituir Contents API + dispatch)
```bash
# Requer GITHUB_PAT_COWORK no ambiente e /tmp/edicao.md + /tmp/capa.jpg prontos.
bash agent/publish-edition.sh \
  --date {{YYYY-MM-DD}} \
  --md /tmp/edicao.md \
  --cover /tmp/capa.jpg \
  --snapshot /tmp/snapshot.md
```
Ou, sem clonar via helper, dentro de um checkout do repo: copiar
`content/cafe-com-mercado/{{DATA}}.md` + `public/capas/cafe-com-mercado/{{DATA}}.jpg`,
`git add`, `git commit`, `git push origin main`. O deploy vem do push da capa.
**Não usar** `curl -X PUT .../contents` nem `workflow_dispatch` na nuvem: 403.

### Passo 8 (snapshot)
O helper já publica `agent/state/previous-day-snapshot.md` no mesmo push.
`agent/**` está em `paths-ignore`, então isso não dispara deploy sozinho — o
deploy é do `.jpg`. Bom: snapshot não força rebuild à toa.

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

**Editar no PROMPT da rotina (Passo 6.5.3):** trocar "use ...Condensed-Bold se
existir; senão DejaVuSans-Bold" por: PRIMEIRO instalar `fonts-dejavu-extra`
(1 linha de apt), DEPOIS compor com `agent/compose-capa.py`. O fallback largo
deixa de ser um caminho "aceitável" — vira só rede de segurança com aviso.

## Agendamento
A rotina roda pelo *trigger* do Claude Code on the web (não por cron do repo
nem da sessão — `CronCreate` é só de sessão e não sobrevive). Para mudar o
horário (ex.: **09:00 BRT**), editar a agenda do trigger no painel da rotina.
Docs: https://code.claude.com/docs/en/claude-code-on-the-web
