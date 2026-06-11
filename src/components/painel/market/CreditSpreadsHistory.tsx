"use client";

import { useMemo, useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { CreditClass, CreditSpreadsHistory as CreditSpreadsData } from "@/lib/painel-renda-fixa-data";
import { MarketCard } from "@/components/painel/market/MarketCard";
import {
  AzPeriodSelector,
  resolvePeriodRange,
  type AzPeriodValue,
} from "@/components/painel/charts";
import { AzTooltip, azGridProps, azXAxisProps, azYAxisProps } from "@/components/painel/core";
import { AZ_BRAND, AZ_CHART, AZ_TOOLTIP_PROPS } from "@/lib/az-chart-theme";
import { diffDaysUTC, fmtDataBR, fmtNum, fmtPct, formatAxisDate } from "@/lib/format-br";

type ClassKey = "DI" | "IPCA";

function buildChartData(c: CreditClass, from: string, to: string) {
  // Index por data
  const byDate: Record<string, { median?: number; p25?: number; p75?: number; n?: number }> = {};
  for (const [d, v] of c.series.median) if (d >= from && d <= to) (byDate[d] ??= {}).median = v;
  for (const [d, v] of c.series.p25) if (d >= from && d <= to) (byDate[d] ??= {}).p25 = v;
  for (const [d, v] of c.series.p75) if (d >= from && d <= to) (byDate[d] ??= {}).p75 = v;
  for (const [d, v] of c.series.n) if (d >= from && d <= to) (byDate[d] ??= {}).n = v;
  const dates = Object.keys(byDate).sort();
  return dates.map((d) => ({
    date: d,
    median: byDate[d].median,
    p25: byDate[d].p25,
    p75: byDate[d].p75,
    // Para Recharts Area com range: usa [low, high]
    band: [byDate[d].p25, byDate[d].p75] as [number | undefined, number | undefined],
    n: byDate[d].n,
  }));
}

type Props = { data: CreditSpreadsData | null };

export function CreditSpreadsHistory({ data }: Props) {
  const [klass, setKlass] = useState<ClassKey>("DI");
  const [period, setPeriod] = useState<AzPeriodValue>({ id: "3m" });

  const c = data?.classes[klass];
  // Observação mais antiga da mediana (limita o "Personalizado").
  const seriesMin = c?.series.median[0]?.[0] ?? "1900-01-01";
  const seriesMax = data?.last_data_date ?? "9999-12-31";
  // Corte de período 100% UTC (resolvePeriodRange — nada de setMonth local).
  const range = resolvePeriodRange(period, seriesMin, seriesMax);
  const chartData = useMemo(
    () => (c ? buildChartData(c, range.from, range.to) : []),
    [c, range.from, range.to],
  );

  if (!data || !c) {
    return (
      <MarketCard title="Spreads de crédito privado (debêntures)">
        <div className="py-10 text-center text-sm text-zinc-500">
          Dados ANBIMA ainda não publicados pelo pipeline diário.
        </div>
      </MarketCard>
    );
  }

  const values = chartData.map((r) => r.median).filter((v): v is number => typeof v === "number");
  const currentVal = values.length > 0 ? values[values.length - 1] : null;
  const minVal = values.length > 0 ? Math.min(...values) : null;
  const maxVal = values.length > 0 ? Math.max(...values) : null;
  const medianVal =
    values.length > 0 ? [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)] : null;
  const latestN = chartData.length > 0 ? chartData[chartData.length - 1].n : null;

  // Janela visível em dias — controla o formato adaptativo dos ticks de data.
  const firstPlotted = chartData[0]?.date;
  const lastPlotted = chartData[chartData.length - 1]?.date;
  const spanDays =
    typeof firstPlotted === "string" && typeof lastPlotted === "string"
      ? Math.max(1, diffDaysUTC(firstPlotted, lastPlotted))
      : 1;

  // Buckets de distribuicao (% papeis com spread negativo, 0-100bps, >100bps)
  const lastPctNeg = c.series.pct_neg?.[c.series.pct_neg.length - 1]?.[1] ?? null;
  const lastPctMid = c.series.pct_mid?.[c.series.pct_mid.length - 1]?.[1] ?? null;
  const lastPctHigh = c.series.pct_high?.[c.series.pct_high.length - 1]?.[1] ?? null;
  const hasDistribution =
    typeof lastPctNeg === "number" &&
    typeof lastPctMid === "number" &&
    typeof lastPctHigh === "number";

  // Media ponderada por PU (medida usada pelas mesas)
  const lastWeighted = c.series.mean_weighted?.[c.series.mean_weighted.length - 1]?.[1] ?? null;

  const yLabel = klass === "DI" ? "Spread sobre CDI" : "Spread sobre NTN-B";

  return (
    <MarketCard
      title="Spreads de crédito privado"
      subtitle="Mediana e quartis da taxa indicativa de debêntures, por indexador."
      badge={`ANBIMA · ${data.last_data_date}`}
      bodyClassName="px-4 pb-4 pt-2"
      footer={`Fonte: ${data.source}`}
      stampGiro={data.generated_at}
      stampDado={data.last_data_date}
      toolbar={
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setKlass("DI")}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
              klass === "DI"
                ? "bg-[#027DFC] text-white"
                : "border border-[#132960]/20 bg-white text-[#132960] hover:border-[#027DFC]"
            }`}
          >
            DI / CDI
          </button>
          <button
            type="button"
            onClick={() => setKlass("IPCA")}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
              klass === "IPCA"
                ? "bg-[#027DFC] text-white"
                : "border border-[#132960]/20 bg-white text-[#132960] hover:border-[#027DFC]"
            }`}
          >
            IPCA+
          </button>
        </div>
      }
    >
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-zinc-500">Janela:</span>
          <AzPeriodSelector
            value={period}
            onChange={setPeriod}
            min={seriesMin}
            max={data.last_data_date}
            periods={["1m", "3m", "6m", "max"]}
          />
        </div>

        <div className="grid gap-3 lg:grid-cols-[1fr_220px]">
          <div className="h-[380px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 10, right: 16, bottom: 10, left: 0 }}>
                <CartesianGrid {...azGridProps()} />
                <XAxis
                  {...azXAxisProps()}
                  dataKey="date"
                  tickFormatter={(d: string) => formatAxisDate(d, spanDays)}
                  minTickGap={28}
                />
                <YAxis
                  {...azYAxisProps()}
                  domain={["auto", "auto"]}
                  tickFormatter={(v: number) => `${fmtNum(v, 1)}%`}
                  width={56}
                />
                <Tooltip
                  content={
                    <AzTooltip
                      labelFmt={(l) => fmtDataBR(String(l ?? ""))}
                      valueFmt={(v) => fmtPct(v, 2)}
                    />
                  }
                  cursor={AZ_TOOLTIP_PROPS.cursor}
                />
                {/* Banda P25-P75 (area) — fora do tooltip (P25/P75 já aparecem como linhas) */}
                <Area
                  type="monotone"
                  dataKey="band"
                  stroke="none"
                  fill={AZ_BRAND.azure}
                  fillOpacity={0.15}
                  isAnimationActive={false}
                  tooltipType="none"
                />
                {/* Linha da mediana */}
                <Line
                  type="monotone"
                  dataKey="median"
                  name="Mediana"
                  stroke={AZ_BRAND.azure}
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
                {/* Linhas finas p25 e p75 (quartis — neutros, sem semântica de bom/ruim) */}
                <Line
                  type="monotone"
                  dataKey="p25"
                  name="P25"
                  stroke={AZ_CHART.ticks}
                  strokeWidth={1}
                  strokeDasharray="3 3"
                  dot={false}
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="p75"
                  name="P75"
                  stroke={AZ_CHART.ticks}
                  strokeWidth={1}
                  strokeDasharray="3 3"
                  dot={false}
                  isAnimationActive={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <div className="rounded-xl border border-[#132960]/10 bg-zinc-50/50 p-3 text-sm">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              {yLabel}
            </p>
            <dl className="space-y-2">
              <div className="flex items-center justify-between">
                <dt className="text-zinc-600">Mediana atual</dt>
                <dd className="text-lg font-semibold tabular-nums text-[#132960]">
                  {fmtPct(currentVal, 2)}
                </dd>
              </div>
              <div className="flex items-center justify-between border-t border-zinc-200 pt-2">
                <dt className="text-zinc-600" title="Σ(spread × PU) / Σ(PU). Métrica usada por mesas de operação porque dá mais peso a papéis com mais volume de mercado.">
                  Média ponderada (PU)
                </dt>
                <dd className="font-semibold tabular-nums text-[#027DFC]">
                  {fmtPct(lastWeighted, 2)}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-zinc-600">Mediana janela</dt>
                <dd className="font-semibold tabular-nums text-[#132960]">
                  {fmtPct(medianVal, 2)}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-zinc-600">Mín na janela</dt>
                <dd className="tabular-nums text-[#166B47]">
                  {fmtPct(minVal, 2)}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-zinc-600">Máx na janela</dt>
                <dd className="tabular-nums text-[#9C2B24]">
                  {fmtPct(maxVal, 2)}
                </dd>
              </div>
              <div className="flex items-center justify-between border-t border-zinc-200 pt-2 text-[11px]">
                <dt className="text-zinc-500">Papéis no último dia</dt>
                <dd className="tabular-nums text-zinc-700">{latestN ?? "—"}</dd>
              </div>
            </dl>
            <p className="mt-3 border-t border-zinc-200 pt-2 text-[10px] italic text-zinc-500">
              Mediana (linha sólida), banda sombreada = P25–P75 (50% central das taxas).
            </p>
          </div>
        </div>

        {/* Distribuicao dos papeis no ultimo dia */}
        {hasDistribution ? (
          <div className="rounded-xl border border-[#132960]/10 bg-white p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Distribuição do spread no último dia · {latestN ?? "—"} papéis
            </p>
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div className="rounded-lg border border-[#1E8A5C]/30 bg-[#1E8A5C]/5 p-2">
                <p className="text-xs text-zinc-600">Spread &lt; 0 (abaixo da NTN-B)</p>
                <p className="mt-1 text-lg font-semibold tabular-nums text-[#166B47]">
                  {fmtPct(lastPctNeg, 1)}
                </p>
                <p className="text-[10px] italic text-zinc-500">Papéis premium / fluxo institucional</p>
              </div>
              <div className="rounded-lg border border-[#027DFC]/30 bg-[#027DFC]/5 p-2">
                <p className="text-xs text-zinc-600">Spread 0 a 100 bps</p>
                <p className="mt-1 text-lg font-semibold tabular-nums text-[#027DFC]">
                  {fmtPct(lastPctMid, 1)}
                </p>
                <p className="text-[10px] italic text-zinc-500">High-grade típico</p>
              </div>
              <div className="rounded-lg border border-[#BE3B33]/30 bg-[#BE3B33]/5 p-2">
                <p className="text-xs text-zinc-600">Spread ≥ 100 bps (1%)</p>
                <p className="mt-1 text-lg font-semibold tabular-nums text-[#9C2B24]">
                  {fmtPct(lastPctHigh, 1)}
                </p>
                <p className="text-[10px] italic text-zinc-500">Risco / setores estressados</p>
              </div>
            </div>
            <div className="mt-2 flex h-2 w-full overflow-hidden rounded-full bg-zinc-100">
              <div
                className="bg-[#1E8A5C]"
                style={{ width: `${lastPctNeg}%` }}
                title={`Spread negativo: ${fmtPct(lastPctNeg, 1)}`}
              />
              <div
                className="bg-[#027DFC]"
                style={{ width: `${lastPctMid}%` }}
                title={`Spread 0-100 bps: ${fmtPct(lastPctMid, 1)}`}
              />
              <div
                className="bg-[#BE3B33]"
                style={{ width: `${lastPctHigh}%` }}
                title={`Spread ≥100 bps: ${fmtPct(lastPctHigh, 1)}`}
              />
            </div>
          </div>
        ) : null}

        <p className="text-xs italic text-zinc-500">
          Para <strong>DI/CDI</strong>, o spread é a Taxa Indicativa ANBIMA (que por convenção já
          mede o cupom sobre o CDI). Para <strong>IPCA+</strong>, o spread é calculado papel-a-papel
          como{" "}
          <code className="rounded bg-zinc-100 px-1">Taxa Indicativa do papel − Taxa NTN-B benchmark</code>
          {" "}(a NTN-B de referência é definida pelo próprio ANBIMA na publicação diária). Mediana e
          quartis agregam todos os papéis ativos em cada dia.
        </p>
      </div>
    </MarketCard>
  );
}
