# Armadilhas técnicas — site-az-invest

Coisas que já quebraram o site ou fizeram alguém perder horas, e que **não aparecem em erro de compilação**. Complementa o `AGENTS.md`. Cada item diz o sintoma, a causa e o que fazer.

> Até set/2026 isto vivia só na memória do Claude de um único PC — quem trabalhava de outra máquina tropeçava nas mesmas coisas. **Aprendeu uma armadilha nova? Escreva aqui**, no mesmo formato, e commite.

---

## 1. O banco local É o banco de produção

**Não existe banco de dev.** O `.env` aponta para o mesmo Neon da produção.

- `npm run dev` e testar criar comentário, salvar post, cadastrar lead = **gravar no site real**. Em jun/2026 uma resposta de teste apareceu num artigo publicado.
- **Nunca rode `prisma migrate dev`, `prisma migrate reset` nem os seeds (`db:seed-*`) com esse `.env`.** O `migrate dev` pode propor reset do banco ao detectar divergência — apagaria a produção.
- Migration nova: SQL escrito à mão em `prisma/migrations/`, aplicado com `npx prisma migrate deploy`, **antes** do push do código que depende dela.
- Validar área logada localmente: prefira ações de leitura. Se precisar escrever, marque como `TESTE-AUTOMATIZADO — pode apagar` e apague depois.

## 2. Deploy

O básico está no `AGENTS.md` §2 (publicar é `git push`, nunca `vercel --prod`). O que mais morde:

- **Dois deploys por push.** A integração Git da Vercel e o workflow `deploy-vercel.yml` publicam produção a cada push. Em pushes seguidos, o deploy de um commit **mais velho** pode terminar por último e assumir o domínio (aconteceu em 14/08: o refino do IGP-M sumiu por ~5 min). Sintoma: a URL de produção alterna entre versões. Remédio imediato: commit vazio + push.
- **Deploy "Ready" não é deploy no ar.** Confira se `investimentosdeaz.com.br` aparece em *Aliases* com `vercel inspect <url>`. Em incidente da Vercel (18/09) o deploy ficou pronto e o domínio só veio depois. Run travado no Actions segura a fila (`concurrency` sem cancelamento): `gh run cancel <id>` depois que o site estiver no ar. Status da plataforma: `curl https://www.vercel-status.com/api/v2/status.json`.
- **Verifique o conteúdo, não o status.** Para mudança só de cliente: baixe o HTML da página, pegue os chunks `/_next/static/chunks/*.js` e procure uma string única da mudança (um `aria-label` novo, por exemplo). Zero chunks com a string = versão velha.
- O `scripts/smoke-workspace.mjs` **não cobre rota nova** — abra a rota nova à mão.
- Não há preview por branch: os deploys são só de produção. PR se valida rodando localmente (item 6).

## 3. Variável de ambiente da Vercel

- `vercel env add NOME env < arquivo` e `printf … | vercel env add` **gravam valor vazio** quando o shell não é interativo. Já criou env vazio em produção.
- Use a REST API: `GET /v9/projects/{projeto}/env?teamId={time}` para achar o `id`, `DELETE /v9/projects/{projeto}/env/{id}`, `POST /v10/projects/{projeto}/env` com `{"key","value","type":"plain","target":["production","preview","development"]}`. `projectId` e `orgId` estão em `.vercel/project.json` (gerado por `vercel link`); o token em `.env.vercel.local` (`VERCEL_TOKEN`).
- **`NEXT_PUBLIC_*` é embutido no build.** Depois de trocar, publique de novo (commit vazio + push) e confira no HTML servido.

## 4. Cache, ISR e purga (Next 16.2.4, `cacheComponents` desligado)

Arquitetura: todo loader lê o Blob por `fetchPainelBlob(path, ttl)` (`src/lib/painel-blob.ts`), que marca o fetch com a tag `blob:<caminho>`. Ao terminar, o pipeline faz `POST /api/revalidate` com `{"workflow":"<arquivo>.yml"}` e `Authorization: Bearer $REVALIDATE_SECRET`; a rota acha os alvos pelo `data-manifest.ts` e purga tag e rota. O segredo existe no GitHub Actions **e** na Vercel — os dois têm que bater.

- `revalidateTag` exige **dois argumentos** nesta versão.
- `revalidateTag(tag, "max")` só marca como *stale*: o próximo visitante **ainda recebe o dado velho**. Para pipeline, obrigatório `{ expire: 0 }`.
- `revalidatePath` sozinho não basta: limpa o HTML, mas a regeneração reaproveita o Data Cache velho. Precisa da tag junto.
- `'use cache'`, `cacheTag`, `cacheLife` **não existem** aqui; `updateTag` só funciona em Server Action.
- **O `revalidate` efetivo de uma rota é o MENOR entre o da página e o de qualquer `fetch` dentro dela.** Encurtar o TTL de um fetch rebaixou as 28 rotas do painel para ISR de 1 minuto de uma vez. Quem garante frescor é a purga por tag, não o TTL.
- O cron do GitHub atrasa **74–111 min** em média. O gatilho de verdade é o Vercel Cron `/api/cron/dispatch-pipelines` (a cada 15 min), que dispara os workflows por `workflow_dispatch`; o cron do `.yml` é rede de segurança.
- Shell do Actions é `bash -e`: `a && b` que resulte falso **aborta o step**. Use `if`.
- **Push que muda a página E o dado: dispare o pipeline (ou a purga) só DEPOIS do deploy ficar Ready.** O build do deploy novo pré-renderiza a página com o JSON que estava no Blob naquela hora; a purga que roda antes de o deploy subir alcança o deploy antigo, e o novo entra no ar com o dado velho até o TTL (06/10/2026: dispersões novas do modelo P/L só apareceram depois de uma segunda purga).

## 5. Hidratação: nada de `loading.tsx` nem `<Suspense>` em rota estática interativa

No build de produção, conteúdo dentro de um boundary `<Suspense>` — `loading.tsx` da rota, `<Suspense>` de componente ou o *bailout* forçado por `useSearchParams()` — **renderiza no servidor e nunca hidrata**. Seletores de período, abas e toggles ficam mortos; efeitos de cliente não rodam. Em `next dev` hidrata normal, o que esconde o bug. Um `loading.tsx` derrubou a interatividade de todo o `/painel-economico` por semanas (corrigido em `9884170`).

- Não crie `loading.tsx` em grupos de rotas estáticas/ISR interativas (painel, simuladores). Rotas `force-dynamic` (blog, conteúdo, nosso time, workspace) toleram.
- No lugar de `useSearchParams()`, use o padrão `useDeferredSearchParams` (definido em `src/components/painel/charts/AzPeriodSelector.tsx`), que lê `window.location.search` depois do mount.
- Verifique hidratação no navegador: `Object.keys(botao).some(k => k.startsWith('__react'))`. Conteúdo aparecer não prova que hidratou.

## 6. Rodar o painel localmente

`npm run dev` responde **404 em todo `/painel-economico/*`** (menos o índice). É quirk do Turbopack com o segmento dinâmico `[trilha]`; produção e `next start` servem tudo. Não perca tempo depurando: `npm run build && npm run start -- -p 3001`.

No HTML do servidor não aparecem os rodapés dos `ChartCard` (viram popover "?" no cliente) nem os gráficos (Recharts só desenha no cliente, com viewport real).

## 7. Recharts: gráfico que some sem erro

O wrapper do gráfico precisa de **altura definida** (`h-[340px]`, `style={{ height }}`), nunca `h-full min-h-[Xpx]`. O `ResponsiveContainer` calcula 100% da altura do pai; pai com altura vinda de `min-height` tem `height: auto`, a conta dá zero e o `<svg>` nem é emitido. `tsc`, `build` e console passam limpos (caso do `SazonalidadeCard`, corrigido em `07aa636`).

Verificar medindo, não procurando SVG:

```js
[...document.querySelectorAll('.recharts-responsive-container')]
  .map(c => Math.round(c.getBoundingClientRect().height))   // nenhum pode ser 0
document.querySelectorAll('.recharts-rectangle, .recharts-line-curve, .recharts-area-area, .recharts-symbols').length
```

Em navegador automatizado oculto, `window.innerWidth` pode voltar 0 e aí todo container mede zero: defina o tamanho da janela e **recarregue** antes de medir.

## 8. Série nova ou pipeline novo

Regra do dono, permanente:

1. **Registrar em `src/lib/data-manifest.ts`** (`DATA_SOURCES`; painel novo também em `PAINEIS`). Não é só monitoramento: o manifest é a fonte da purga de cache — série fora dele **não é purgada** e mostra dado velho por horas no dia da divulgação.
2. Payload com `generated_at` e, se possível, `last_data_date`.
3. Depois do deploy, abrir `/area-restrita/dados`, clicar "Atualizar agora" e ver a linha verde. Conferir que o workflow roda sozinho e que o freshness acusa certo.

Aprendizados de operação:

- O portal da FGV rejeita o TLS do Python: `curl_cffi` com `impersonate="chrome"`.
- O SIDRA bloqueia IP de nuvem em rajadas de dias: steps isolados com `continue-on-error` e um step final que falha alto; backoff exponencial no `_get`.
- A coluna "Workflow" do `/dados` tem atraso de um refresh (cache de 300 s da API do GitHub). Badge de falha com execução recente: atualize de novo antes de concluir.
- `dispatch-pipelines` responde 500 quando o GitHub recusa o disparo — PAT expirado aparece no painel de crons da Vercel.
- Pipeline com merge *append-only* congela "bonito" quando a fonte morre: é o caso que o monitor existe para pegar.
- O monitor só pega se o carimbo (`last_data_date`) sair das séries gravadas, não das linhas baixadas: a curva TPF ficou duas semanas parada com carimbo do dia e run verde (`docs/DADOS-E-SERIES.md` §2).

## 9. Juros: feed intraday da B3

- `cotacao.b3.com.br` (DI1 ao vivo) caiu em 04/08/2026 e voltou em 10/08. **Não conte com ele**: a curva oficial ETTJ (`src/lib/b3-reference-rates.ts`, só server-side, sem CORS) fica como fallback D-1, com a data visível no gráfico.
- Com o feed vivo o gráfico pré mostra três linhas pretas (Agora, Ajuste D-1, D-1 ETTJ) — redundância ainda a resolver.
- O `referenceRatesProxy/GetList` **ignora datas fora dos últimos ~20 pregões** e devolve a curva mais recente em silêncio. Para validar histórico, use o arquivo TaxaSwap por pregão: `b3.com.br/pesquisapregao/download?filelist=TS{aammdd}.ex_` (zip dentro de zip).
- Dado D-1/fim de dia é redistribuível sem custo. Intraday em site público exige licença de *divulgação com atraso em websites* (Política Comercial de Market Data da B3, seção 7.5), via distribuidor licenciado.

## 10. Boletins (divulgações do Publisher)

Desde 21/09/2026 as divulgações de IPCA/IGP-M não são artigos: categoria `Boletim`, URL `/boletins/<slug>`, listagem `/boletins`, e aparecem no bloco "Periódicos" (`PeriodicosBlock`).

- Link de post **sempre** por `postPath()` (`src/lib/post-path.ts`). Nunca monte `/blog/<slug>` à mão.
- Listas de artigos usam `artigosWhere` (exclui boletim); boletins usam `boletinsWhere` (`src/lib/workspace/posts.ts`).
- `src/proxy.ts` dá 308 de `/blog/<ipca|igpm>-AAAA-MM` para `/boletins/…`.
- O nome "Boletins" é provisório: rótulos em `BOLETIM_SECTION_LABEL` e `BOLETIM_KICKER` (`src/data/blog-categories.ts`). Trocar a URL exige redirect.
- Indicador novo no Publisher: atualizar `ChartIndicador`, `BOLETIM_SLUG_PATTERN` e os chips de `/boletins`.

## 11. LPA e P/L pelo yfinance

- `quarterly_income_stmt` fica **defasado em até um trimestre** depois da divulgação. Use `tk.get_earnings_dates(limit=N)`, coluna `Reported EPS` — datada pelo anúncio, ~12 anos de histórico.
- Sempre cruze o TTM calculado com `tk.info['trailingPE']`/`['trailingEps']`. Divergência grande denuncia ADR em moeda local (TSM em TWD, ASML em EUR), DRE defasada ou lucro perto de zero (P/L sem sentido: marque n.a.).
- Ações da B3 no `Reported EPS`: VALE3 e EMBJ3 vêm em **US$** (preço em R$) e a unit KLBN11 vem **por ação**; e o `trailingEps`/`trailingPE` do `.info` erra units como BPAC11. Correções e conferência em `build_acoes_valuation.py` (`LPA_AJUSTES`, `LPA_CONFERIDOS`) — detalhe em `DADOS-E-SERIES.md` §4 "Bolsa".
- Console do Windows quebra em acento: `PYTHONIOENCODING=utf-8 PYTHONUTF8=1`.

## 12. HTTP 200 não prova que a página renderizou; `revalidate` em `[slug]` não é ISR

- **Rota com `loading.tsx`** (`/blog`, `/conteudo`, `/nosso-time` e filhas) começa o streaming com **200** antes de o servidor terminar. Se a página lança depois, o visitante vê "Algo deu errado" e o status continua 200. Em 28/09/2026, sem banco, `/blog` e `/conteudo` "passavam" no teste por status enquanto mostravam a tela de erro. Valide pelo conteúdo: procure no HTML o texto esperado ou o do estado vazio.
- **Listagem `force-dynamic` que consulta o banco** degrada com try/catch: lista vazia + `console.error` (padrão de `/nosso-time`, `/boletins`, `/blog`). É seguro porque nada vai para o cache. **Página de detalhe** (post, boletim, autor) continua lançando de propósito: não existe estado vazio honesto para um post, e `notFound()` num soluço do banco serviria 404 para uma página que existe (e, se a rota virar ISR, assaria o 404 no cache).
- **`export const revalidate` numa rota `[slug]` sem `generateStaticParams` não faz ISR** no Next 16: `/blog/[slug]`, `/boletins/[slug]` e `/nosso-time/[slug]` renderizam por request em produção (`cache-control: private, no-store`, `x-vercel-cache: MISS`), apesar dos comentários "ISR" nos arquivos. Para ISR de verdade é preciso `generateStaticParams` retornando `[]` (ver a doc em `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/generate-static-params.md`) — e aí vale a doutrina do `AGENTS.md` §3: nada de degradar para vazio/404 nessas rotas; lançar mantém a última versão boa no cache.

## 13. FIIs: B3 (COTAHIST), CVM e Yahoo

- **Troca de código muda o ISIN na B3, e a CVM mantém o antigo.** BBPO11→TVRI11, XTED11→VVCO11, MALL11→PMLL11, HSRE11→BTRU11, ISSH→GZIT11: sem tratar, o fundo "sai" do índice no dia da troca (em 2025–26 eram ~10% do volume de FIIs sem ligação com a CVM). `build_fii_tijolo_modelo.py` liga ISIN→CNPJ por: ISIN do informe, semente `fii_isin_cnpj.json`, raiz do ISIN, **contagem de cotas** (`GetListedSupplementFunds` da B3 traz `quantity` = `Cotas_Emitidas` da CVM; empate desfeito pelo nome) e continuidade de negociação (um código para e outro começa em até 10 dias no mesmo preço, ±15%, com o CNPJ antigo ainda entregando informe). Casar pelo "P/VP estável" liga fundos de papel errados (todos negociam perto de 1) — não use.
- `Percentual_Dividend_Yield_Mes` da CVM é **sobre o VP**, não sobre o preço: rendimento por cota = DY × VP/cota.
- O "Adj Close" do Yahoo para FII **não incorpora os rendimentos direito** (fica ~0,25 p.p./mês abaixo do retorno total): não serve de régua de retorno total de FII.
- O COTAHIST anual do ano corrente é atualizado pela B3 todo dia (traz até D-1); os anos fechados (~550 MB) ficam no cache do Actions do `fii-tijolo-pipeline.yml`.
- pandas com dtype `str`: atribuir NaN de um `Index.map` numa coluna de texto levanta `Invalid value for dtype 'str'` — crie a coluna como `object` antes.

