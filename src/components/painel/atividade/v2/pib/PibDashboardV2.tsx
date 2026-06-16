"use client";

import { useMemo } from "react";

import type { AtividadeCodaceData, AtividadeIbcBrData, AtividadePibData } from "@/lib/painel-atividade";
import { DashboardScaffold, KpiCard, type DashboardBloco } from "@/components/painel/core";
import { fmtSignedPct } from "@/lib/format-br";
import { fmtTrimCurto, num } from "../shared";
import { AnchorContribuicoesPib } from "./AnchorContribuicoesPib";
import { TamanhoEconomiaPib } from "./TamanhoEconomiaPib";
import { RitmoTrimestralCard } from "./RitmoTrimestralCard";
import { IbcBrPibCard } from "./IbcBrPibCard";
import { DecomposicaoPib } from "./DecomposicaoPib";
import { HeatmapSetorialPib } from "./HeatmapSetorialPib";
import { FocusPibCard } from "./FocusPibCard";
import { RealizadoFocusCard } from "./RealizadoFocusCard";
import { PerCapitaCard } from "./PerCapitaCard";
import { AnaliseCompletaPib } from "./AnaliseCompletaPib";

/**
 * Painel PIB v2 — ESCRUTÍNIO dos dados em cadeia, SEM narrativa/manchete em
 * prosa: KPIs → âncora → blocos numerados → ficha técnica. O título afirmativo
 * de cada card + a pergunta econômica no subtítulo carregam a leitura; nada de
 * storytelling. Duas camadas: leitura rápida em cima, esmiuçamento embaixo.
 */

export function PibDashboardV2({
  pib,
  ibcbr,
  codace,
}: {
  pib: AtividadePibData;
  ibcbr: AtividadeIbcBrData | null;
  codace: AtividadeCodaceData | null;
}) {
  const trimRef = pib.trim_recente;
  const anoCorrente = parseInt(trimRef.slice(0, 4), 10);

  const derivados = useMemo(() => {
    const ult = pib.variacao.serie[pib.variacao.serie.length - 1];
    const qoq = num(ult, "qoq_sa_pib");
    const yoy = num(ult, "yoy_pib");
    const acum4t = num(ult, "acum_4t_pib");
    const carrego = pib.carrego && pib.carrego.ano === anoCorrente ? pib.carrego : null;

    // Mediana Focus mais recente do ano corrente (contraste do carrego).
    let focusMediana: number | null = null;
    const arrFocus = pib.focus[String(anoCorrente)] ?? [];
    for (let i = arrFocus.length - 1; i >= 0; i--) {
      if (arrFocus[i].mediana != null) {
        focusMediana = arrFocus[i].mediana;
        break;
      }
    }

    return { qoq, yoy, acum4t, carrego, focusMediana };
  }, [pib, anoCorrente]);

  const kpis = useMemo(() => {
    const { qoq, yoy, acum4t, carrego, focusMediana } = derivados;
    const cards = [
      <KpiCard
        key="qoq"
        label={`PIB ${fmtTrimCurto(trimRef)} (QoQ SA)`}
        value={fmtSignedPct(qoq, 1)}
        hint="vs trimestre anterior, com ajuste sazonal"
        size="lg"
      />,
      <KpiCard key="yoy" label="Variação interanual" value={fmtSignedPct(yoy, 1)} hint="vs mesmo trimestre do ano anterior" />,
    ];
    if (carrego) {
      cards.push(
        <KpiCard
          key="carrego"
          label={`Carrego para ${carrego.ano}`}
          value={fmtSignedPct(carrego.valor, 1)}
          delta={focusMediana != null ? +(carrego.valor - focusMediana).toFixed(2) : undefined}
          deltaUnit="p.p."
          deltaHint="vs mediana Focus"
          hint={`crescimento já contratado com ${carrego.trimestres_divulgados} trim divulgado${carrego.trimestres_divulgados > 1 ? "s" : ""}`}
        />,
      );
    }
    cards.push(
      <KpiCard key="acum4t" label="Acumulado 4 trimestres" value={fmtSignedPct(acum4t, 1)} hint="ritmo dos últimos 12 meses" />,
    );
    return cards;
  }, [derivados, trimRef]);

  const blocos = useMemo<DashboardBloco[]>(() => {
    const out: DashboardBloco[] = [
      {
        id: "contribuicoes",
        eyebrow: "Quem puxou",
        titulo: "Contribuições ao crescimento",
        descricao:
          "Quanto cada setor (oferta) e cada componente (demanda) somou ao PIB no trimestre, em pontos percentuais.",
        children: (
          <AnchorContribuicoesPib pib={pib} codaceTrimestral={codace?.trimestral} geradoEm={pib.gerado_em} />
        ),
      },
      {
        id: "ritmo",
        eyebrow: "Momentum",
        titulo: "Ritmo trimestral",
        descricao: "Variação trimestral dessazonalizada (QoQ SA) e interanual (YoY) em painéis separados — nível e momentum nunca no mesmo eixo.",
        children: <RitmoTrimestralCard pib={pib} codaceTrimestral={codace?.trimestral} geradoEm={pib.gerado_em} />,
      },
    ];
    if (ibcbr) {
      out.push({
        id: "ibcbr",
        eyebrow: "Prévia mensal",
        titulo: "IBC-Br × PIB",
        descricao: "IBC-Br (proxy mensal do BCB) e PIB trimestral, ambos rebase fev/2020 = 100 — prévia do trimestre em curso.",
        children: <IbcBrPibCard ibcbr={ibcbr} pib={pib} codaceMensal={codace?.mensal} geradoEm={pib.gerado_em} />,
      });
    }
    out.push({
      id: "decomposicao",
      eyebrow: "Composição",
      titulo: "Decomposição: oferta e demanda",
      descricao:
        "Setores da oferta e componentes da demanda, em nível (recuperação vs pré-pandemia) ou momentum (YoY) — alterne nos botões.",
      children: <DecomposicaoPib pib={pib} codace={codace} geradoEm={pib.gerado_em} />,
    });
    out.push({
      id: "heatmap-setorial",
      eyebrow: "Composição",
      titulo: "Crescimento setorial (mapa de calor)",
      descricao:
        "Os 17 setores da oferta × 4 medidas de variação no trimestre — leitura rápida de quem expande e quem recua.",
      children: <HeatmapSetorialPib pib={pib} geradoEm={pib.gerado_em} />,
    });
    out.push({
      id: "expectativas",
      eyebrow: "Passado → futuro",
      titulo: "Expectativas e histórico",
      descricao: "Mediana Focus (revisão ao longo da coleta) e realizado vs projetado por ano.",
      children: (
        <div className="grid gap-4 xl:grid-cols-2">
          <FocusPibCard pib={pib} geradoEm={pib.gerado_em} />
          <RealizadoFocusCard pib={pib} geradoEm={pib.gerado_em} />
        </div>
      ),
    });
    if (pib.per_capita?.serie?.length) {
      out.push({
        id: "per-capita",
        eyebrow: "Bem-estar",
        titulo: "PIB per capita",
        descricao: "PIB per capita real: crescimento descontado da variação populacional.",
        children: <PerCapitaCard pib={pib} geradoEm={pib.gerado_em} />,
      });
    }
    out.push({
      id: "analise-completa",
      eyebrow: "Esmiuçamento",
      titulo: "Análise completa",
      descricao: "A série em todas as transformações, tabela e export CSV.",
      children: <AnaliseCompletaPib pib={pib} geradoEm={pib.gerado_em} />,
    });
    return out;
  }, [pib, ibcbr, codace]);

  return (
    <DashboardScaffold
      header={{
        titulo: "PIB — Atividade Econômica",
        subtitulo: "Contas Nacionais Trimestrais do IBGE, com o IBC-Br do BCB como prévia mensal e as expectativas do Focus.",
        referencia: `Referência: ${fmtTrimCurto(trimRef)} · IBC-Br até ${ibcbr?.mes_recente ?? "—"}`,
      }}
      kpis={kpis}
      anchor={<TamanhoEconomiaPib pib={pib} codace={codace} geradoEm={pib.gerado_em} />}
      blocos={blocos}
      fichaTecnica={
        <div className="space-y-2">
          <p>
            <strong>Fontes e séries.</strong> IBGE/SIDRA — Contas Nacionais Trimestrais: 5932 (variações: YoY 6561, acum. 4T
            6562, acum. ano 6563, QoQ SA 6564), 1621/1620 (índice de volume com/sem ajuste sazonal), 1846 (valores correntes —
            pesos), 6784 (SCN anual — PIB per capita, variação em volume oficial v9814). BCB: SGS 24363/24364 (IBC-Br NS/SA),
            Olinda ExpectativasMercadoAnuais (Focus PIB Total). Recessões: cronologia CODACE/FGV (última datação oficial: 2020).
          </p>
          <p>
            <strong>Metodologia — honestidade de cálculo.</strong> Contribuições ao crescimento: peso nominal do MESMO trimestre
            do ano anterior (t-4, convenção BCB/research — a composição nominal é sazonal) × variação real YoY; importações com
            sinal trocado. Índices de volume encadeados são NÃO-aditivos: o resíduo gravado no JSON absorve a diferença (na
            demanda, também a variação de estoques e a discrepância estatística) — nunca forçamos a soma. Carrego estatístico:
            média do índice SA do ano com o último trimestre divulgado congelado nos restantes ÷ média do ano anterior. YoY do
            IBC-Br sobre o índice SEM ajuste (a sazonalidade cancela na comparação interanual); 3m/3m SAAR = média móvel de 3
            meses vs a média móvel anterior, anualizada.
          </p>
          <p>
            <strong>Réguas editoriais.</strong> "Ritmo normal" = mediana de 10 anos do QoQ SA (mediana, não média — 2020
            distorce). Dispersão do Focus = ±1 desvio-padrão (min/máx carregam outliers). Faixas cinzas = recessões CODACE; a
            cronologia é atualizada com anos de defasagem — ausência de faixa recente não significa ausência de risco.
          </p>
          <p>Pipeline: data-pipeline/python/build_atividade_pib.py (schema v2) · GitHub Actions atividade-pipeline.yml.</p>
        </div>
      }
    />
  );
}
