"use client";

import { useMemo } from "react";

import type { DifusaoBlock } from "@/lib/painel-ipca";
import { ChartCard } from "@/components/painel/core";
import { AzTimeSeriesChart, type AzSeriesPoint } from "@/components/painel/charts/AzTimeSeriesChart";
import { AZ_BRAND, AZ_CHART } from "@/lib/az-chart-theme";
import { fmtPct } from "@/lib/format-br";
import { mesIso } from "./shared";

/**
 * Bloco 03 — "a alta está espalhada ou concentrada?".
 *
 * A régua NÃO é 50%: a difusão do IPCA raramente cai abaixo disso. A
 * referência é a média histórica calculada no builder (jan/2012+, regime de
 * metas maduro) com banda de ±1 desvio-padrão rotulada como "faixa normal".
 * MM3 destacada (a mensal é ruidosa e sazonal), mensal esmaecida ao fundo.
 *
 * Threshold do título (documentado): espalhada/contida = MM3 fora de
 * média ± 1 dp; dentro = "na faixa normal".
 */
export function DifusaoCard({ difusao, geradoEm }: { difusao: DifusaoBlock; geradoEm: string }) {
  const mm3 = useMemo<AzSeriesPoint[]>(
    () =>
      difusao.serie
        .filter((r) => typeof r.mm3 === "number")
        .map((r) => [mesIso(r.mes), r.mm3 as number]),
    [difusao.serie],
  );
  const mensal = useMemo<AzSeriesPoint[]>(
    () =>
      difusao.serie
        .filter((r) => typeof r.difusao === "number")
        .map((r) => [mesIso(r.mes), r.difusao as number]),
    [difusao.serie],
  );

  const mh = difusao.media_historica;
  const media = mh?.media ?? null;
  const dp = mh?.dp ?? null;

  const ultimoMes = difusao.serie[difusao.serie.length - 1]?.mes ?? null;

  return (
    <ChartCard
      title="Índice de difusão"
      stampGiro={geradoEm}
      stampDado={ultimoMes}
    >
      <AzTimeSeriesChart
        series={[{ id: "mm3", label: "Difusão (média móvel 3m)", color: AZ_BRAND.azure, data: mm3 }]}
        benchmarks={[{ id: "mensal", label: "Mensal", color: AZ_CHART.ticks, data: mensal }]}
        unit="%"
        height={280}
        refAreas={
          media != null && dp != null
            ? [{ y1: media - dp, y2: media + dp, color: AZ_CHART.ticks, opacity: 0.08, label: "faixa normal (±1 dp)" }]
            : []
        }
        refLines={
          media != null
            ? [{ y: media, label: `média ${mh?.desde.slice(0, 4)}+: ${fmtPct(media, 0)}`, color: AZ_BRAND.navy }]
            : []
        }
      />
    </ChartCard>
  );
}
