# Guia para agentes — site-az-invest

Leia **antes** de implementar qualquer mudança. Este arquivo é autossuficiente: não aponta para documentos fora do repositório.

Aprofundamento em `docs/DADOS-E-SERIES.md` — códigos de série, contrato de builder e metodologia por painel. O padrão visual dos gráficos está em `docs/PADRAO-VISUAL-GRAFICOS.md`.

> Consolidado em 18/08/2026 a partir de 21 documentos que viviam fora do repositório, na pasta do projeto Cowork, e que nenhum agente do repositório conseguia ler. Itens marcados **[verificar]** foram extraídos de material de mai–jul/2026 e podem já ter sido resolvidos.

---

## 0. Como trabalhar aqui

### Descubra onde você está antes de tudo

```bash
echo "${CLAUDE_CODE_REMOTE:-local}"
```

**Nuvem (`true`)** — sandbox Linux efêmero, clone limpo, proxy de egresso com política. Não existe OneDrive nem PowerShell aqui.
**Local (vazio)** — Windows, PowerShell, repo dentro do OneDrive, possivelmente com o Cursor aberto no mesmo repo.

Boa parte das regras antigas deste projeto foi escrita para resolver problemas do ambiente local. Elas estão marcadas como tal — não as aplique na nuvem.

### Relação com o dono (vale nos dois ambientes)

1. **Plano antes de tarefa grande.** Qualquer mudança que afete mais de três ou quatro arquivos, ou que crie infraestrutura nova (pipeline, rota, workflow), vai primeiro como proposta em texto: objetivo em uma frase, fontes e por que essas, estrutura do output, sequência de etapas, riscos conhecidos. Espere o "pode seguir". Depois **execute o plano inteiro** sem pedir aprovação a cada passo — reporte só nos marcos.
2. **Não peça ao dono para rodar comando que você mesmo pode rodar.** Você tem shell.
3. **Não diga "deve funcionar".** Teste.
4. **Não trate exit code 0 como prova de sucesso.** Inspecione o output ou o estado.
5. **Não entregue assumindo que ele valida cada passo.** Ele não vai. Valide você.
6. **Antes de pedir credencial, secret ou config**, rode `gh secret list --repo investsmartfloripa-sys/site-az-invest`, `vercel env ls` e `gh auth status`. Em 9 de 10 casos já está configurado por trabalho anterior — mostre o comando e o output.

### Você não está sozinho neste repositório

O agente do Café com Mercado empurra commits na `main` **várias vezes por dia** — edição, capa e snapshot. Sempre `git fetch` e `git rebase origin/main` antes de empurrar; push sem rebase é rejeitado. Use `git add <caminhos>` explícito, **nunca `git add .`**: pode haver trabalho não-commitado de outra sessão. No ambiente local, o Cursor também pode estar com arquivos abertos.

### Publicar

**Na nuvem:** o proxy só permite push na branch da sessão. O fluxo é push na branch, depois PR com `base=main`, depois merge squash. **O deploy sai do merge, não do push.** A Contents API (PUT) e o `workflow_dispatch` retornam 403 — não insista. Se o `git push` der 403, rode `/web-setup` uma vez no terminal do PC, logado no `gh`.

**No local:** `git push origin main` direto, que dispara o auto-deploy.

### Verificar

A validação por Chrome MCP descrita nos documentos antigos era do Cowork. Aqui:

- Página no ar: `curl -sI https://investimentosdeaz.com.br/<rota> | head -1` deve dar 200.
- Dado no Blob: `curl -s <blob>/data/<arquivo>.json` e confira `last_data_date`, número de observações e o primeiro registro.
- **Na nuvem a Actions API é bloqueada até para leitura** — não tente checar runs por lá, verifique pelo site público.
- Mudança só em `.md` **não dispara deploy** (`paths-ignore`). Não fique esperando build que não vem.
- ISR tem TTL de 1 hora: dado novo no Blob demora até 60 min para aparecer. Não é falha.

### Armadilhas do ambiente local (ignore na nuvem)

- Mensagem de commit **sem vírgulas e sem aspas duplas internas** — o PowerShell quebra o argument splitting.
- `&` com caminho que contém espaço falha dentro de pipeline. Use `Start-Process` com `-RedirectStandardOutput`.
- Valores em `.env` vêm com aspas; faça o strip antes de usar ou o auth volta 403.
- `.git/index.lock` pode estar preso pelo Cursor — espere 5 a 10 segundos.
- **Latência do OneDrive:** arquivo lido pelo mount pode vir truncado enquanto no Windows está completo. Nunca faça append baseado só no que o mount mostrou; releia antes.

---

## 1. Regra de ouro: execute, verifique, ajuste

Não encerre a tarefa porque o build passou ou o código foi escrito. **Valide o resultado no site.**

1. `npm run build` (ou `tsc --noEmit` se a mudança for pequena) — corrija erros no mesmo turno.
2. Migration Prisma nova: aplique no Neon com `npx prisma migrate deploy` (SQL escrito à mão; `migrate dev` quebra com shadow DB no Neon) **antes** do push.
3. Publique por git — veja §2.
4. Acompanhe o deploy até **Ready/Aliased**.
5. Teste em produção, não confie no exit code:
   ```bash
   npm run site:check-access
   node scripts/smoke-workspace.mjs
   ```
6. Verifique também **o que não mudou**: em pipeline incremental, confirme via `fetch` do JSON no Blob que o histórico permaneceu intacto — não apenas que o dado novo entrou.

---

## 2. Deploy e publicação

**Publicar é sempre por git.** O projeto está conectado ao GitHub (branch de produção `main`) e faz auto-deploy quando a `main` recebe commit. O caminho até a `main` depende do ambiente — veja §0 "Publicar": direto no local, via branch e PR na nuvem.

**Nunca use `vercel --prod` / folder-deploy.** O repo vive dentro do OneDrive; o folder-deploy sobe o estado da *pasta*, com modificações não-commitadas e, por latência do OneDrive, às vezes versões antigas dos arquivos. Com Cursor e Claude atuando em paralelo, um deploy reverte em produção o trabalho não-commitado do outro.

> Documentos antigos (`DEPLOY-VERCEL-30s.md`, `run-anbima-manual.cmd`, handoffs de maio) mandam o contrário. **Estão obsoletos.** A regra de junho/2026 vence.

**O repositório é PÚBLICO por decisão do dono** — privatizá-lo estoura a cota de GitHub Actions e paralisa todos os pipelines em cerca de 48h. Aconteceu em 16/08/2026: o site ficou dois dias servindo dado congelado. Consequências: nenhum segredo em commit; o seed do admin lê `MASTER_LOGIN`/`MASTER_PASSWORD` do ambiente.

Antes de pedir qualquer secret ao dono, rode `gh secret list --repo investsmartfloripa-sys/site-az-invest`. Em 9 de 10 casos já existe.

Ambiente Windows/PowerShell, quando aplicável: mensagem de commit **sem vírgulas e sem aspas duplas internas** (quebram o argument splitting do PS); `.git/index.lock` pode estar preso pelo Cursor (espere 5–10s); arquivo que "deveria estar lá e não está" costuma ser latência do OneDrive — leia pelo caminho da VM, não pelo Windows.

**Commite só os SEUS arquivos.** Outra sessão pode estar com trabalho não-commitado no mesmo repo. Nunca `git add .`.

---

## 3. Cache, ISR e Next 16

**Uma única regeneração ISR ruim assa a página degradada no cache estático e a serve a todos por minutos.** Foi a causa raiz de três incidentes: home sem artigos, `/nosso-time` com 0 integrantes, vídeos em fallback. Diagnóstico: `x-vercel-cache: HIT` com `age` baixo. Por isso home, `/nosso-time` e `/videos` estão em `force-dynamic`.

**Risco residual, deliberado:** cerca de 30 rotas `painel-economico/**` seguem em ISR — os JSONs do Blob são pesados e `force-dynamic` martelaria o Blob a cada request. O pior caso é `atividade/*` com `revalidate=86400`. **Fix correto, ainda não feito:** nos loaders `@/lib/painel-*`, em vez de `return null` no catch ou `!res.ok`, servir o último payload bom — assim a regeneração nunca troca um render bom por vazio.

**TTL do ISR é de 1 hora.** JSON novo no Blob não aparece em produção por até 60 minutos. Isso não é falha de pipeline — não re-rode o pipeline por causa disso.

Nunca combine `force-dynamic` com `revalidate` no mesmo arquivo: o `revalidate` é ignorado e cada pageview vira invocação de função.

Convenção de arquivo do Next 16: `src/proxy.ts` com `export function proxy` — **não** `middleware.ts`, que está deprecado.

---

## 4. Frontend e visual

**Tailwind v4: qualquer seletor global fora de `@layer` no `globals.css` vence os utilitários e mata as classes silenciosamente.** Foi o que `a { color: inherit }` fez com a sidebar do workspace — navy sobre navy, classe presente no JSX, cor simplesmente não aplicada. Mantenha o reset de âncora dentro de `@layer base`. Padrão seguro: definir cor de link no elemento-pai, nunca no próprio `<a>`.

Michroma só tem peso 400. Aplicar `font-semibold` ou `font-bold` produz faux bold borrado — Michroma só em h1/h2, Raleway 600/700 no resto.

Cores da marca: navy `#132960`, azure `#027DFC`, rust `#FF5713` (CTA único), bordas `border-[#132960]/10`. Nenhum arquivo define paleta própria. Em gráficos: verde = subiu, vermelho = caiu (direção literal); divergentes `#1E8A5C` e `#BE3B33`; grid `#E2E8F0`. Exceção única: painéis de inflação usam direção semântica — alta = vermelho, queda = azul.

`docs/PADRAO-VISUAL-GRAFICOS.md` é lei. Em especial: seletor de período com opção "Personalizado" é obrigatório em todo gráfico de série temporal.

**Recharts.** Para validar gráficos, inspecione o DOM (`.recharts-surface`, `.recharts-line-curve`) — **não** use screenshot: essas páginas travam o `captureScreenshot` do CDP. Não marque valores no fim das linhas com `<Customized>` nem `<ReferenceDot>` na borda; ambos causaram o travamento. Gráficos `variant="hero"` têm animação de entrada de cerca de 0,4s: linha incompleta por um instante não é bug. Warnings `recharts width(-1)` no build vêm dos painéis econômicos e são ruído conhecido.

Nunca dois eixos Y, e jamais dois eixos com a mesma unidade. Nunca misture ordens de grandeza no mesmo eixo. **Qualquer série com histórico a partir de 2020 precisa de domínio Y que cubra o outlier da pandemia** — `domain={[-3,3]}` num gráfico que toca −10% do PIB renderiza "−9763%".

---

## 5. Não destrua isto

- `/admin`, `/area-restrita` e `/area-restrita/painel` são **redirects intencionais**. `/conteudo` é **página pública legítima** — hub de Artigos, Vídeos e Periódicos, linkada no header. Nenhum deles é lixo legado.
- `content/cafe-com-mercado/YYYY-MM-DD.md` é **escrito por um processo externo ao repositório**: uma tarefa agendada na máquina do dono, por volta das 10h em dias úteis. O frontmatter YAML (`date, weekday, title, hora, publishedAt, description`) é contrato com esse produtor. Renomear a pasta ou mudar o schema quebra uma automação invisível daqui de dentro. Tom e conteúdo do briefing são decididos fora do repo.
- `agent/` contém os helpers desse mesmo produtor (`compose-capa.py`, `publish-edition.sh`, `fetch-transcript.sh`, `state/`) e está em `paths-ignore` do workflow de deploy.
- A senha do admin master foi mantida por decisão do dono. A rotação foi adiada, não esquecida.

## 6. Área logada (AZ Workspace)

| Rota | Quem acessa |
|------|-------------|
| `/area-restrita/login` | Público |
| `/area-restrita/dashboard` | Todos autenticados |
| `/area-restrita/conteudo`, `/revisao` | ADMIN, STAFF, AUTHOR (escopo por autor) |
| `/area-restrita/autores`, `/leads`, `/metricas`, `/dados`, `/usuarios` | ADMIN e STAFF |
| `/area-restrita/perfil` | AUTHOR e demais |

Papéis: `ADMIN`, `STAFF`, `AUTHOR` — substituem o antigo MASTER/EDITOR.

## 7. Higiene do repositório

`.md` sobre **código e sobre como trabalhar neste repo** fica aqui. `.md` de **status, plano, briefing ou diário de sessão** não entra — foi exatamente esse vício que produziu os 21 documentos órfãos que originaram este guia. Se você sentir vontade de criar `STATUS-ALGUMA-COISA.md`, escreva no corpo do PR.

Limpe arquivos temporários (`.cm`, `.gh-out`, `.tsc-out.txt`, `.run-*.cmd`) antes do commit.

## 8. Bugs abertos herdados **[verificar]**

- `build_anbima_tpf.py` concatena `data.source` a cada dia carregado, e o rodapé "Fonte:" repete a mesma string cerca de 40 vezes. É bug do builder, não do componente.
- Se ainda houver `.jsx` em `src/app/simuladores/`, esses arquivos estão fora do `tsc` (o `tsconfig` não inclui jsx) — ponto cego de tipos exatamente na área que calcula dinheiro do usuário.
- Probit financeiro devolve null em 100% dos pontos: é univariado em ICF e o Newton-Raphson diverge sem regularização (`build_visao_geral_recessao.py`, por volta das linhas 242-294). Contorno proposto: ridge L2, carry-forward e slope DI como segunda feature.
- ANFAVEA: o scraper precisa baixar `siteautoveiculos{ANO}.xlsx` em loop de 2019 até o ano corrente. **Manutenção anual obrigatória.** A cascata de falha está em `docs/DADOS-E-SERIES.md`.
- Divergência FENABRAVE de +46% em mar/2026 contra ANFAVEA — efeito base ou erro de parsing, não resolvido.

---

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->
