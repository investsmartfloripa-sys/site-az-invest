# Padrão visual de gráficos — AZ Invest

Definido em 2026-06-04 durante o redesign do Panorama (decisão do Borbarox + agente visual). **Aplicar em todo gráfico novo do site** e migrar os antigos quando forem tocados.

## 1. Grade ("estilo ggplot2")

A referência é a grade dos gráficos ggplot2 do pipeline R: linhas de referência discretas e contínuas que dão régua ao olho, sem pesar.

Em Recharts:

```tsx
<CartesianGrid stroke="#E2E8F0" strokeWidth={1} />            // linhas: ambas as direções
<CartesianGrid horizontal={false} stroke="#E2E8F0" />          // barras horizontais: só verticais
<ReferenceLine x={0} stroke="#132960" strokeOpacity={0.55} strokeWidth={1.5} />  // linha do zero em navy (divergentes)
```

- Grid SÓLIDO `#E2E8F0` (slate-200), nunca tracejado chamativo.
- Eixos sem linha e sem tick marks (`axisLine={false} tickLine={false}`) — a grade já é a régua.
- Ticks: `fontSize 10-11`, cor `#64748B` (slate-500). Labels de categoria: `#334155` (slate-700).

## 2. Gradiente temporal (séries de cortes históricos)

**Regra de ouro: o ATUAL é sempre preto; quanto mais antigo o corte, mais clara a cor.** A descida no tempo precisa ser visual e imediata.

**As paletas são POR GRÁFICO e vêm dos scripts R do pipeline** (decisão final do Borbarox em 2026-06-04: "use as cores de antes dos gráficos"). Nunca inventar rampa própria — copiar do script R correspondente:

| Gráfico | Recente | D-30 | D-90 | D-365 | Extras |
|---|---|---|---|---|---|
| Curva pré (`build_yield_curves_svg.R`) | `#000000` | `#00008B` | `#56B4E9` | — | — |
| Curva IPCA+ (idem) | `#000000` | `#8B0000` | `#F8766D` | — | — |
| Selic implícita (`build_selic_implicita.R`) | `#000000` | `#6f6f6f` | `#0078fd` | — | verticais COPOM `#ff5713` tracejadas + data no topo `#0078fd` 9px |
| Treasury EUA (`build_treasury_us_svg.R`) | `#000000` | `#0B6B2E` | `#2BBF5E` | `#8BE28F` | — |

Série "ao vivo" (DI1/DAP da B3, não existia nos SVGs): **`#027DFC` (azul AZ)** com dots — em todas as tabs. Recente sempre strokeWidth 2.2 + dots r=2.5; cortes 1.6 + dots r=2.

**Curvas pré/IPCA+ exibem as séries dos TÍTULOS do pipeline (Recente/D-30/D-90) nos seus próprios vencimentos + o futuro live como série adicional** — sem interpolação entre instrumentos. Com séries em vencimentos distintos, calcular o domain do eixo Y manualmente (min/max de todas as séries visíveis + padding ~8%), senão o Recharts clipa as linhas.

Elementos OBRIGATÓRIOS herdados dos ggplot originais (paridade validada na Selic implícita):

- **Legenda com a data de referência de cada corte**: "D-30 (05/05/2026)" — os keys das colunas do JSON do pipeline já trazem isso prontos; nunca legendar só "D-30".
- **Dots nos vértices de TODAS as séries** (r=2 nos cortes, r=2.5 na atual) — como no prefixado ggplot.
- **Título do eixo Y**: "Taxa (% a.a.)" (label angle -90).
- **Selic implícita: linha vertical tracejada em CADA reunião COPOM** (`#94A3B8`, dash 3 4) com a data dd/mm no topo (9px, azul `#027DFC`) — substitui as linhas laranjas do ggplot, mantendo a função.

## 3. Cores de variação (barras divergentes, deltas, KPIs)

| Papel | Hex | Uso |
|---|---|---|
| Positivo (barra) | `#1E8A5C` | verde-mar escuro, contraste AA |
| Negativo (barra) | `#BE3B33` | vermelho-tijolo |
| Positivo (texto) | `#166B47` | valores pequenos |
| Negativo (texto) | `#9C2B24` | valores pequenos |
| Neutro/zero | `#027DFC` (azul AZ) | variação ~zero em KPIs; banda ±0,03% |
| Zero (linha) | `#132960` @55% | ReferenceLine |

**Proibido** o par antigo `#2ECC71`/`#E74C3C` (Flat UI, sem contraste, sem relação com a marca).

Em KPIs: verde = subiu, azul = no zero, vermelho = caiu (direção literal do número, sem julgamento de "bom/ruim").

## 4. Barras (rankings horizontais)

- `maxBarSize={16}`, `radius={[0,3,3,0]}`, `barCategoryGap="35%"`.
- Valor na ponta com sinal: `+2,3%` / `−1,2%` (`LabelList position="right"`, 10.5px, `#475569`, tabular-nums) — o sinal cobre daltônicos.
- Altura derivada do nº de linhas: `height = 28*n + 56` (não esticar lista curta).
- Nomes truncados a ~18 chars no dado (não deixar o SVG quebrar linha); `YAxis width` fixo entre tabs irmãs.

## 5. Tooltip

Tooltip navy "momento de marca":

```tsx
contentStyle={{ background: "#132960", border: "none", borderRadius: 8, color: "#fff",
  fontSize: 12, boxShadow: "0 4px 12px rgba(19,41,96,.25)" }}
itemStyle={{ color: "#fff" }}
labelStyle={{ color: "#94A3B8", fontWeight: 600 }}
cursor={{ fill: "rgba(19,41,96,0.05)" }}   // em barras: substitui o cinza opaco default
```

## 6. Cards e headers

- Card: branco, `rounded-2xl border border-[#132960]/10 shadow-sm`.
- Título do card em NAVY `#132960` bold (o azul vivo `#027DFC` fica pra links/CTAs/tab ativa).
- Categorias dentro de um card = segmented control: container `bg-zinc-100 rounded-lg p-0.5`; ativo `bg-white text-[#132960] shadow-sm rounded-md`; inativo `text-zinc-500`.
- Período (1D/1S/1M/3M/1A) continua nos pills `PeriodSelector` existentes.
- Carimbo de atualização: `DataStamp` no rodapé direito.

## 7. Rankings tipo tabela (setores)

Padrão "table with bars" (Datawrapper): mini-barra de fundo proporcional atrás de cada linha (`#1E8A5C`/`#BE3B33` a 10% de opacidade), valor em texto na cor escura da família, dot colorido no header (● Top / ● Bottom).

## 8. Seletor de período (REGRA OBRIGATÓRIA — decisão do Borbarox 2026-06-11)

**Todo gráfico de série temporal usa `AzPeriodSelector`** (`src/components/painel/charts/AzPeriodSelector.tsx`): pílulas 1M/3M/6M/YTD/1A/5A/Máx **+ o botão "Personalizado"** com dois inputs de data limitados ao range da série. O Personalizado NÃO é opcional — é parte do padrão em todos os gráficos. Nunca criar arrays PERIODS locais nem toggles próprios de janela.

- Cortes de data 100% em UTC via `resolvePeriodRange()` (nunca `setMonth` local).
- Em rota prerenderizada estática, `useSearchParams` exige `<Suspense>` em volta do consumidor — ou usar o seletor em modo controlado sem `queryKey`.
- Estado na querystring (`queryKey`) quando a página se beneficia de deep-link (ferramentas de comparação); estado local nos heros.

## 9. Anatomia do HERO de ativo/índice (decisão do Borbarox 2026-06-11 — o formato antigo "lista rótulo/valor" está PROIBIDO)

Cabeçalho do hero (Ibov, IFIX, FII individual, ativo) em UM cluster coeso, sem linhas soltas:

- **Esquerda**: eyebrow com o nome (IBOVESPA, 11px uppercase #64748B) → valor grande (tabular-nums navy, 30-36px) com a unidade pequena ao lado → **variação do dia COLADA ao valor** como chip (fundo tonal da cor de variação a ~12%, texto na cor de texto da família, com sinal: "+0,68% hoje").
- **Range 12m**: quando útil, vira **UMA barra de range compacta** — trilho fino com gradiente sutil, marcador (dot azure) na posição atual, mín/máx 11px tabular (`132.129 ───●─── 198.657`). NUNCA duas linhas "Máx 12m / Min 12m" com valor na outra ponta. **Exceção (decisão Borbarox 2026-06-11): nos heros de ÍNDICE (Ibovespa, IFIX) a range bar é OMITIDA** — o gráfico `variant="hero"` já anota máx/mín da janela, e a barra solta no canto superior ficava perdida. Mantida só onde agrega (ex.: card de cotação de um ATIVO individual).
- **"Atualizado em..." NÃO existe no header** — frescor é papel do DataStamp no rodapé do card (Giro/Dado).
- Referência de range bar já implementada: card de cotação em `src/app/painel-economico/mercado/ativo/[ticker]/page.tsx`.

## 10. Cockpit × narrativo (decisão do Borbarox, 2026-08-13)

**Antes de escolher o template de um painel novo, perguntar: esta página é para LER ou para ACOMPANHAR?**

- **Aba de MONITORAMENTO** (acompanhamento recorrente de indicadores — fiscal, risco, e afins) = **COCKPIT**: status geral no topo (chips/barra de distribuição + KPIs), grade densa de cards (`xl:grid-cols-2`), títulos e subtítulos TÉCNICOS de especificação ("Juros nominais 12m ÷ receita líquida 12m (gov. central, RTN)"), divisores de seção de uma linha em caixa alta, e TODO texto editorial/interpretativo atrás de ícones (?) (`MethodInfo`) ou em ficha técnica colapsável. **PROIBIDO em cockpit:** manchete em prosa, blocos numerados "01 ·" com eyebrow/descrição editorial, títulos-manchete dinâmicos.
- **Página EXPOSITIVA** (leitura/análise de uma divulgação — ex.: IpcaDashboardV2) = template narrativo `DashboardScaffold` (manchete por regra + duas camadas) continua válido.
- **Componentes canônicos do cockpit** (referência: aba Indicadores de Risco Fiscal): `RiskSeriesCard` (título técnico + chip de nível + faixas de risco clipadas + ?), `Divisor`, `SemaforoTempoGrid` (small multiples com sparkline + bandas), `MiniRiskSpark`, `DistribuicaoBar`.
- **Casa canônica por grandeza** (seções multi-aba): cada grandeza tem UMA casa (ex. fiscal: Dívida = estoque/estrutura; Receita e Gastos = fluxo; Risco = julgamento). Repetição em outra aba vira sparkline/indicador com link para a casa — nunca um segundo gráfico completo.
- **Convenção de sinal fiscal:** positivo = superávit (STN) em toda a seção; a convenção do livro (déficit positivo) só dentro das ferramentas Dalio, rotulada.

## Implementações de referência no repo

- `src/components/painel/charts/AzTimeSeriesChart.tsx` + `AzPeriodSelector.tsx` (componente base de série temporal + seletor padrão)
- `src/components/painel/core/` (KpiCard, ChartCard, RankingTable, Heatmap, AzTooltip, DashboardScaffold)
- `src/components/painel/inflacao/IpcaDashboardV2.tsx` (painel-modelo: manchete em prosa + duas camadas)
- `src/components/painel/panorama/MarketsPanel.tsx` (barras divergentes; paleta agora em `src/lib/az-chart-theme.ts`)
- `src/components/painel/panorama/SectorsPanel.tsx` (ranking com mini-barras)
- `src/components/painel/panorama/JurosLiveBlock.tsx` (gradiente temporal `TIME_COLORS`, grade, tooltip)
