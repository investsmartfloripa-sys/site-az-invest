"use client";

import { useMemo, useState } from "react";

import type { MarketFundamentals, TickerFundamentals } from "@/lib/painel-market-data";
import { formatPctFromRatio, formatRatio } from "@/lib/painel-market-data";
import { MarketCard } from "@/components/painel/market/MarketCard";

type Metric = "trailingPE" | "priceToBook" | "dividendYield" | "returnOnEquity" | "enterpriseToEbitda";

const METRICS: Array<{ id: Metric; label: string; lowerIsBetter: boolean; isPct: boolean }> = [
  { id: "trailingPE",         label: "P/L",       lowerIsBetter: true,  isPct: false },
  { id: "priceToBook",        label: "P/VP",      lowerIsBetter: true,  isPct: false },
  { id: "enterpriseToEbitda", label: "EV/EBITDA", lowerIsBetter: true,  isPct: false },
  { id: "dividendYield",      label: "Dividend Yield", lowerIsBetter: false, isPct: true },
  { id: "returnOnEquity",     label: "ROE",       lowerIsBetter: false, isPct: true },
];

function pickValue(t: TickerFundamentals, m: Metric): number | null {
  if (m === "dividendYield") {
    return t.info.dividendYield ?? t.info.trailingAnnualDividendYield ?? null;
  }
  return (t.info[m] as number | null | undefined) ?? null;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const arr = [...values].sort((a, b) => a - b);
  const mid = Math.floor(arr.length / 2);
  return arr.length % 2 ? arr[mid] : (arr[mid - 1] + arr[mid]) / 2;
}

/** Cor degradê azul AZ -> branco -> vermelho (lowerIsBetter true) ou inverso. */
function colorFor(value: number | null, min: number, max: number, lowerIsBetter: boolean): string {
  if (value == null || min === max) return "#f5f5f4";
  const t = (value - min) / (max - min); // 0..1
  // se lowerIsBetter, 0 = melhor (verde), 1 = pior (vermelho); senao inverte
  const norm = lowerIsBetter ? t : 1 - t;
  // gradiente: 0 -> #16A34A, 0.5 -> #FACC15, 1 -> #DC2626 (semaforo soft)
  if (norm < 0.5) {
    const p = norm / 0.5;
    return mix("#16A34A", "#FACC15", p);
  }
  const p = (norm - 0.5) / 0.5;
  return mix("#FACC15", "#DC2626", p);
}

function mix(a: string, b: string, t: number): string {
  const ar = parseInt(a.slice(1, 3), 16);
  const ag = parseInt(a.slice(3, 5), 16);
  const ab = parseInt(a.slice(5, 7), 16);
  const br = parseInt(b.slice(1, 3), 16);
  const bg = parseInt(b.slice(3, 5), 16);
  const bb = parseInt(b.slice(5, 7), 16);
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return `rgb(${r}, ${g}, ${bl})`;
}

export function SectorHeatmap({ data }: { data: MarketFundamentals | null }) {
  const [metric, setMetric] = useState<Metric>("trailingPE");

  const grouped = useMemo(() => {
    if (!data) return [] as Array<{ sector: string; n: number; median: number | null }>;
    const m: Record<string, number[]> = {};
    for (const t of Object.values(data.tickers)) {
      // So inclui acoes BR/US para o heatmap (faz sentido com multiplos)
      if (t.klass !== "br_acoes" && t.klass !== "us_acoes") continue;
      const v = pickValue(t, metric);
      if (v == null) continue;
      if (!m[t.sector]) m[t.sector] = [];
      m[t.sector].push(v);
    }
    return Object.entries(m)
      .map(([sector, values]) => ({ sector, n: values.length, median: median(values) }))
      .filter((row) => row.median != null)
      .sort((a, b) => (b.median ?? 0) - (a.median ?? 0));
  }, [data, metric]);

  const metricDef = METRICS.find((m) => m.id === metric)!;
  const values = grouped.map((g) => g.median ?? 0);
  const mn = values.length ? Math.min(...values) : 0;
  const mx = values.length ? Math.max(...values) : 0;

  return (
    <MarketCard
      title="Mediana setorial"
      subtitle="Mediana de múltiplos por setor (ações BR + EUA)."
      badge="Yahoo Finance"
      bodyClassName="px-4 pb-4 pt-2"
      stampGiro={data?.generated_at ?? null}
      stampDado={data?.generated_at ?? null}
      toolbar={
        <div className="flex flex-wrap gap-1">
          {METRICS.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setMetric(m.id)}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                metric === m.id
                  ? "bg-[#027DFC] text-white"
                  : "border border-[#132960]/20 bg-white text-[#132960] hover:border-[#027DFC] hover:text-[#027DFC]"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      }
    >
      {!data ? (
        <div className="py-10 text-center text-sm text-zinc-500">
          Dados ainda não publicados pelo pipeline diário.
        </div>
      ) : grouped.length === 0 ? (
        <div className="py-10 text-center text-sm text-zinc-500">
          Sem valores válidos para {metricDef.label}.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {grouped.map((row) => (
            <div
              key={row.sector}
              style={{ backgroundColor: colorFor(row.median, mn, mx, metricDef.lowerIsBetter) }}
              className="rounded-xl p-3 text-white shadow-sm"
            >
              <p className="text-[11px] font-semibold uppercase tracking-wide drop-shadow">{row.sector}</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums drop-shadow">
                {metricDef.isPct ? formatPctFromRatio(row.median) : formatRatio(row.median)}
              </p>
              <p className="text-[10px] drop-shadow">n={row.n}</p>
            </div>
          ))}
        </div>
      )}
    </MarketCard>
  );
}
