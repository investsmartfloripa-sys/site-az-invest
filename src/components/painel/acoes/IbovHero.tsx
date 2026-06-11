"use client";

import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import DataStamp from "@/components/painel/DataStamp";
import { AzTooltip, azTooltipProps } from "@/components/painel/core/AzTooltip";
import { azGridProps, azXAxisProps, azYAxisProps } from "@/components/painel/core/azChartDefaults";
import {
  TimeWindowToggle,
  timeWindowStartIso,
  type TimeWindow,
} from "@/components/painel/fii/TimeWindowToggle";
import { AZ_BRAND, BENCHMARK_COLORS, variationText } from "@/lib/az-chart-theme";
import { diffDaysUTC, fmtDataBR, fmtNum, fmtSignedPct, formatAxisDate } from "@/lib/format-br";
import type { AcoesBenchmarkKey, AcoesIbovData, AcoesIbovPoint } from "@/lib/painel-acoes";

type Props = {
  data: AcoesIbovData;
};

// Benchmarks na cor FIXA oficial (mesma série = mesma cor no site inteiro).
const BENCH_META: Record<AcoesBenchmarkKey, { label: string; color: string }> = {
  CDI: { label: "CDI", color: BENCHMARK_COLORS.CDI },
  SP500: { label: "S&P 500", color: BENCHMARK_COLORS["S&P 500"] },
  USDBRL: { label: "USD/BRL", color: BENCHMARK_COLORS["USD/BRL"] },
};

const IBOV_COLOR = AZ_BRAND.azure; // série principal do hero — azul AZ

function clipWindow(series: AcoesIbovPoint[], windowId: TimeWindow): AcoesIbovPoint[] {
  if (!series.length) return [];
  const start = timeWindowStartIso(series[series.length - 1].date, windowId);
  return start ? series.filter((p) => p.date >= start) : series;
}

/** Renormaliza Ibov + benchmarks selecionados para base 100 do 1º ponto da janela. */
function renormalize(
  clipped: AcoesIbovPoint[],
  activeBenches: AcoesBenchmarkKey[],
  showAbsoluteIbov: boolean,
): Array<Record<string, number | string | null>> {
  if (clipped.length === 0) return [];
  const baseIbov = clipped[0].ibov;
  const bases: Partial<Record<AcoesBenchmarkKey, number>> = {};
  for (const k of activeBenches) {
    const first = clipped.find((p) => p[k] != null);
    if (first && typeof first[k] === "number") bases[k] = first[k] as number;
  }
  return clipped.map((p) => {
    const row: Record<string, number | string | null> = { date: p.date };
    row.ibov = showAbsoluteIbov ? p.ibov : baseIbov > 0 ? (p.ibov / baseIbov) * 100 : null;
    for (const k of activeBenches) {
      const base = bases[k];
      const v = p[k];
      row[k] = base && typeof v === "number" && base > 0 ? (v / base) * 100 : null;
    }
    return row;
  });
}

export function IbovHero({ data }: Props) {
  const [windowId, setWindowId] = useState<TimeWindow>("1y");
  const [activeBenches, setActiveBenches] = useState<AcoesBenchmarkKey[]>([]);

  const clipped = useMemo(() => clipWindow(data.series_daily, windowId), [data, windowId]);
  const showAbsoluteIbov = activeBenches.length === 0;
  const chartData = useMemo(
    () => renormalize(clipped, activeBenches, showAbsoluteIbov),
    [clipped, activeBenches, showAbsoluteIbov],
  );
  // Janela visível em dias corridos — alimenta o tick adaptativo (dd/mm → mai/26 → 2026).
  const spanDays = useMemo(
    () =>
      clipped.length > 1
        ? Math.max(1, diffDaysUTC(clipped[0].date, clipped[clipped.length - 1].date))
        : 1,
    [clipped],
  );

  const hero = data.hero;

  function toggleBench(k: AcoesBenchmarkKey) {
    setActiveBenches((prev) => (prev.includes(k) ? prev.filter((b) => b !== k) : [...prev, k]));
  }

  return (
    <section
      aria-label="Ibovespa — Panorama"
      className="rounded-2xl border border-[#132960]/15 bg-white p-4 shadow-sm md:p-6"
    >
      <div className="grid gap-4 md:grid-cols-[minmax(180px,220px),1fr]">
        {/* CARD MÉTRICO */}
        <div className="rounded-xl border border-[#132960]/10 bg-zinc-50/40 p-4">
          <div className="flex items-baseline justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Ibovespa</p>
            {hero?.change_pct_1d != null ? (
              <span
                className="text-[11px] font-semibold tabular-nums"
                style={{ color: variationText(hero.change_pct_1d) }}
              >
                {fmtSignedPct(hero.change_pct_1d, 2)}
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-[#132960]">
            {hero ? fmtNum(hero.last_value, 0) : "—"}{" "}
            <span className="text-sm font-normal text-zinc-500">pts</span>
          </p>
          {hero ? (
            <dl className="mt-3 space-y-1 text-[11px] text-zinc-600">
              <div className="flex items-center justify-between">
                <dt>Máx 12m</dt>
                <dd className="font-semibold tabular-nums text-[#132960]">
                  {fmtNum(hero.max_12m, 0)}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt>Mín 12m</dt>
                <dd className="font-semibold tabular-nums text-[#132960]">
                  {fmtNum(hero.min_12m, 0)}
                </dd>
              </div>
              <div className="flex items-center justify-between pt-1 text-[10px] text-zinc-400">
                <dt>Atualizado</dt>
                <dd>{fmtDataBR(hero.last_date)}</dd>
              </div>
            </dl>
          ) : null}
        </div>

        {/* CHART */}
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Ibovespa (pontos){activeBenches.length ? " · comparativo (base 100)" : ""}
            </p>
            <TimeWindowToggle value={windowId} onChange={setWindowId} />
          </div>

          <div style={{ height: 220 }} className="w-full">
            {chartData.length < 2 ? (
              <div className="flex h-full items-center justify-center text-xs italic text-zinc-400">
                sem dados na janela
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                  <CartesianGrid {...azGridProps()} />
                  <XAxis
                    {...azXAxisProps()}
                    dataKey="date"
                    tickFormatter={(d) => formatAxisDate(String(d), spanDays)}
                    minTickGap={32}
                  />
                  <YAxis
                    {...azYAxisProps()}
                    domain={["auto", "auto"]}
                    width={48}
                    tickFormatter={(v) => (typeof v === "number" ? fmtNum(v, 0) : String(v))}
                  />
                  <Tooltip
                    content={
                      <AzTooltip
                        labelFmt={(l) => fmtDataBR(String(l))}
                        valueFmt={(v, name) =>
                          name === "Ibovespa" && showAbsoluteIbov
                            ? `${fmtNum(v, 0)} pts`
                            : fmtNum(v, 2)
                        }
                      />
                    }
                    cursor={azTooltipProps().cursor}
                  />
                  <Line
                    type="monotone"
                    dataKey="ibov"
                    name="Ibovespa"
                    stroke={IBOV_COLOR}
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />
                  {activeBenches.map((k) => (
                    <Line
                      key={k}
                      type="monotone"
                      dataKey={k}
                      name={BENCH_META[k].label}
                      stroke={BENCH_META[k].color}
                      strokeWidth={1.5}
                      dot={false}
                      isAnimationActive={false}
                      connectNulls
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              Comparar com:
            </span>
            {(Object.keys(BENCH_META) as AcoesBenchmarkKey[]).map((k) => {
              const active = activeBenches.includes(k);
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => toggleBench(k)}
                  aria-pressed={active}
                  className={
                    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold transition " +
                    (active
                      ? "border-transparent text-white shadow-sm"
                      : "border-[#132960]/15 bg-white text-zinc-600 hover:border-[#132960]/40 hover:text-[#132960]")
                  }
                  style={active ? { backgroundColor: BENCH_META[k].color } : undefined}
                >
                  <span
                    aria-hidden
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ backgroundColor: active ? "#ffffff" : BENCH_META[k].color }}
                  />
                  {BENCH_META[k].label}
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <p className="min-w-0 text-[10px] text-zinc-400">
              Ibovespa (<code>^BVSP</code>) via yfinance. Benchmarks em base 100 no início da janela:
              CDI (BCB SGS 12), S&amp;P 500 (em USD) e USD/BRL. Não é recomendação.
            </p>
            {/* Cotação do hero é coletada no giro do pipeline: generated_at
                preserva os minutos para auditar atualização. */}
            <DataStamp giro={data.generated_at} dado={data.generated_at} />
          </div>
        </div>
      </div>
    </section>
  );
}
