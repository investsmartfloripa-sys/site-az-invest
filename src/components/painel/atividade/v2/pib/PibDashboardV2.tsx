"use client";

import { useMemo } from "react";

import type { AtividadeCodaceData, AtividadeIbcBrData, AtividadePibData } from "@/lib/painel-atividade";
import { DashboardScaffold, KpiCard, type DashboardBloco } from "@/components/painel/core";
import { fmtPct, fmtSignedPct } from "@/lib/format-br";
import { fmtTrimCurto, num } from "../shared";
import { AnchorContribuicoesPib } from "./AnchorContribuicoesPib";
import { RitmoTrimestralCard } from "./RitmoTrimestralCard";
import { IbcBrPibCard } from "./IbcBrPibCard";
import { FocusPibCard } from "./FocusPibCard";
import { RealizadoFocusCard } from "./RealizadoFocusCard";
import { PerCapitaCard } from "./PerCapitaCard";
import { AnaliseCompletaPib } from "./AnaliseCompletaPib";

/**
 * Painel PIB v2 — template narrativo (manchete em prosa → 4 KPIs → âncora de
 * contribuições → blocos numerados → ficha técnica). Duas camadas: leitura
 * rápida em cima, esmiuçamento profissional embaixo.
 */

const LABEL_MOTOR: Record<string, string> = {
  demanda_consumo_familias: "o consumo das famílias",
  demanda_consumo_governo: "o consumo do governo",
  demanda_fbcf: "o investimento (FBCF)",
  demanda_exportacoes: "as exportações",
};

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

    // Maior motor pela ótica da demanda (excl. resíduo/importações).
    const contrib = pib.contribuicoes?.serie ?? [];
    const ultContrib = contrib[contrib.length - 1];
    let motor: { key: string; v: number } | null = null;
    if (ultContrib) {
      for (const k of Object.keys(LABEL_MOTOR)) {
        const v = num(ultContrib, k);
        if (v != null && (motor == null || v > motor.v)) motor = { key: k, v };
      }
    }

    return { qoq, yoy, acum4t, carrego, focusMediana, motor };
  }, [pib, anoCorrente]);

  const manchete = useMemo(() => {
    const { qoq, yoy, carrego, focusMediana, motor } = derivados;
    if (qoq == null && yoy == null) return null;
    const partes: string[] = [];
    if (qoq != null) {
      partes.push(
        `O PIB cresceu ${fmtSignedPct(qoq, 1)} no ${fmtTrimCurto(trimRef)} ante o trimestre anterior (com ajuste sazonal)` +
          (yoy != null ? ` e ${fmtSignedPct(yoy, 1)} sobre o mesmo trimestre do ano passado` : ""),
      );
    } else if (yoy != null) {
      partes.push(`O PIB cresceu ${fmtSignedPct(yoy, 1)} no ${fmtTrimCurto(trimRef)} sobre o mesmo trimestre do ano passado`);
    }
    if (motor) partes.push(`o maior motor foi ${LABEL_MOTOR[motor.key]} (${fmtSignedPct(motor.v, 1).replace("%", " p.p.")})`);
    if (carrego) {
      let frase = `com o resultado, o carrego para ${carrego.ano} é de ${fmtPct(carrego.valor, 1)}`;
      if (focusMediana != null) {
        frase +=
          carrego.valor > focusMediana
            ? ` — acima da mediana Focus (${fmtPct(focusMediana, 1)}): o ano já está praticamente garantido`
            : ` (mediana Focus: ${fmtPct(focusMediana, 1)})`;
      }
      partes.push(frase);
    }
    return `${partes.join("; ")}.`;
  }, [derivados, trimRef]);

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
        id: "ritmo",
        eyebrow: "Momentum",
        titulo: "Ritmo trimestral",
        descricao: "Manchete (QoQ SA) e tendência interanual em painéis separados — escalas diferentes, leituras diferentes.",
        children: <RitmoTrimestralCard pib={pib} codaceTrimestral={codace?.trimestral} geradoEm={pib.gerado_em} />,
      },
    ];
    if (ibcbr) {
      out.push({
        id: "ibcbr",
        eyebrow: "Prévia mensal",
        titulo: "IBC-Br × PIB",
        descricao: "A proxy mensal do BCB confrontada com o dado oficial — o que o trimestre corrente está indicando.",
        children: <IbcBrPibCard ibcbr={ibcbr} pib={pib} codaceMensal={codace?.mensal} geradoEm={pib.gerado_em} />,
      });
    }
    out.push({
      id: "expectativas",
      eyebrow: "Passado → futuro",
      titulo: "Expectativas e histórico",
      descricao: "Para onde o mercado está revisando o PIB — e como o esperado se compara com o que o país entrega.",
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
        descricao: "O crescimento descontado da demografia — a medida que o leitor sente no bolso.",
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
      manchete={manchete}
      kpis={kpis}
      anchor={<AnchorContribuicoesPib pib={pib} codaceTrimestral={codace?.trimestral} geradoEm={pib.gerado_em} />}
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
