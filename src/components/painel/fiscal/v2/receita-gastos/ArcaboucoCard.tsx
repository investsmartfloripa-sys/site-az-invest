"use client";

import { useMemo, useState } from "react";

import type { FiscalClassicosData } from "@/lib/painel-fiscal";
import { ChartCard } from "@/components/painel/core";
import { AzPeriodSelector, type AzPeriodValue } from "@/components/painel/charts/AzPeriodSelector";
import { AzTimeSeriesChart, type AzTimeSeries } from "@/components/painel/charts/AzTimeSeriesChart";
import { AZ_BRAND, AZ_CHART } from "@/lib/az-chart-theme";
import { fmtNum, fmtSignedPct } from "@/lib/format-br";
import { mesIso, ultimoYoY, yoyPoints } from "./shared";

/**
 * 05 — Arcabouço fiscal (LC 200/2023): crescimento REAL 12m da despesa e da
 * receita — séries deflacionadas PRONTAS do builder (índice composto do IPCA
 * mês a mês), nunca o atalho de deflacionar pelo IPCA YoY no endpoint.
 * A faixa verde é o corredor LEGAL (0,6–2,5% a.a.); o limite exato de cada
 * ano sai na LDO/Relatório bimestral.
 */

export function ArcaboucoCard({ data }: { data: FiscalClassicosData }) {
  const [period, setPeriod] = useState<AzPeriodValue>({ id: "5y" });
  const arc = data.arcabouco;

  const series = useMemo<AzTimeSeries[]>(() => {
    if (!arc) return [];
    return [
      {
        id: "despesa",
        label: "Despesa real (12m, YoY)",
        color: AZ_BRAND.navy,
        data: yoyPoints(arc.despesa_real_12m_yoy_pct),
      },
      {
        id: "receita",
        label: "Receita real (12m, YoY)",
        color: AZ_BRAND.azure,
        data: yoyPoints(arc.receita_real_12m_yoy_pct),
      },
    ];
  }, [arc]);

  const despUlt = ultimoYoY(arc?.despesa_real_12m_yoy_pct);
  const recUlt = ultimoYoY(arc?.receita_real_12m_yoy_pct);

  if (!arc) {
    return (
      <ChartCard title="Arcabouço fiscal — crescimento real" stampGiro={data.gerado_em} stampDado={null}>
        <p className="flex h-64 items-center justify-center text-sm text-zinc-400">
          O pipeline ainda não publicou as séries reais do arcabouço (schema v2). Rode o workflow fiscal-pipeline.yml.
        </p>
      </ChartCard>
    );
  }

  const minIso = series[0]?.data[0]?.[0] ?? "";
  const maxIso = series[0]?.data[series[0].data.length - 1]?.[0] ?? "";

  const titulo =
    despUlt && recUlt
      ? `Despesa cresce ${fmtSignedPct(despUlt.valor, 1)} reais em 12 meses e receita ${fmtSignedPct(recUlt.valor, 1)} — o corredor do arcabouço é ${fmtNum(arc.corredor.piso_pct, 1)}–${fmtNum(arc.corredor.teto_pct, 1)}%`
      : "Crescimento real de despesa e receita × corredor do arcabouço";

  return (
    <ChartCard
      title={titulo}
      subtitle="A despesa cabe no limite do arcabouço — e a receita acompanha? Crescimento real acumulado em 12 meses contra o corredor legal de 0,6% a 2,5% a.a. da LC 200/2023."
      toolbar={<AzPeriodSelector value={period} onChange={setPeriod} min={minIso} max={maxIso} periods={["1y", "5y", "max"]} />}
      footer="Séries deflacionadas no BUILDER, mês a mês, pelo índice composto do IPCA (não pelo IPCA YoY no total 12m). Oscilações fortes (ex.: a virada de 2025 para 2026) refletem one-offs como o calendário de precatórios — a apuração OFICIAL do limite tem expurgos e o limite exato do ano sai na LDO/Relatório bimestral: o corredor 0,6–2,5% é a régua estrutural, não o teto vigente. Comparar despesa acima do corredor com receita fraca é a leitura da tesoura em termos reais."
      stampGiro={data.gerado_em}
      stampDado={despUlt ? mesIso(despUlt.data) : null}
    >
      <AzTimeSeriesChart
        series={series}
        unit="%"
        period={period}
        height={300}
        refAreas={[
          {
            y1: arc.corredor.piso_pct,
            y2: arc.corredor.teto_pct,
            label: `corredor LC 200 (${fmtNum(arc.corredor.piso_pct, 1)}–${fmtNum(arc.corredor.teto_pct, 1)}%)`,
            color: AZ_CHART.pos,
            opacity: 0.1,
          },
        ]}
        refLines={[{ y: 0, color: AZ_CHART.zero, dashed: false }]}
      />
    </ChartCard>
  );
}
