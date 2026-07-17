"use client";

import { useMemo } from "react";

import type { AberturaHierarquica } from "@/lib/painel-ipca";
import { ChartCard } from "@/components/painel/core";
import { DivergingReturnBars } from "@/components/painel/charts/DivergingReturnBars";
import { AZ_CHART } from "@/lib/az-chart-theme";
import { fmtSignedNum } from "@/lib/format-br";

/**
 * Contribuição de cada um dos 9 grupos ao IPCA DO MÊS (p.p.), em barras
 * divergentes — o primeiro gráfico do release do IBGE, aqui com a soma
 * fechando no índice cheio. Semântica de inflação (alta = vermelho).
 */
export function GruposMesCard({
  hierarquia,
  mesRef,
  geradoEm,
}: {
  hierarquia: AberturaHierarquica;
  mesRef: string;
  geradoEm: string;
}) {
  const rows = useMemo(
    () =>
      hierarquia.grupos
        .filter((g) => g.contrib_pp != null)
        .map((g) => ({ label: g.nome, value: g.contrib_pp as number }))
        .sort((a, b) => b.value - a.value),
    [hierarquia],
  );

  if (rows.length === 0) return null;

  return (
    <ChartCard
      title="Contribuição dos grupos no mês"
      stampGiro={geradoEm}
      stampDado={mesRef}
    >
      <DivergingReturnBars
        rows={rows}
        yAxisWidth={160}
        valueFmt={(v) => `${fmtSignedNum(v, 3)} p.p.`}
        axisFmt={(v) => fmtSignedNum(v, 2)}
        fillFor={(v) => (v > 0 ? AZ_CHART.neg : AZ_CHART.neutral)}
      />
    </ChartCard>
  );
}
