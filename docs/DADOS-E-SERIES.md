# Dados, séries e metodologia — o que não está no código

O código mostra **o que** foi feito. Este documento guarda **por quê** — e principalmente os erros que já foram cometidos em produção e não podem voltar.

> Consolidado em 18/08/2026 a partir de documentos que viviam fora do repositório. Itens **[verificar]** vêm de material de mai–jul/2026 e podem já ter sido resolvidos.

---

## 1. Contrato de builder

**Cálculo pesado vive no builder Python, nunca no front.** Contribuições, carrego, difusão, deflatores, médias móveis, rebases, medianas de ensemble — um cálculo, uma fonte de verdade. Vício já documentado: a mediana do probit chegou a estar reimplementada em quatro lugares, e o primário estabilizador em três versões com sinais diferentes.

**Nunca sobrescreva dado bom com vazio.** Builder que falha aborta o upload ou faz merge incremental. Padrões de referência no próprio repo: `visao-geral-pipeline.yml` (soft-fail com preservação do último dado bom) e `build_anbima_tpf.py` (merge incremental).

**Merge incremental é obrigatório em fonte com janela de retenção curta.** A ANBIMA servia 130+ dias úteis do `ms{AAMMDD}.txt` até 21/09/2026; desde 22/09 serve só os arquivos a partir de 11/09/2026 (17 dias úteis em 06/10) — trate como poucas semanas. Regenerar do zero apaga o histórico no Blob de forma silenciosa e irreversível — é a falha de maior consequência e menor detectabilidade de todo o pipeline.

**Preserve o histórico completo no builder, mesmo quando o gráfico mostra recorte.** Médias históricas e percentis se calculam no Python. Truncar no fetch foi o que quebrou IPCA (24m), PNAD (24 trimestres), PIM/PMC/PMS (60/24m) e o deflator de todo o painel Emprego.

**Janela de cálculo não é janela visual.** Visual de 60 meses por padrão; o cálculo começa em `max(start_date)` das séries do modelo, declarado em `INPUTS` ou `min_start_date` no JSON, com alerta quando uma série nova truncar o histórico.

**Falhar o build é melhor que renderizar card vazio.** Aborte quando: série com 0 pontos; metadados vazios; magnitude fora do esperado; unidade divergente do metadado (`UNINOME` no Ipeadata, unidade da variável no SIDRA); gap de continuidade acima de N meses; dependência cross-builder ausente. Esses seis checks teriam pego sozinhos cinco dos bugs históricos.

**Versione o schema dos JSONs** (`schema_version`, aditivo). Os crons regeneram os blobs sozinhos: mudança de schema sem gate derruba painel em produção sem ninguém tocar em nada. Mantenha fallback na rota enquanto o Blob não tiver o schema novo.

**Ragged-edge tolerante:** `--soft-fail`, `freshness_status` por bloco, "Última atualização" por card, cron idempotente. Nunca all-or-nothing com mais de 20 fontes de calendários distintos.

**Nunca exiba componente derivado por resíduo.** Baixe todas as parcelas publicadas e use o resíduo só como auditoria. Identidade contábil com tolerância **absoluta**, não percentual, quando o agregado cruza zero.

**Acumulado 12 meses sempre por composição geométrica encadeada**, nunca por soma de variações mensais — a soma diverge de 0,1 a 0,3 p.p. do oficial. Já mordeu IPCA e IGP-M.

**Dessazonalização própria se declara como tal** ("dessazonalização própria (STL)"), com nota de que a série revisa retroativamente a cada mês. Fatores sazonais próprios usam mediana ou excluem 2020-21; STL com `robust=True`.

**Zero número hardcoded em prosa ou TSX** — interpole do JSON ou estampe o ano de referência.

**Princípio arquitetural: tudo por API pública automática. Sem PDF mensal manual.** É por isso que PMI, ABCR, SindusCon e ABRAS estão fora — não é esquecimento.

**O motor de cálculo é inegociável.** O frontend exibe o output de um pipeline versionado; nunca reimplementa nem aproxima o modelo. Uma tentativa de calcular a Selic implícita v2 no client foi rejeitada por isso. Se precisa do número em D+0, rode o mesmo script com input fresco.

---

## 2. Falhas silenciosas conhecidas

**A tela "Saúde dos Dados" só olha `generated_at`.** Um JSON vazio com timestamp fresco aparece como OK. Não a use como prova de que o dado está certo. A exceção é o builder que grava `freshness_status` no payload (`stale` vira aviso, `missing` vira erro) — o `build_anbima_tpf.py` grava.

**Curva TPF congelada com carimbo fresco (22/09 a 06/10/2026).** Em 22/09 a ANBIMA encolheu o arquivo público `ms{AAMMDD}.txt` de 130+ dias úteis para só os dias a partir de 11/09 (8 no run de 23/09, 17 em 06/10; antes disso dá 404). O `build_anbima_tpf.py` descartava vencimento com menos de 30% de `--business-days` (39) pontos **na janela baixada** — com 8 a 17 dias descartou todos, e o merge recebeu payload vazio (delta 0). Só que o `last_data_date` saía das linhas baixadas, antes do filtro: o JSON dizia 05/10 com as 60 séries paradas em 21/09, e o step (`continue-on-error`) e a "Saúde dos Dados" ficaram verdes. Consumidores com forward-fill (NTN-B ~10a do prêmio de risco em Bolsa > Analítico, spread IPCA+ das debêntures) serviram a NTN-B de 21/09 como se fosse do dia: em 05/10, depois do rali pós-1º turno, a NTN-B ~10a do card estava em 7,58% contra 7,01% real, e o prêmio EY vs NTN-B saía 0,95 p.p. em vez de 1,52. Correção em 06/10: sem filtro de observações; `last_data_date` calculado das séries (a menor data entre PRE e IPCA, e a de cada categoria dentro dela); `freshness_status`; trava que reprova a run quando PRE ou IPCA fica mais de 2 dias úteis atrás de D-1; abortar sem upload quando o JSON atual do Blob não puder ser lido. Regras que valem para qualquer builder: **carimbo de data se calcula do que foi gravado, nunca do que foi pedido ou baixado**; filtro de mínimo de observações antes de merge incremental tem que ser relativo ao que a fonte entregou. Com a janela da ANBIMA em poucas semanas, trava disparada se conserta no mesmo dia: dia que sai da janela não volta.

**Cascata ANFAVEA.** O scraper baixava só o XLSX do ano corrente, então `by_mes` ficava com 4 pontos, o YoY virava null por falta de base do ano anterior, a difusão perdia inputs (exige pelo menos 2 vivos), `sensiveis_presentes` ia a zero e o KPI de recessão do hero congelava. **Nada disso levanta exceção.** Correção: loop de 2019 até o ano corrente (`siteautoveiculos{ANO}.xlsx`, layout WIDE com header Jan-Dez e linha "Total" abaixo). Manutenção anual obrigatória.

**yfinance a partir da 0.2.50 retorna `dividendYield` já em porcentagem.** Multiplicar por 100 rendeu "PETR4 = 942%" em produção. Mantenha a guarda de sanidade DY acima de 30% gerando warning. O `requirements.txt` não tem pinning: uma release ruim do yfinance derruba panorama, market, FII e ações no mesmo dia.

**Salários do CAGED trazem outliers de declaração na fonte** — 28 de 76 meses estavam contaminados em produção, com fev/25 marcando média de R$ 395 mil. Use teto de sanidade de 120 salários mínimos **e** medianas. O saldo bruto engana: abr/26 cru marca +86k e vira −95k dessazonalizado.

**Parser do RTN depende de números de linha fixos** da aba 1.1 do XLSX do SISWEB (linhas 6, 29, 38 a 43, 47, 52, 57, 65, 66, 74 e 75). Se o STN mexer no layout, o pipeline entrega número errado sem falhar.

**Portal do IBRE dá SSL handshake error a partir do runner do GitHub Actions** — funciona local. É por isso que FGV e CNI vêm por SGS, não por scraping de portal.

---

## 3. Séries com gêmeos venenosos

Estes pares já produziram números errados **no ar**. Ao adicionar indicador novo, valide o código por probe contra a identidade contábil, nunca pelo nome da série.

| Use | Não use | Por quê |
|---|---|---|
| SGS **4192** (PIB 12m em US$) | SGS 4380 | 4380 é PIB mensal em R$ — o erro dobrava todos os indicadores de Contas Externas |
| SGS **22800** (renda primária) | SGS 22740 | 22740 é viagens líquido, subcomponente de serviços |
| SGS **22838** (renda secundária) | SGS 22840 | 22840 é subcomponente e não fecha a identidade BPM6 |
| SGS **189** composto geometricamente | SGS 192 | **Não existe código SGS para o IGP-M 12m.** Em mai/2021 o 192 dá 2,22 contra 37,04% oficial, e a série começa em 1944, antes de o IGP-M existir |
| `data/atividade_pim.json` (SIDRA) | Ipeadata `pim_pf_geral` | a série do Ipeadata está corrompida e foi removida de propósito — não recoloque |
| SIDRA **7527 / 7530** | `PNADS_BOTTOM40`, `PNADS_MIDDLE50` | não existem |
| Saldos PF **20541 / 20570 / 20606 / 20612 / 20581 / 20590 / 20579 / 20574 / 20573 / 20609** | 20631, 20680 | estes dois são concessões, não saldos |
| SIDRA 1737 v2266 (índice IPCA) | SGS 433 | 433 é variação, não índice — não serve de deflator direto |
| Endividamento e comprometimento: séries **29xxx** | 19xxx | as 19xxx foram descontinuadas em ago/2021 |

Validação do IGP-M composto contra os valores oficiais da FGV: dez/2020 = 23,14; mai/2021 = 37,04; dez/2023 = −3,18; dez/2024 = 6,54 — diferença de até 0,023 p.p. Identidade dos saldos PF: `20570 + 20606 = 20541`, com residual abaixo de 10 a 12%.

**Séries mortas confirmadas:** SGS 7 (Ibovespa), SGS 25255 (serviços subjacentes, morta em 2019), SGS 7806/7808/7827 (404), FRED `BRALOLITONOSTSAM` (parado em jan/2024), DBnomics OECD MEI (dez/2023), `IIE_BR` e `FGV12_IIEBR12` no Ipeadata (vazias).

**SGS 4189 é Selic efetiva, não swap pré-360d.** As features `term_spread` e `real_ex_ante` do probit foram construídas sobre essa premissa errada. **[verificar]**

---

## 4. Catálogo por painel

### Inflação
SIDRA 7060 (v63/v66/v2265) e 7062 — a 7060 só existe a partir de jan/2020. Núcleos: SGS 4466, 16121, 11427, 27838, 27839 e 28751; a média dos núcleos usa 5 medidas (EX0, EX3, MS, DP e P — MA fora). Difusão: SGS 21379, com janelas estatísticas truncadas a partir de jan/1996, já que a média desde 1991 nasce contaminada pela hiperinflação. Livres 4448, monitorados 4449, serviços 11428, comercializáveis 27864, IPCA 12m 13522, dólar venda 3698.

Momentum é a média móvel de 3 meses dessazonalizada; o acumulado de 12 meses mede cumprimento de meta, não tendência. A meta contínua de 3,0% com banda de 1,5 p.p. fica visível em todo gráfico de 12 meses, expectativa ou breakeven. Breakeven usa Svensson da ETTJ ANBIMA, não razão de YTMs com cupom — `selic_implicita.json` é curva DI e não serve.

Os pesos efetivos do IGP-M são irreconstruíveis (o INCC-M começa por volta de 1997, depois da base), então renormalize as contribuições pelo resíduo mensal.

### Atividade
Contribuições ao PIB com peso nominal de t−4 (SIDRA 1846), importações com sinal trocado e estoques como resíduo; índices encadeados não são aditivos, valide com tolerância de ±0,3 p.p. Momentum 3m/3m é mm3(t) sobre mm3(t−3), **não anualizado** — convenção do BCB e do IBGE. Nível sempre rebasado em fev/2020 = 100, nunca índice cru. Retropolação por pesquisa: PIM desde 2002, PMC restrito desde 2000 e ampliado por volta de 2003/04, PMS só desde 2011 — builders precisam tolerar inícios distintos. Pico da indústria é 2011, calculado dinamicamente.

### Fiscal — convenções Dalio
O escopo do Termômetro é **Governo Central**, único com soberania monetária. "Government Revenue" é a Receita Líquida do Tesouro em 12 meses, após transferências constitucionais. "Interest Rate" é o custo médio efetivo (juros 12m dividido pela DBGG), **não a Selic over**. "Growth Rate" é PIB real YoY somado ao IPCA 12m. Fórmula iterativa do livro: `R(t+1) = R(t) × (1+i)/(1+g) + primary_deficit`.

**Convenção Dalio: déficit primário positivo significa déficit — flip em relação à convenção brasileira.** Inverter isso corrompe a trajetória inteira da dívida, e o gráfico continua parecendo plausível. Limiar "BREAK Dalio": juros sobre receita líquida acima de 30%.

Primário estabilizador (Blanchard): `p* = (r−g)/(1+g) × DBGG_{t−1}`, com g igual ao PIB nominal 12m YoY (SGS 4382), calculado uma única vez no pipeline.

Limite do arcabouço (LC 200/2023): 70% do crescimento real da receita de 12 meses até junho de t−1, com piso de 0,6% e teto de 2,5%, deflacionado mês a mês. Entra como constante auditável, não como fórmula recalculada. As metas da LDO são **hardcoded de propósito** — é a única série editorial do painel e não existe API. Audite contra as LDOs vigentes: 2025 = 0,00; 2026 = +0,25; 2027 = +0,50; banda só a partir de 2024.

Referências de dívida: cerca de 70% do PIB (FMI, emergentes) e 90% (Reinhart-Rogoff, com a ressalva de Herndon 2013). Nunca 100% nem 80%. REER (SGS 11752, jun/1994 = 100): **alta significa depreciação real** — semaforize a variação, não o nível.

Despesa: "outras obrigatórias" (RTN 4.3) já contém abono, BPC, FUNDEB e subsídios, então use o residual "demais obrigatórias" e nunca some o agregado. O pipeline do RTN emite valores **já em bilhões** — formatador que assume milhões produz "R$ 427 mi" para a despesa de Pessoal. Asserts obrigatórios no builder: soma das fatias aproximadamente igual ao total reportado; `primario_sp − juros_sp ≈ −nfsp_sp`; banda da LDO só em ano com meta vigente.

**Limitação conhecida e deliberada:** DBGG (governo geral) dividida pela Receita do Tesouro (governo central) mistura escopos e infla o ratio para 435%. Não "conserte" o denominador — o que falta é a nota metodológica ou um toggle. E nunca reescreva que "juros superam previdência e pessoal somados": é empiricamente falso, juros são a segunda maior linha, atrás da previdência.

Fontes fiscais: SGS 13762, 4513, 4503, 5727, 5717, 5718, 5728, 4382, 22099, 13522, 1178, 13621 e 11752.

### Ciclo e Visão Geral
A datação é **CODACE**, em fonte única (`visao_geral_codace.json`, datação mensal para séries mensais), hardcoded e terminando em 2020 — depois de jun/2020 se pinta faixa hachurada, não se data. Recessão nova exige edição manual do builder. Não construa cronologia própria.

**Bry-Boschan fica fora do ensemble probabilístico** (`MODELOS_PROB = ("msdfm", "probit_financeiro", "gap_threshold", "diffusion")`), porque Harding-Pagan é datador e não probabilizador. O modelo chamado `"msdfm"` no código é, na verdade, **MS-AR univariado sobre o IBC-Br (Hamilton 1989)** — rotular como MS-DFM na tela é desonesto enquanto não for multivariado de verdade.

O filtro de Hamilton tem viés pós-COVID: hiato de +5,67% contra ±1% do HP, de 3 a 5 p.p. de diferença. Não publique a mediana dos dois — mostre lado a lado, com aviso de divergência. Referência: Quast & Wolters (2020). O BCB usa 7 métodos de hiato e a dispersão em 2024 vai de −0,3% a +2,4%. Tendência exata: `indice_sa / exp(gap/100)`.

Pesos do ICF seguem **Hatzius et al. (2010)**: Selic real 50%, Ibovespa 6 meses 25%, REER 25%. A citação "BCB WP 305 (Pereira da Silva 2014)" que está no comentário do código **está errada** — o paper do FCI Brasil é **BCB WP 435 (Gaglianone & Areosa 2016)**. **[verificar]** A Selic real ex-ante é a Selic (ou o swap 360d) deflacionada pela Focus de IPCA 12 meses à frente suavizada, não pela mediana do ano-calendário nem pelo IPCA realizado.

Probit segue Estrella-Mishkin (1998) adaptado. Os thresholds 65/35 são de **Chauvet-Hamilton (2006)**, não de Hamilton (2011). Não exiba AUC nem hit-rate sem cálculo real em janela expansiva sem vazamento; restrinja event-study a 2003 ou depois e declare o n.

`var_3m` do IBC-Br é variação ponta a ponta, **não** momentum — crie `var_mm3_3m` no builder e replique a mesma definição no PIM. A banda neutra de crescimento centra no potencial, por volta de 0,5% t/t, não em zero; zero só é neutro para o hiato. O relógio do ciclo usa gap HP no eixo X e a variação em 3 meses do gap no eixo Y, não crescimento bruto.

Confiança FGV vem por SGS 21859 a 21866 (ICE, ICI, ICOM, ICS, ICST, ICA e ICC) e o ICEI da CNI por SGS 7341 a 7343. **As escalas são incompatíveis:** a FGV usa 100 como neutro e a CNI usa 50. Comparar ICE 104,2 com ICEI 46,6 diretamente inverte a leitura. O OECD CLI vem por **DBnomics** (MEI_CLI BR amplitude-adjusted), em destaque dentro de Antecedentes, com aviso quando a defasagem passa de 12 meses.

### Emprego
Saldo é fluxo líquido: nunca receba variação percentual anual nem gráfico de pizza — compare em delta absoluto. Momentum é a média móvel de 3 meses dessazonalizada; a de 12 meses atrasa viradas em cerca de 6 meses. Valores em reais sempre reais por default. A PNADC tem hiato entre o 2T2020 e o 1T2022 em várias tabelas, e nem STL nem X-13 aceitam buracos; informalidade (tabela 8529) só existe desde o 4T2015. Explicite a janela amostral — trimestre calendário, trimestre móvel ou declarações no prazo — em toda legenda. A massa da tabela 6392 já vem real, deflacionada pelo IBGE, e é massa do **trabalho**, não "massa ampliada". Rotatividade oficial é o mínimo entre admissões e desligamentos, dividido pelo estoque médio.

As distribuições do CAGED quebras refletem apenas as declarações no prazo, algo entre 40 e 50% do saldo oficial. Para saldo absoluto use `emprego_caged_total.json`, que vem do IPEADATA.

### Famílias
Concentração de renda por SIDRA 7527 e 7530 (PNADC anual); o WID não é intercambiável com pesquisa domiciliar, porque o conceito DINA fica em outro nível. Mediana de renda não existe como variável na PNADC do SIDRA — obtenha como P50, o limite superior da classe até 50%, nas tabelas 7526, 7536 e 7540, em cadência anual. SIDRA 6390 e 6389 são trimestre móvel com período mensal: 170 períodos cobrem 2012 a 2026, não 30.

Rendimentos da PNADC já vêm deflacionados por deflatores construídos a partir do IPCA — não re-deflacione, e não documente como INPC. Para benefícios sociais de baixa renda, o deflator canônico é o INPC. O IPCA por faixa de renda (DIMAC_INF) vem em percentual ao mês: componha 12 meses antes de plotar, e use o IPCA cheio como régua, porque a meta é definida para ele e não para as cestas reponderadas do IPEA.

Cesta básica DIEESE: a cobertura de capitais varia ao longo do tempo (27, depois 17, depois 27), e agregar com `min_cobertura=20` produz uma série de 46 pontos com um buraco de 6 anos e meio. Use painel fixo de capitais ou âncora única, com nota; a metodologia do DIEESE usa salário mínimo **líquido**, não bruto sobre 220 horas.

**Proibido limiar inventado sem fonte citável.** A "faixa de risco de 50%" do endividamento não existe na literatura nem no REF do BCB. Para comparação internacional use household debt-to-disposable-income da OCDE, não o BIS, que publica em percentual do PIB.

### Contas Externas
Fluxos de balanço de pagamentos em acumulado de 12 meses por default; mensal bruto só contra o mesmo mês do ano anterior. Régua de reservas: **3 meses de importação de bens e serviços é a regra de bolso do FMI** — o patamar de 6 meses é convenção editorial da casa, não do Fundo. Com cerca de 16 meses de cobertura, a métrica que discrimina para o Brasil é Guidotti-Greenspan ou ARA, e ARA exige dívida externa de curto prazo, que não tem série SGS garantida.

Conta corrente usa referências assimétricas — déficit acima de 4 a 5% é zona de risco — e não banda simétrica de ±2%; a cobertura por investimento direto é o qualificador. Comex e SECEX servem só para composição: saldos e totais vêm sempre do BPM6 do BCB, com rodapé avisando que saldo Comex não é saldo de BP. Mantenha a cesta de seções fixa nos dois períodos ao calcular contribuição anual.

**Revisões do BCB em julho (CBE) e novembro (Censo) reescrevem a série histórica** — campo `revised_at` e log de diff são obrigatórios.

**Cockpit v3 (set/2026, `contas_externas_v3.py`).** Tabela mestra com TODAS as linhas do BPM6 mensal: conta capital 22851, conta financeira 22863 = investimento direto 22864 (IDE 22865, IDP 22885 → 22891/22892/22893) + carteira 22905 (ativos 22906; passivos 22924 → ações 22927, fundos 22936, títulos 22939 = doméstico 22942 + externo 22945) + derivativos 22966 + outros investimentos 22969 (ativos 22970; passivos 22971 → empréstimos 22994, créditos comerciais 23026) + ativos de reserva 23043; erros e omissões 23060. Convenção BPM6: líquido = ativos − passivos, **negativo = entrada**. Identidade auditada: TC + KK − CF + EO = 0 (fecha em 379 meses com tolerância de US$ 150 mi). PII trimestral 24010–24068 (a data do SGS é o 1º mês do trimestre). **Não há série SGS de dívida externa bruta BPM6** (3558–3600 morreram em 2012; 28192+ é crédito ampliado em R$): a dívida de curto prazo do Guidotti-Greenspan é montada dos passivos da PII por PRAZO ORIGINAL (24053 + 24058 + 24061 + 24064 + 24066) — é teto do indicador oficial (prazo residual). Câmbio contratado diário: 13961 total, 13967 comercial, 13970 financeiro (desde 2009). Nomes de séries SGS: o SOAP `https://www3.bcb.gov.br/wssgs/services/FachadaWSSGS` (`getUltimoValorXML`) devolve nome, periodicidade e último valor — use para mapear código antes de usar. Câmbio (build_cambio_macro, bloco `extras`): REER-IPA 11757, efetivo nominal 20360, real × US$ oficial 11753, IC-Br 27574 (R$) / 29042 (US$), termos de troca FUNCEX via Ipeadata `FUNCEX12_TTR12`, PPC do Banco Mundial `PA.NUS.PPP` (a API do FMI dá 403 fora de navegador). O ranking do Comex é de **3 meses** apesar da chave `periodo_12m` (a API estoura em NCM × 12m).

### Selic implícita e mercado
`src/lib/selic-forward.ts` replica exatamente `data-pipeline/r/build_selic_implicita.R`, inclusive a lista `COPOM_DECISION_DATES`, que precisa ser mantida em dia nos dois lugares. O `round_step_up`, que arredonda para cima em passos de 0,25%, faz o nível exibido pular entre 14,25 e 14,50 com movimento intraday mínimo: **é característica, não bug**. Trocar por arredondamento para o mais próximo divergiria da trilha de política monetária.

B3, DI1 e DAP: `cotacao.b3.com.br/mds/api/v1/DerivativeQuotation/{DI1,DAP}` tem atraso de cerca de 15 minutos e CORS aberto. Faça o fetch **sempre client-side** — o datacenter recebe cache velho de meses.

Focus: `https://olinda.bcb.gov.br/olinda/servico/Expectativas/versao/v1/odata/ExpectativasMercadoAnuais`, endpoint público e sem token.

### Taxas básicas pelo mundo (Juros Globais)
Gráfico "Taxas básicas de juros pelo mundo" no topo de `/painel-economico/mercado/global/juros-globais`. Catálogo e cálculos em `src/lib/policy-rates.ts`, fetch em `src/lib/policy-rates-server.ts`, rota `/api/global-rates/policy-rates`, sonda `live_policy_rates` no data-manifest.

Fonte única: **BIS WS_CBPOL** — `https://stats.bis.org/api/v1/data/WS_CBPOL/D.{CC}/all?format=csv&detail=dataonly&startPeriod=2000-01-01`, grátis, sem chave, ~200 KB por país. Use **sempre `detail=dataonly`**: o CSV completo tem campos entre aspas com vírgula dentro (notas de compilação) e quebra o split ingênuo. A série é diária **corrida**: fim de semana e feriado vêm como `"NaN"` — sem descartar, cada fim de semana vira duas "mudanças" de taxa falsas (Chile deu 662 mudanças desde 2021). Compare valores numericamente arredondados (3 casas). Defasagem de cerca de 1 semana; a Colômbia chega a 12 dias e a Coreia do Sul a 5 semanas (por isso a coluna "Dados até" por país).

Quebras de definição dentro da própria série do BIS (as notas vêm na coluna `COMPILATION`/`SUPP_INFO_BREAKS` do CSV completo) — tratadas com corte `since` no catálogo:
- **México** até 20/01/2008 é a *bank funding rate* (taxa de mercado, oscila todo dia — 1.458 "mudanças"); só a partir de 21/01/2008 é a meta do Banxico.
- **Indonésia** troca a BI rate pela 7-day reverse repo em 19/08/2016: o salto de 6,50 para 5,25 **não foi corte** (nota do próprio BIS).
- **Chile** antes de 09/08/2001 a taxa era real (indexada à inflação defasada).
- **Zona do Euro**: o BIS publica a MRO até 17/09/2024 e a taxa de depósito depois — a emenda cria um corte falso de 0,75 p.p. e um "pico do ciclo" de 4,50 que nunca existiu na taxa que guia o mercado. Por isso o euro vem do **BCE** (`data-api.ecb.europa.eu/service/data/FM/D.U2.EUR.4F.KR.DFR.LEV`, taxa de depósito, histórico inteiro, atualizada no dia); se o BCE falhar, cai para o BIS só a partir de 18/09/2024.
- **EUA** = ponto médio da banda do Fed (3,875 = banda 3,75–4,00; a tabela mostra a banda). **China** = LPR 1 ano desde 20/08/2019 (antes, taxa oficial de empréstimo de 1 ano — degrau pequeno, mantido).

Fora do gráfico de propósito: Turquia (acima de 35% achata a escala) e Índia (série do BIS parada há meses). "Situação" = direção da última decisão se ela ocorreu nos últimos 100 dias, senão "Pausa"; "vs. pico" = taxa atual menos a máxima desde jan/2021.
