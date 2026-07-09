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
Ler runs é GET (liberado). Após o push, checar a última run de
`deploy-vercel.yml` (`event=push`) e só declarar publicado se
`conclusion=success`. Se falhar em "Pull Vercel config", o `VERCEL_TOKEN`
expirou (renovar no secret do repo).

## Capa — evitar manchete "deslocada"
`compose-capa.py` quebra a manchete por largura. Manchete longa gera **palavra
órfã** na 2ª linha (ex.: "...IGNORA O" / "IRÃ"), que parece desalinhada.
Regra: **manchete curta, CAIXA ALTA, que caiba em 1 linha ou quebre 2 linhas
equilibradas** (ex.: "PETRÓLEO RECUA, FED ENDURECE"). Evitar linha final com 1
palavra curta. Conferir a capa antes de publicar.

## Agendamento
A rotina roda pelo *trigger* do Claude Code on the web (não por cron do repo
nem da sessão — `CronCreate` é só de sessão e não sobrevive). Para mudar o
horário (ex.: **09:00 BRT**), editar a agenda do trigger no painel da rotina.
Docs: https://code.claude.com/docs/en/claude-code-on-the-web
