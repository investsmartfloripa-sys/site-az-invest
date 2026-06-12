"use client";

import { useMemo, useState } from "react";

import type { PontoMensal } from "@/lib/painel-fiscal";
import { ChartCard } from "@/components/painel/core";
import { AzPeriodSelector, type AzPeriodValue } from "@/components/painel/charts/AzPeriodSelector";
import { AzTimeSeriesChart, type AzSeriesPoint } from "@/components/painel/charts/AzTimeSeriesChart";
import { AZ_BRAND } from "@/lib/az-chart-theme";
import { fmtPct } from "@/lib/format-br";
import { dataIso, toPoints, ultimoPonto } from "./shared";

/**
 * Contexto Big Debt Cycle (Dalio) — crédito total à economia e "dívida total"
 * (pública + crédito), em % do PIB. Card de LEITURA, sem semáforo: o ciclo de
 * crédito privado é outra dinâmica e não mede sustentabilidade fiscal — por
 * isso essas séries SAÍRAM do gráfico principal de dívida pública, onde
 * misturavam perímetros e confundiam a mensagem.
 */

export function ContextoCreditoCard({
  credito,
  dbgg,
  geradoEm,
}: {
  credito: PontoMensal[];
  dbgg: PontoMensal[];
  geradoEm: string;
}) {
  const [period, setPeriod] = useState<AzPeriodValue>({ id: "max" });

  const creditoPts = useMemo(() => toPoints(credito), [credito]);

  // Dívida total da economia = DBGG + crédito (meses em que AMBAS existem).
  const dividaTotalPts = useMemo<AzSeriesPoint[]>(() => {
    const dbggMap = new Map<string, number>();
    for (const p of dbgg) {
      if (p.valor != null && Number.isFinite(p.valor)) dbggMap.set(dataIso(p.data), p.valor);
    }
    const out: AzSeriesPoint[] = [];
    for (const [iso, v] of creditoPts) {
      const d = dbggMap.get(iso);
      if (d != null) out.push([iso, +(v + d).toFixed(2)]);
    }
    return out;
  }, [dbgg, creditoPts]);

  const ultCredito = useMemo(() => ultimoPonto(credito), [credito]);
  const ultTotal = dividaTotalPts.length > 0 ? dividaTotalPts[dividaTotalPts.length - 1] : null;

  if (creditoPts.length === 0) return null;

  const titulo = ultTotal
    ? `Dívida total da economia em ${fmtPct(ultTotal[1], 0)} do PIB — crédito privado responde por ${fmtPct(ultCredito?.valor ?? null, 0)}`
    : `Crédito total à economia em ${fmtPct(ultCredito?.valor ?? null, 0)} do PIB`;

  return (
    <ChartCard
      title={titulo}
      subtitle="Leitura de contexto à la Big Debt Cycle (Ray Dalio): o endividamento agregado do país — governo + famílias + empresas — em % do PIB. Sem semáforo: é um termômetro de ciclo, não um veredito."
      toolbar={
        <AzPeriodSelector
          value={period}
          onChange={setPeriod}
          min={creditoPts.length > 0 ? creditoPts[0][0] : undefined}
          max={creditoPts.length > 0 ? creditoPts[creditoPts.length - 1][0] : undefined}
          periods={["1y", "5y", "max"]}
        />
      }
      footer="Ciclo de crédito privado ≠ sustentabilidade fiscal — por isso estas séries saíram do gráfico principal de dívida pública. 'Dívida total' = DBGG + crédito total à economia: soma indicativa (perímetros e metodologias diferentes), útil só p/ comparação internacional de endividamento agregado. Fontes: BCB SGS 20622 (crédito total) e 13762 (DBGG)."
      stampGiro={geradoEm}
      stampDado={ultCredito ? dataIso(ultCredito.data) : null}
    >
      <AzTimeSeriesChart
        series={[
          { id: "credito", label: "Crédito total à economia", color: AZ_BRAND.azure, data: creditoPts },
          { id: "total", label: "Dívida total (DBGG + crédito)", color: AZ_BRAND.navy, data: dividaTotalPts },
        ]}
        unit="%"
        period={period}
        height={300}
        yAxisLabel="% do PIB"
      />
    </ChartCard>
  );
}
