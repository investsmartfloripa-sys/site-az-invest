"use client";

import { useMemo } from "react";

import { DashboardScaffold, KpiCard, type DashboardBloco } from "@/components/painel/core";
import { SimuladorTrajetoria } from "@/components/painel/fiscal/SimuladorTrajetoria";
import type { FiscalTermometroData, PontoMensal } from "@/lib/painel-fiscal";
import { fmtMesCurto, fmtNum, fmtPct, fmtSignedNum } from "@/lib/format-br";
import { DividaRendaCard, JurosInflacaoCrescimentoCard, PoupancaCard } from "./Dalio4Cards";
import { LeverCard, MatrizDalio, viabilidadeLever } from "./LivroDalio";
import { EmbiCard, ProjecaoDbggCard } from "./MercadoProjecaoCards";
import { RiskSeriesCard } from "./RiskSeriesCard";
import { DistribuicaoBar, SemaforoTempoGrid } from "./SemaforoTempo";
import { dataIso, deltaDozeMeses, toPoints } from "./shared";

/**
 * Indicadores de Risco Fiscal — reforma do Termômetro Fiscal (ago/2026).
 *
 * Duas camadas: leitura rápida no topo (manchete por regra + 4 KPIs + os 4
 * indicadores PRIORITÁRIOS de Dalio como séries com bandas de risco) e
 * esmiuçamento abaixo (20 indicadores no tempo, validador de mercado,
 * projeção com Focus, matrizes do livro, simulador e levers).
 */
export function PainelRiscoFiscalV2({ data }: { data: FiscalTermometroData }) {
  const dalio4 = data.dalio4!;
  const indicadores = data.indicadores_semaforo ?? {};
  const categorias = data.categorias_ordem ?? [];
  const lev = data.levers;
  const foto = data.foto_brasil;

  const derivados = useMemo(() => {
    const dividaReceita = deltaDozeMeses(dalio4.divida_renda.serie_pct_receita);
    const servico = deltaDozeMeses(dalio4.servico_renda.serie_pct_receita);
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
  }, [dalio4]);

  const manchete = useMemo(() => {
    const { dividaReceita, servico, gap, jurosPoupanca } = derivados;
    const partes: string[] = [];
    if (dividaReceita) {
      partes.push(
        `A dívida do governo geral equivale a ${fmtNum(dividaReceita.valor / 100, 1)}× a receita líquida anual do governo central`,
      );
    }
    if (servico) {
      partes.push(`${fmtPct(servico.valor, 1)} da receita já é consumida só pelos juros`);
    }
    if (gap) {
      partes.push(
        gap.valor >= 0
          ? `o custo implícito da dívida corre ${fmtNum(gap.valor, 1)} p.p. acima do crescimento nominal (r − g)`
          : `o crescimento nominal corre ${fmtNum(Math.abs(gap.valor), 1)} p.p. acima do custo da dívida (r − g)`,
      );
    }
    if (jurosPoupanca?.valor != null) {
      partes.push(`os juros absorvem ${fmtPct(jurosPoupanca.valor, 0)} da poupança nacional`);
    }
    const criticos = Object.values(indicadores).filter((i) => i.nivel === "vermelho" || i.nivel === "break").length;
    const total = Object.keys(indicadores).length;
    if (total > 0) partes.push(`dos ${total} indicadores do framework, ${criticos} estão em zona crítica ou pior`);
    return partes.length > 0 ? `${partes.join("; ")}.` : null;
  }, [derivados, indicadores]);

  const kpis = useMemo(() => {
    const { dividaReceita, servico, gap, jurosPoupanca } = derivados;
    return [
      <KpiCard
        key="divida"
        label="Dívida / Receita"
        value={dividaReceita ? fmtPct(dividaReceita.valor, 0) : "—"}
        delta={dividaReceita?.delta12m ?? undefined}
        deltaUnit="p.p."
        deltaHint="12m"
        invertColor
        hint={dividaReceita ? `${fmtNum(dividaReceita.valor / 100, 1)}× a receita anual` : "DBGG ÷ receita líquida 12m"}
        size="lg"
      />,
      <KpiCard
        key="servico"
        label="Juros / Receita"
        value={servico ? fmtPct(servico.valor, 1) : "—"}
        delta={servico?.delta12m ?? undefined}
        deltaUnit="p.p."
        deltaHint="12m"
        invertColor
        hint="serviço de juros do governo central"
      />,
      <KpiCard
        key="gap"
        label="r − g"
        value={gap ? fmtSignedNum(gap.valor, 1) : "—"}
        unit="p.p."
        delta={gap?.delta12m ?? undefined}
        deltaUnit="p.p."
        deltaHint="12m"
        invertColor
        hint="custo da dívida vs crescimento nominal"
      />,
      <KpiCard
        key="poupanca"
        label="Juros / Poupança"
        value={jurosPoupanca?.valor != null ? fmtPct(jurosPoupanca.valor, 0) : "—"}
        delta={jurosPoupanca?.delta12m ?? undefined}
        deltaUnit="p.p."
        deltaHint="12m"
        invertColor
        hint="fração da poupança nacional absorvida"
      />,
    ];
  }, [derivados]);

  const blocos = useMemo<DashboardBloco[]>(() => {
    const out: DashboardBloco[] = [];
    const giro = data.gerado_em;
    const dado = data.fonte_base;

    out.push({
      id: "servico-renda",
      eyebrow: "Prioridade Dalio nº 2",
      titulo: "Serviço da dívida vs renda",
      descricao:
        "Quanto da receita anual o governo gasta só para carregar a dívida — a métrica que Dalio observa antes de qualquer outra fora o estoque.",
      children: (
        <RiskSeriesCard
          title="2 · Serviço da dívida vs renda"
          subtitle="Juros nominais 12m do governo central como % da receita líquida — rolagem de principal entra na fase 2 (RMD)."
          series={[
            {
              id: "servico_receita",
              label: "Juros nominais 12m / Receita líquida",
              color: "#132960",
              data: toPoints(dalio4.servico_renda.serie_pct_receita),
            },
          ]}
          faixas={dalio4.servico_renda.faixas}
          nivel={indicadores.juros_pct_receita?.nivel}
          valorAtual={
            indicadores.juros_pct_receita?.valor != null
              ? `${fmtPct(indicadores.juros_pct_receita.valor, 1)} da receita`
              : undefined
          }
          height={320}
          footer={<span>{dalio4.servico_renda._nota} {dalio4.servico_renda.faixas.fonte}</span>}
          stampGiro={giro}
          stampDado={dado}
        />
      ),
    });

    out.push({
      id: "juro-inflacao-crescimento",
      eyebrow: "Prioridade Dalio nº 3",
      titulo: "Juro nominal vs inflação e crescimento",
      descricao:
        "As duas comparações do livro num só lugar: r contra a inflação (aperto real) e r contra g (aritmética da bola de neve).",
      children: (
        <JurosInflacaoCrescimentoCard
          dalio4={dalio4}
          indicadorGap={indicadores.r_menos_g_pp}
          stampGiro={giro}
          stampDado={dado}
        />
      ),
    });

    out.push({
      id: "poupanca",
      eyebrow: "Prioridade Dalio nº 4",
      titulo: "Dívida e serviço da dívida vs poupança",
      descricao:
        "A pergunta de absorção: a poupança do país dá conta de financiar o governo — e a que preço para o investimento privado?",
      children: <PoupancaCard dalio4={dalio4} stampGiro={giro} stampDado={dado} />,
    });

    if (Object.keys(indicadores).length > 0 && categorias.length > 0) {
      out.push({
        id: "semaforo",
        eyebrow: "Esmiuçamento",
        titulo: "Os 20 indicadores no tempo",
        descricao:
          "Cada indicador do framework com a própria história e as faixas de risco ao fundo — clique num card para abrir a série completa.",
        children: (
          <div className="space-y-4">
            <DistribuicaoBar indicadores={indicadores} />
            <SemaforoTempoGrid indicadores={indicadores} categorias={categorias} stampGiro={giro} stampDado={dado} />
          </div>
        ),
      });
    }

    if (data.embi?.serie?.length) {
      out.push({
        id: "embi",
        eyebrow: "Validador de mercado",
        titulo: "O preço do risco — EMBI+",
        descricao: "Se o semáforo diz uma coisa e o spread soberano diz outra, o leitor merece ver a tensão.",
        children: <EmbiCard embi={data.embi} stampGiro={giro} />,
      });
    }

    if (data.projecao_dbgg?.anos?.length) {
      out.push({
        id: "projecao",
        eyebrow: "Cenários",
        titulo: "Projeção da DBGG com o Focus",
        descricao: "Do abstrato ao concreto: a dinâmica do livro alimentada pelas expectativas reais do mercado.",
        children: <ProjecaoDbggCard projecao={data.projecao_dbgg} stampGiro={giro} />,
      });
    }

    out.push({
      id: "matrizes",
      eyebrow: "As tabelas do livro",
      titulo: "Dívida/Receita depois de 10 anos",
      descricao: "As matrizes de sensibilidade de How Countries Go Broke, com a célula do Brasil destacada.",
      children: (
        <div className="space-y-5">
          <MatrizDalio
            matriz={data.matrizes.endlevel_por_deficit}
            eixoX={data.matrizes.endlevel_por_deficit.eixo_x_deficit ?? []}
            labelY="Dívida/Receita HOJE"
            labelX="Déficit primário anual (% Receita)"
            premissaTexto="Cenário simplificado do livro — assume juros nominais = crescimento nominal (i = g). Isola o efeito do déficit primário acumulado. Valor da célula = Dívida/Receita depois de 10 anos."
          />
          <MatrizDalio
            matriz={data.matrizes.endlevel_por_gap}
            eixoX={data.matrizes.endlevel_por_gap.eixo_x_gap_pp ?? []}
            labelY="Dívida/Receita HOJE"
            labelX="Gap r − g (pontos percentuais)"
            sufX="pp"
            premissaTexto={`Cenário realista — assume déficit primário constante (Brasil hoje: ${fmtNum(data.premissas.primary_deficit_pct_receita, 1)}% da receita). Varia o gap r−g.`}
          />
        </div>
      ),
    });

    out.push({
      id: "simulador",
      eyebrow: "Interativo",
      titulo: "Simule a trajetória",
      descricao: "Mexa nas alavancas e veja a dívida/receita em 10 anos — as premissas partem do dado de hoje.",
      children: (
        <SimuladorTrajetoria
          defaults={{
            debt_pct_receita: data.premissas.debt_pct_receita ?? 435,
            debt_pct_pib: foto.divida.dbgg_pct_pib ?? 80,
            custo_medio_aa: foto.juros.taxa_nominal_efetiva_aa,
            pib_real_yoy: foto.macro.pib_real_yoy_pct,
            ipca_12m: foto.macro.ipca_12m_pct,
            primario_pct_pib:
              foto.deficit_primario.primary_deficit_pct_pib != null ? -foto.deficit_primario.primary_deficit_pct_pib : -1,
            receita_pct_pib: foto.receita.receita_liquida_pct_pib ?? 18,
          }}
        />
      ),
    });

    if (lev) {
      const aumentoReceitaPct = lev.lever_aumento_receita?.aumento_pct_da_receita ?? null;
      const receitaAtualPctPib = foto.receita.receita_liquida_pct_pib;
      const receitaAlvoPctPib =
        receitaAtualPctPib != null && aumentoReceitaPct != null
          ? receitaAtualPctPib * (1 + aumentoReceitaPct / 100)
          : undefined;

      out.push({
        id: "levers",
        eyebrow: "As 4 alavancas",
        titulo: "O que estabilizaria a dívida",
        descricao:
          'Dalio: "todo governo com dívida em moeda própria tem 4 alavancas". Cada card mostra o ajuste isolado necessário.',
        children: (
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
              {lev.lever_juros && (
                <LeverCard
                  numero={1}
                  titulo="Baixar juros"
                  descricao="Taxa nominal efetiva da dívida que estabilizaria Dívida/Receita."
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
                  descricao="Inflação que subiria o crescimento nominal o suficiente para erodir a dívida."
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
                  descricao="Corte na despesa primária total para fechar o gap consistente com r−g atual."
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
                  descricao="Aumento da receita líquida (mantendo despesa) para estabilizar Dívida/Receita."
                  atual={receitaAtualPctPib ?? undefined}
                  alvo={receitaAlvoPctPib}
                  delta={aumentoReceitaPct ?? undefined}
                  deltaTexto={
                    aumentoReceitaPct != null
                      ? `${aumentoReceitaPct >= 0 ? "+" : ""}${fmtNum(aumentoReceitaPct, 1)}% de arrecadação`
                      : undefined
                  }
                  sufix="% PIB"
                  baseLabel="receita líquida / PIB"
                  viavel={viabilidadeLever(aumentoReceitaPct, 5)}
                />
              )}
            </div>
            <div className="rounded-lg border-l-4 border-rose-500 bg-rose-50 p-3 text-xs text-rose-900">
              <strong>Leitura combinada:</strong> nenhum lever sozinho resolve o caso brasileiro hoje em magnitudes
              plausíveis politicamente — Dalio prevê que países nesse perfil precisam combinar dois ou mais ao longo do
              tempo. Caso histórico mais próximo: Reino Unido 1976 (aumento de impostos + corte de gastos + bailout do
              FMI).
            </div>
          </div>
        ),
      });
    }

    return out;
  }, [data, dalio4, indicadores, categorias, lev, foto]);

  const mesRef = data.fonte_base ? fmtMesCurto(dataIso(data.fonte_base)) : "—";

  return (
    <DashboardScaffold
      header={{
        titulo: "Indicadores de Risco Fiscal",
        subtitulo:
          'O framework de "How Countries Go Broke" (Ray Dalio, 2025) aplicado ao Brasil — começando pelos 4 indicadores que o livro prioriza, cada um com sua história e suas zonas de risco.',
        referencia: `Referência: ${mesRef} · BCB SGS + Tesouro RTN + IBGE CNT + pipeline fiscal AZ`,
      }}
      manchete={manchete}
      kpis={kpis}
      anchor={
        <DividaRendaCard
          dalio4={dalio4}
          indicadorReceita={indicadores.dbgg_pct_receita}
          indicadorPib={indicadores.dbgg_pct_pib}
          stampGiro={data.gerado_em}
          stampDado={data.fonte_base}
        />
      }
      blocos={blocos}
      fichaTecnica={
        <div className="space-y-2">
          <p>
            <strong>Framework.</strong> {dalio4._nota} As faixas de risco (seguro / atenção / crítico / ruptura) são
            calibradas pela AZ a partir dos casos históricos do livro (Reino Unido 1976, Japão pós-1990, Argentina
            2001, EUA pós-2008) — não são números do livro.
          </p>
          <p>
            <strong>Perímetros — honestidade de cálculo.</strong> Dívida/Receita usa DBGG (governo geral) sobre a
            receita líquida do governo central — proxy conservadora, declarada. r, g, r − g e o primário estabilizador
            vêm do bloco de sustentabilidade do pipeline (taxa implícita da DLSP × PIB nominal 12m, perímetro único do
            setor público consolidado) — calculados uma vez, nunca recalculados no front. Serviço da dívida = juros
            nominais 12m (RTN); a rolagem de principal (% vincendo da DPF, RMD/Tesouro) entra numa fase 2.
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
      }
    />
  );
}
