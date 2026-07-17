"use client";

import { useMemo } from "react";

import type { AberturaHierarquica } from "@/lib/painel-ipca";
import { ChartCard } from "@/components/painel/core";
import { DivergingReturnBars } from "@/components/painel/charts/DivergingReturnBars";
import { AZ_CHART } from "@/lib/az-chart-theme";
import { fmtMesCurto, fmtSignedNum, fmtSignedPct } from "@/lib/format-br";

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

  const geral = hierarquia.geral;

  if (rows.length === 0) return null;

  return (
    <ChartCard
      title={`Contribuição dos grupos — ${fmtMesCurto(mesRef)}`}
      subtitle="Quanto cada grupo adicionou (ou subtraiu) do índice do mês, em pontos percentuais."
      footer="Contribuição = variação × peso ÷ 100 (convenção do release do IBGE). A soma das barras fecha com o IPCA cheio, a menos de resíduo de arredondamento de centésimos."
      stampGiro={geradoEm}
      stampDado={mesRef}
    >
      {geral?.var != null ? (
        <p className="mb-2 text-xs text-zinc-600">
          IPCA de {fmtMesCurto(mesRef)}: <strong className="text-[#132960]">{fmtSignedPct(geral.var, 2)}</strong> · no
          ano: <strong className="text-[#132960]">{geral.acum_ano != null ? fmtSignedPct(geral.acum_ano, 2) : "—"}</strong> · 12
          meses: <strong className="text-[#132960]">{geral.acum_12m != null ? fmtSignedPct(geral.acum_12m, 2) : "—"}</strong>
        </p>
      ) : null}
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
