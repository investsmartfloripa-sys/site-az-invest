"use client";

import { useMemo } from "react";

import type { FiscalClassicosData, PontoMensalPct } from "@/lib/painel-fiscal";
import { ChartCard } from "@/components/painel/core";
import { DivergingReturnBars } from "@/components/painel/charts/DivergingReturnBars";
import { fmtNum, fmtSignedNum } from "@/lib/format-br";
import { deltaPp12m, mesIso, ultimoPct } from "./shared";

/**
 * 03b — "O que puxou a arrecadação?": Δ em pontos do PIB de cada tributo vs
 * 12 meses atrás (participação 12m atual − participação 12m no mesmo mês do
 * ano anterior). Barras divergentes — quem ganhou e quem perdeu peso.
 *
 * Dividendos+Concessões usa a família consolidada do RTN
 * (receita_familias.dividendos_concessoes), não só dividendos — vício do
 * dashboard antigo eliminado.
 */

export function ContribuicoesTributoCard({ data }: { data: FiscalClassicosData }) {
  const rg = data.receita_e_gastos;

  const tributos = useMemo<{ label: string; serie: PontoMensalPct[] | undefined }[]>(
    () => [
      { label: "Imposto de Renda", serie: rg.imposto_renda_12m_pct_pib },
      { label: "Cofins", serie: rg.cofins_12m_pct_pib },
      { label: "CSLL", serie: rg.csll_12m_pct_pib },
      { label: "PIS/Pasep", serie: rg.pis_pasep_12m_pct_pib },
      { label: "IPI", serie: rg.ipi_12m_pct_pib },
      { label: "IOF", serie: rg.iof_12m_pct_pib },
      { label: "Imp. importação", serie: rg.imposto_importacao_12m_pct_pib },
      { label: "CIDE", serie: rg.cide_12m_pct_pib },
      { label: "RGPS (INSS)", serie: rg.rgps_arrecadacao_12m_pct_pib },
      { label: "Divid.+Concessões", serie: data.receita_familias?.dividendos_concessoes_12m_pct_pib },
      { label: "Recursos naturais", serie: rg.recursos_naturais_12m_pct_pib },
    ],
    [rg, data.receita_familias],
  );

  const rows = useMemo(
    () =>
      tributos
        .map((t) => ({ label: t.label, value: deltaPp12m(t.serie) }))
        .filter((r): r is { label: string; value: number } => r.value != null)
        .sort((a, b) => b.value - a.value),
    [tributos],
  );

  const top = useMemo(() => {
    let melhor: { label: string; value: number } | null = null;
    for (const r of rows) {
      if (melhor == null || Math.abs(r.value) > Math.abs(melhor.value)) melhor = r;
    }
    return melhor;
  }, [rows]);

  const irUlt = ultimoPct(rg.imposto_renda_12m_pct_pib);

  const titulo = top
    ? `O que puxou a arrecadação: ${top.label} ${top.value >= 0 ? "ganhou" : "perdeu"} ${fmtNum(Math.abs(top.value), 2)} p.p. do PIB em 12 meses`
    : "O que puxou a arrecadação em 12 meses";

  return (
    <ChartCard
      title={titulo}
      subtitle="Quais tributos explicam a variação da receita? Δ da participação no PIB (12m móveis) de cada tributo contra o mesmo mês do ano passado, em pontos percentuais."
      footer="Δ calculado das séries do JSON: participação 12m/PIB atual − participação no mesmo mês 12 meses antes, por tributo (RTN/RFB; RGPS = arrecadação previdenciária; Divid.+Concessões = família consolidada do RTN). Verde = ganhou peso no PIB, vermelho = perdeu."
      stampGiro={data.gerado_em}
      stampDado={irUlt ? mesIso(irUlt.data) : null}
    >
      <DivergingReturnBars
        rows={rows}
        yAxisWidth={132}
        valueFmt={(v) => `${fmtSignedNum(v, 2)} p.p.`}
        axisFmt={(v) => fmtSignedNum(v, 2)}
      />
    </ChartCard>
  );
}
