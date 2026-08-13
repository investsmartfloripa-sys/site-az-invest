"use client";

import { useMemo, type ReactNode } from "react";

import { KpiCard } from "@/components/painel/core";
import { MethodInfo } from "@/components/painel/core/MethodInfo";
import { FiscalTabs } from "@/components/painel/fiscal/v2/FiscalTabs";
import { SimuladorTrajetoria } from "@/components/painel/fiscal/SimuladorTrajetoria";
import type { FiscalTermometroData, PontoMensal } from "@/lib/painel-fiscal";
import { fmtMesCurto, fmtNum, fmtPct, fmtSignedNum } from "@/lib/format-br";
import { DividaRendaCard, JurosInflacaoCrescimentoCard, PoupancaCard } from "./Dalio4Cards";
import { LeverCard, MatrizDalio, viabilidadeLever } from "./LivroDalio";
import { EmbiCard, ProjecaoDbggCard, SpreadSoberanoCard } from "./MercadoProjecaoCards";
import { RiskSeriesCard } from "./RiskSeriesCard";
import { DistribuicaoBar, SemaforoTempoGrid } from "./SemaforoTempo";
import { dataIso, deltaDozeMeses, toPoints } from "./shared";

/**
 * Indicadores de Risco Fiscal — COCKPIT de monitoramento (não narrativa).
 *
 * Estrutura: status geral (distribuição + 4 KPIs) → os 4 indicadores
 * prioritários de Dalio em grade → os 20 indicadores no tempo → mercado e
 * cenários → ferramentas do livro. Rótulos técnicos; contexto editorial fica
 * atrás dos ícones (?) e da ficha técnica.
 */

function Divisor({ label, info }: { label: string; info?: ReactNode }) {
  return (
    <div className="flex items-center gap-3 pt-1">
      <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
        {label}
        {info ? <MethodInfo className="ml-1.5 align-middle">{info}</MethodInfo> : null}
      </span>
      <div className="h-px flex-1 bg-[#132960]/10" />
    </div>
  );
}

export function PainelRiscoFiscalV2({ data }: { data: FiscalTermometroData }) {
  const dalio4 = data.dalio4!;
  const indicadores = data.indicadores_semaforo ?? {};
  const categorias = data.categorias_ordem ?? [];
  const lev = data.levers;
  const foto = data.foto_brasil;
  const giro = data.gerado_em;
  const dado = data.fonte_base;

  const derivados = useMemo(() => {
    // Séries lidas de indicadores_semaforo (fonte única — dalio4 não duplica mais).
    const dividaReceita = deltaDozeMeses(indicadores.dbgg_pct_receita?.serie);
    const servico = deltaDozeMeses(indicadores.juros_pct_receita?.serie);
    const gapSerie: PontoMensal[] = dalio4.juros_inflacao_crescimento.serie.map((p) => ({
      data: p.data,
      valor: p.r_menos_g_pp,
    }));
    const gap = deltaDozeMeses(gapSerie);
    const poupSerie: PontoMensal[] = dalio4.divida_servico_poupanca.serie.map((p) => ({
      data: p.data,
      valor: p.juros_pct_poupanca,
    }));
    const jurosPoupanca = deltaDozeMeses(poupSerie);
    return { dividaReceita, servico, gap, jurosPoupanca };
  }, [dalio4, indicadores]);

  // Onda 3: serviço TOTAL (juros + principal vincendo 12m) ÷ receita — benchmark
  // tracejado no card de serviço; ausente enquanto o blob DPF não existir.
  const servicoTotalPts = useMemo(
    () =>
      toPoints(
        (data.servico_total?.serie ?? []).map((p) => ({ data: p.data, valor: p.valor_pct_receita })),
      ),
    [data.servico_total],
  );

  const mesRef = dado ? fmtMesCurto(dataIso(dado)) : "—";

  return (
    <div className="flex flex-col gap-4">
      <FiscalTabs />

      {/* ── Status geral ── */}
      <header className="rounded-2xl border border-[#132960]/10 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-[#132960]">
              Indicadores de Risco Fiscal
              <MethodInfo className="ml-2 align-middle">
                Framework de &quot;How Countries Go Broke&quot; (Ray Dalio, 2025) aplicado ao Brasil. Os 4 indicadores
                prioritários do livro abrem o painel; os 20 semaforizados vêm abaixo, todos como séries históricas com
                as zonas de risco ao fundo. Faixas calibradas pela AZ a partir dos casos históricos do livro — não são
                números do livro.
              </MethodInfo>
            </h1>
            <p className="mt-1 text-xs text-zinc-500">
              Referência: {mesRef} · BCB SGS + Tesouro RTN + IBGE CNT · pipeline fiscal AZ (diário)
            </p>
          </div>
        </div>
        {Object.keys(indicadores).length > 0 ? (
          <div className="mt-4">
            <DistribuicaoBar indicadores={indicadores} />
          </div>
        ) : null}
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          label="Dívida / Receita"
          value={derivados.dividaReceita ? fmtPct(derivados.dividaReceita.valor, 0) : "—"}
          delta={derivados.dividaReceita?.delta12m ?? undefined}
          deltaUnit="p.p."
          deltaHint="12m"
          invertColor
          hint={
            derivados.dividaReceita
              ? `${fmtNum(derivados.dividaReceita.valor / 100, 1)}× a receita anual`
              : "DBGG ÷ receita líquida 12m"
          }
          size="lg"
        />
        <KpiCard
          label="Juros / Receita (GC)"
          value={derivados.servico ? fmtPct(derivados.servico.valor, 1) : "—"}
          delta={derivados.servico?.delta12m ?? undefined}
          deltaUnit="p.p."
          deltaHint="12m"
          invertColor
          hint="juros nominais 12m (gov. central)"
        />
        <KpiCard
          label="r − g"
          value={derivados.gap ? fmtSignedNum(derivados.gap.valor, 1) : "—"}
          unit="p.p."
          delta={derivados.gap?.delta12m ?? undefined}
          deltaUnit="p.p."
          deltaHint="12m"
          invertColor
          hint="taxa implícita DLSP − g nominal 12m"
        />
        <KpiCard
          label="Juros / Poupança (GC)"
          value={derivados.jurosPoupanca?.valor != null ? fmtPct(derivados.jurosPoupanca.valor, 0) : "—"}
          delta={derivados.jurosPoupanca?.delta12m ?? undefined}
          deltaUnit="p.p."
          deltaHint="12m"
          invertColor
          hint="juros 12m ÷ poupança bruta 4T"
        />
      </div>

      {/* ── Prioritários Dalio ── */}
      <Divisor
        label="Prioritários do framework"
        info="Os 4 indicadores que o livro trata como primários: dívida vs renda; serviço da dívida vs renda; juro nominal vs inflação e vs crescimento nominal; dívida e serviço vs poupança."
      />
      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
        <DividaRendaCard
          dalio4={dalio4}
          indicadorReceita={indicadores.dbgg_pct_receita}
          indicadorPib={indicadores.dbgg_pct_pib}
          stampGiro={giro}
        />
        <RiskSeriesCard
          id="servico-renda"
          title="Serviço da dívida / Receita"
          subtitle="Juros nominais 12m ÷ receita líquida 12m (gov. central, RTN)"
          series={[
            {
              id: "servico_receita",
              label: "Juros nominais 12m / Receita líquida",
              color: "#132960",
              data: toPoints(indicadores.juros_pct_receita?.serie),
            },
          ]}
          benchmarks={
            servicoTotalPts.length > 0
              ? [
                  {
                    id: "servico_total",
                    label: "serviço total incl. rolagem de principal",
                    color: "#94A3B8",
                    data: servicoTotalPts,
                  },
                ]
              : undefined
          }
          faixas={dalio4.servico_renda.faixas}
          nivel={indicadores.juros_pct_receita?.nivel}
          valorAtual={
            indicadores.juros_pct_receita?.valor != null
              ? fmtPct(indicadores.juros_pct_receita.valor, 1)
              : undefined
          }
          height={280}
          showLegend={servicoTotalPts.length > 0}
          footer={
            <span>
              {dalio4.servico_renda._nota} {dalio4.servico_renda.faixas.fonte}
              {servicoTotalPts.length > 0 && data.servico_total ? <> {data.servico_total._nota}</> : null}
            </span>
          }
          stampGiro={giro}
        />
        <JurosInflacaoCrescimentoCard
          dalio4={dalio4}
          indicadorGap={indicadores.r_menos_g_pp}
          stampGiro={giro}
        />
        <PoupancaCard dalio4={dalio4} stampGiro={giro} />
      </div>

      {/* ── Todos os indicadores ── */}
      {Object.keys(indicadores).length > 0 && categorias.length > 0 ? (
        <>
          <Divisor
            label="Os 20 indicadores no tempo"
            info="Grade de monitoramento por categoria. Clique num card para abrir a série completa com seletor de período. Alavancas (categoria E) são prescritivas — medem o tamanho do ajuste, não têm série."
          />
          <SemaforoTempoGrid indicadores={indicadores} categorias={categorias} stampGiro={giro} stampDado={dado} />
        </>
      ) : null}

      {/* ── Mercado e cenários ── */}
      {data.spread_soberano?.serie?.length || data.embi?.serie?.length || data.projecao_dbgg?.anos?.length ? (
        <>
          <Divisor
            label="Mercado e cenários"
            info="Spread soberano vivo = o preço ATUAL que o mercado cobra do risco Brasil (proxy declarada no card). EMBI+ = o preço que o mercado cobrava (fonte pública descontinuada em 2024 — o card mantém o histórico). Projeção da DBGG = dinâmica de dívida do livro alimentada pelas medianas do Focus; ilustrativa, sem efeito câmbio."
          />
          <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
            {data.spread_soberano?.serie?.length ? (
              <SpreadSoberanoCard spread={data.spread_soberano} stampGiro={giro} />
            ) : null}
            {data.projecao_dbgg?.anos?.length ? (
              <ProjecaoDbggCard projecao={data.projecao_dbgg} stampGiro={giro} />
            ) : null}
            {data.embi?.serie?.length ? <EmbiCard embi={data.embi} stampGiro={giro} /> : null}
          </div>
        </>
      ) : null}

      {/* ── Ferramentas do livro ── */}
      <Divisor
        label="Ferramentas do livro"
        info='Matrizes de sensibilidade e os 4 levers de "How Countries Go Broke". Leitura AZ: nenhum lever sozinho resolve o caso brasileiro em magnitude politicamente plausível — o livro prevê combinação de dois ou mais (caso análogo: Reino Unido 1976). Os levers usam o perímetro do livro (DBGG ÷ receita do governo central, estabilizando Dívida/Receita) e por isso pedem ajustes maiores que o primário estabilizador p* dos KPIs, calculado no perímetro consolidado sobre Dívida/PIB. Os dois números são consistentes entre si — medem alvos diferentes. CONVENÇÃO DE SINAL: dentro destas ferramentas vale a convenção do livro (déficit primário positivo); no restante da seção fiscal, positivo = superávit (STN).'
      />
      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
        <div className="rounded-2xl border border-[#132960]/10 bg-white p-4 shadow-sm">
          <h2 className="mb-2 text-base font-bold text-[#132960]">Dívida/Receita em 10 anos — por déficit</h2>
          <MatrizDalio
            matriz={data.matrizes.endlevel_por_deficit}
            eixoX={data.matrizes.endlevel_por_deficit.eixo_x_deficit ?? []}
            labelY="Dívida/Receita HOJE"
            labelX="Déficit primário anual (% Receita)"
            premissaTexto="Assume i = g (cenário simplificado do livro): isola o efeito do déficit primário acumulado."
          />
        </div>
        <div className="rounded-2xl border border-[#132960]/10 bg-white p-4 shadow-sm">
          <h2 className="mb-2 text-base font-bold text-[#132960]">Dívida/Receita em 10 anos — por gap r − g</h2>
          <MatrizDalio
            matriz={data.matrizes.endlevel_por_gap}
            eixoX={data.matrizes.endlevel_por_gap.eixo_x_gap_pp ?? []}
            labelY="Dívida/Receita HOJE"
            labelX="Gap r − g (pontos percentuais)"
            sufX="pp"
            premissaTexto={`Assume déficit primário constante (hoje: ${fmtNum(data.premissas.primary_deficit_pct_receita, 1)}% da receita).`}
          />
        </div>
      </div>

      {lev ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
          {lev.lever_juros && (
            <LeverCard
              numero={1}
              titulo="Baixar juros"
              descricao="Taxa efetiva da dívida que estabiliza Dívida/Receita."
              atual={lev.lever_juros.i_atual_aa}
              alvo={lev.lever_juros.i_estavel_aa}
              delta={lev.lever_juros.delta_pp}
              sufix="% a.a."
              baseLabel="taxa implícita da DLSP (a.a.)"
              viavel={viabilidadeLever(lev.lever_juros.delta_pp, 2)}
            />
          )}
          {lev.lever_inflacao && (
            <LeverCard
              numero={2}
              titulo="Mais inflação"
              descricao="Inflação que elevaria g o suficiente para erodir a dívida."
              atual={lev.lever_inflacao.inflacao_atual_aa}
              alvo={lev.lever_inflacao.inflacao_estavel_aa}
              delta={lev.lever_inflacao.delta_pp}
              sufix="% a.a."
              baseLabel="IPCA 12m"
              viavel={viabilidadeLever(lev.lever_inflacao.delta_pp, 2)}
            />
          )}
          {lev.lever_corte_despesa && (
            <LeverCard
              numero={3}
              titulo="Cortar despesa"
              descricao="Corte na despesa primária consistente com o r−g atual."
              atual={lev.lever_corte_despesa.despesa_atual_pct_receita}
              alvo={lev.lever_corte_despesa.despesa_alvo_pct_receita}
              delta={lev.lever_corte_despesa.corte_pct_da_despesa}
              sufix="% Receita"
              baseLabel="despesa primária / Receita líquida"
              viavel={viabilidadeLever(lev.lever_corte_despesa.corte_pct_da_despesa, 5)}
            />
          )}
          {lev.lever_aumento_receita && (
            <LeverCard
              numero={4}
              titulo="Aumentar receita"
              descricao="Aumento da receita líquida (despesa constante) que estabiliza."
              atual={foto.receita.receita_liquida_pct_pib ?? undefined}
              alvo={
                foto.receita.receita_liquida_pct_pib != null &&
                lev.lever_aumento_receita.aumento_pct_da_receita != null
                  ? foto.receita.receita_liquida_pct_pib * (1 + lev.lever_aumento_receita.aumento_pct_da_receita / 100)
                  : undefined
              }
              delta={lev.lever_aumento_receita.aumento_pct_da_receita ?? undefined}
              deltaTexto={
                lev.lever_aumento_receita.aumento_pct_da_receita != null
                  ? `${lev.lever_aumento_receita.aumento_pct_da_receita >= 0 ? "+" : ""}${fmtNum(lev.lever_aumento_receita.aumento_pct_da_receita, 1)}% de arrecadação`
                  : undefined
              }
              sufix="% PIB"
              baseLabel="receita líquida / PIB"
              viavel={viabilidadeLever(lev.lever_aumento_receita.aumento_pct_da_receita, 5)}
            />
          )}
        </div>
      ) : null}

      {/* Simulador só com insumos macro reais — foto.macro pode vir null (sem fallback inventado). */}
      {foto.juros.taxa_nominal_efetiva_aa != null &&
      foto.macro.pib_real_yoy_pct != null &&
      foto.macro.ipca_12m_pct != null ? (
        <SimuladorTrajetoria
          defaults={{
            debt_pct_receita: data.premissas.debt_pct_receita ?? 435,
            debt_pct_pib: foto.divida.dbgg_pct_pib ?? 80,
            custo_medio_aa: foto.juros.taxa_nominal_efetiva_aa,
            pib_real_yoy: foto.macro.pib_real_yoy_pct,
            ipca_12m: foto.macro.ipca_12m_pct,
            primario_pct_pib:
              foto.deficit_primario.primary_deficit_pct_pib != null
                ? -foto.deficit_primario.primary_deficit_pct_pib
                : -1,
            receita_pct_pib: foto.receita.receita_liquida_pct_pib ?? 18,
          }}
        />
      ) : null}

      {/* ── Ficha técnica ── */}
      <details className="group rounded-2xl border border-[#132960]/10 bg-white p-4 shadow-sm">
        <summary className="cursor-pointer select-none text-sm font-semibold text-[#132960] marker:text-[#027DFC]">
          Ficha técnica — fontes e metodologia
        </summary>
        <div className="mt-3 space-y-2 text-xs leading-relaxed text-zinc-600">
          <p>
            <strong>Framework.</strong> {dalio4._nota}
          </p>
          {data.calibracao_nota ? (
            <p>
              <strong>Calibração das faixas.</strong> {data.calibracao_nota}
            </p>
          ) : (
            <p>
              <strong>Calibração das faixas.</strong> Faixas de risco (seguro / atenção / crítico / ruptura) calibradas
              pela AZ a partir dos casos históricos do livro — não são números do livro.
            </p>
          )}
          <p>
            <strong>Perímetros — honestidade de cálculo.</strong> Dívida/Receita usa DBGG (governo geral) sobre a
            receita líquida do governo central — proxy conservadora, declarada. r, g, r − g e o primário estabilizador
            vêm do bloco de sustentabilidade do pipeline (taxa implícita da DLSP × PIB nominal 12m, perímetro único do
            setor público consolidado) — calculados uma vez, nunca recalculados no front. Serviço da dívida = juros
            nominais 12m (RTN);{" "}
            {servicoTotalPts.length > 0
              ? "o serviço TOTAL (juros + principal vincendo em 12m, RMD/Tesouro) entra como benchmark tracejado no mesmo card — as faixas de risco seguem calibradas para a série de juros."
              : "a rolagem de principal (% vincendo da DPF, RMD/Tesouro) entra como série adicional (servico_total) assim que o pipeline publicar o blob DPF."}
          </p>
          <p>
            <strong>Poupança.</strong> IBGE, Contas Nacionais Trimestrais (SIDRA t/2072): poupança bruta e PIB somados
            em 4 trimestres. Dívida em anos de poupança = DBGG %PIB ÷ taxa de poupança %PIB; juros % poupança = juros
            nominais 12m %PIB ÷ poupança %PIB.
          </p>
          <p>
            <strong>Fontes vivas e mortas.</strong> BCB SGS, Tesouro RTN e IBGE atualizam diariamente via
            fiscal-pipeline.yml. O EMBI+ (IPEADATA/JPM) foi descontinuado na fonte pública em 2024 — o card mantém o
            histórico e diz isso. Projeção da DBGG: ilustrativa, sem efeito câmbio (nota no card).
          </p>
          <p>{data.metodologia}</p>
        </div>
      </details>
    </div>
  );
}
