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

import {
  TIME_WINDOW_OPTIONS,
  TimeWindowToggle,
  type TimeWindow,
} from "@/components/painel/fii/TimeWindowToggle";
import type {
  FiiBenchmarkKey,
  FiiIfixData,
  FiiTimeSeriesPoint,
} from "@/lib/painel-fii";

type Props = {
  data: FiiIfixData;
};

const BENCH_META: Record<FiiBenchmarkKey, { label: string; color: string }> = {
  IMAB: { label: "IMA-B", color: "#7E22CE" },
  IMAB5P: { label: "IMA-B5+", color: "#0EA5E9" },
  CDI: { label: "CDI", color: "#16A34A" },
  IBOV: { label: "IBOV", color: "#EAB308" },
};

const IFIX_COLOR = "#132960"; // azul profundo AZ Invest

/** Filtra a série pra janela escolhida (corte por data, do final pra trás). */
function clipWindow(series: FiiTimeSeriesPoint[], windowId: TimeWindow): FiiTimeSeriesPoint[] {
  if (!series.length) return [];
  const days = TIME_WINDOW_OPTIONS.find((o) => o.id === windowId)?.days ?? 365;
  const last = new Date(series[series.length - 1].date + "T00:00:00Z").getTime();
  const cutoff = last - days * 86_400_000;
  return series.filter((p) => new Date(p.date + "T00:00:00Z").getTime() >= cutoff);
}

/** Renormaliza séries selecionadas pra base 100 do primeiro ponto da janela. */
function renormalizeToBase100(
  clipped: FiiTimeSeriesPoint[],
  activeBenches: FiiBenchmarkKey[],
  showAsAbsoluteIfix: boolean,
): Array<Record<string, number | string | null>> {
  if (clipped.length === 0) return [];

  const baseIfix = clipped[0].ifix;
  const bases: Partial<Record<FiiBenchmarkKey, number>> = {};
  for (const k of activeBenches) {
    // Primeiro ponto da janela com valor válido pro bench
    const first = clipped.find((p) => p[k] != null);
    if (first && typeof first[k] === "number") bases[k] = first[k] as number;
  }

  return clipped.map((p) => {
    const row: Record<string, number | string | null> = { date: p.date };
    if (showAsAbsoluteIfix) {
      row.ifix = p.ifix;
    } else {
      row.ifix = baseIfix > 0 ? (p.ifix / baseIfix) * 100 : null;
    }
    for (const k of activeBenches) {
      const base = bases[k];
      const v = p[k];
      if (base && typeof v === "number" && base > 0) {
        row[k] = (v / base) * 100;
      } else {
        row[k] = null;
      }
    }
    return row;
  });
}

/** Formata data pt-BR curta na axis (dd/mm ou mm/aa dependendo da janela). */
function formatAxisDate(d: string, span: TimeWindow): string {
  const dt = new Date(d + "T00:00:00Z");
  if (span === "7d" || span === "5d" || span === "30d") {
    return dt.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "UTC" });
  }
  return dt.toLocaleDateString("pt-BR", { month: "2-digit", year: "2-digit", timeZone: "UTC" });
}

export function IfixHero({ data }: Props) {
  const [windowId, setWindowId] = useState<TimeWindow>("1y");
  const [activeBenches, setActiveBenches] = useState<FiiBenchmarkKey[]>([]);

  const clipped = useMemo(() => clipWindow(data.series_daily, windowId), [data, windowId]);
  const showAsAbsoluteIfix = activeBenches.length === 0;
  const chartData = useMemo(
    () => renormalizeToBase100(clipped, activeBenches, showAsAbsoluteIfix),
    [clipped, activeBenches, showAsAbsoluteIfix],
  );

  const hero = data.hero;
  const positive = (hero?.change_pct_1d ?? 0) >= 0;

  function toggleBench(k: FiiBenchmarkKey) {
    setActiveBenches((prev) => (prev.includes(k) ? prev.filter((b) => b !== k) : [...prev, k]));
  }

  return (
    <section
      aria-label="IFIX — Panorama"
      className="rounded-2xl border border-[#132960]/15 bg-white p-4 shadow-sm md:p-6"
    >
      <div className="grid gap-4 md:grid-cols-[minmax(180px,220px),1fr]">
        {/* CARD MÉTRICO — esquerda */}
        <div className="rounded-xl border border-[#132960]/10 bg-zinc-50/40 p-4">
          <div className="flex items-baseline justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">IFIX</p>
            {hero?.change_pct_1d != null ? (
              <span
                className={`text-[11px] font-semibold ${
                  positive ? "text-[#16A34A]" : "text-[#DC2626]"
                }`}
              >
                {positive ? "▲" : "▼"} {Math.abs(hero.change_pct_1d).toFixed(2)}%
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-[#132960]">
            {hero
              ? hero.last_value.toLocaleString("pt-BR", {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                })
              : "—"}{" "}
            <span className="text-sm font-normal text-zinc-500">pts</span>
          </p>
          {hero ? (
            <dl className="mt-3 space-y-1 text-[11px] text-zinc-600">
              <div className="flex items-center justify-between">
                <dt>Máx 12m</dt>
                <dd className="font-semibold tabular-nums text-[#132960]">
                  {hero.max_12m.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt>Mín 12m</dt>
                <dd className="font-semibold tabular-nums text-[#132960]">
                  {hero.min_12m.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
                </dd>
              </div>
              <div className="flex items-center justify-between pt-1 text-[10px] text-zinc-400">
                <dt>Atualizado</dt>
                <dd>
                  {new Date(hero.last_date + "T00:00:00Z").toLocaleDateString("pt-BR", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "2-digit",
                    timeZone: "UTC",
                  })}
                </dd>
              </div>
            </dl>
          ) : null}
        </div>

        {/* CHART — direita */}
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              IFIX (cotação){activeBenches.length ? " · comparativo (base 100)" : ""}
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
                  <CartesianGrid strokeDasharray="2 4" stroke="#E4E4E7" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(d) => formatAxisDate(String(d), windowId)}
                    tick={{ fontSize: 10, fill: "#71717A" }}
                    minTickGap={32}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "#71717A" }}
                    domain={["auto", "auto"]}
                    width={48}
                    tickFormatter={(v) =>
                      typeof v === "number"
                        ? v.toLocaleString("pt-BR", { maximumFractionDigits: 0 })
                        : String(v)
                    }
                  />
                  <Tooltip
                    contentStyle={{ fontSize: 11, padding: "6px 10px", borderRadius: 6 }}
                    labelFormatter={(d) =>
                      new Date(String(d) + "T00:00:00Z").toLocaleDateString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        timeZone: "UTC",
                      })
                    }
                    formatter={(v, name) => {
                      const num = typeof v === "number" ? v : Number(v);
                      if (!Number.isFinite(num)) return ["—", name];
                      const isAbs = name === "IFIX" && showAsAbsoluteIfix;
                      return [
                        isAbs
                          ? num.toLocaleString("pt-BR", { maximumFractionDigits: 0 }) + " pts"
                          : num.toFixed(2),
                        name,
                      ];
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="ifix"
                    name="IFIX"
                    stroke={IFIX_COLOR}
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

          {/* Comparar com */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              Comparar com:
            </span>
            {(Object.keys(BENCH_META) as FiiBenchmarkKey[]).map((k) => {
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
        </div>
      </div>
    </section>
  );
}
