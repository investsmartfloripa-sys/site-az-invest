"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { CurrencyToggle } from "@/components/painel/CurrencyToggle";
import DataStamp from "@/components/painel/DataStamp";
import { PeriodSelector } from "@/components/painel/PeriodSelector";
import type { FxMoversPayload } from "@/components/painel/DynamicFxMoversBar";
import type { ByPeriodBlock, Row } from "@/components/painel/DynamicReturnsBar";

/** Paleta padrão AZ p/ barras divergentes (ver PADRAO-VISUAL-GRAFICOS.md). */
export const AZ_CHART = {
  pos: "#1E8A5C",
  neg: "#BE3B33",
  posText: "#166B47",
  negText: "#9C2B24",
  zero: "#132960",
  grid: "#E2E8F0",
  ticks: "#64748B",
  labels: "#334155",
} as const;

type PanoramaByPeriod = { generated_at?: string; by_period?: ByPeriodBlock };

type CategoryId = "ativos" | "indices" | "moedas" | "commodities";

const CATEGORIES: { id: CategoryId; label: string; currencyToggle: boolean }[] = [
  { id: "ativos", label: "Ativos", currencyToggle: true },
  { id: "indices", label: "Índices globais", currencyToggle: false },
  { id: "moedas", label: "Moedas", currencyToggle: false },
  { id: "commodities", label: "Commodities", currencyToggle: true },
];

const FX_PERIOD_MAP: Record<string, string> = {
  "1d": "day",
  "1wk": "week",
  "1mo": "month",
  "3mo": "quarter",
  "1y": "year",
};

type Props = {
  assetPanorama: PanoramaByPeriod | null;
  worldPanorama: PanoramaByPeriod | null;
  fxData: FxMoversPayload | null;
  commPanorama: PanoramaByPeriod | null;
};

type ChartRow = { name: string; value: number };

function truncateName(s: string, max = 18): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

function rowsFor(
  cat: CategoryId,
  period: string,
  currency: "brl" | "usd",
  props: Props,
): { rows: ChartRow[]; updatedAt?: string } {
  if (cat === "moedas") {
    const fxPeriod = FX_PERIOD_MAP[period] ?? "month";
    const up = props.fxData?.top?.[fxPeriod as keyof NonNullable<FxMoversPayload["top"]>]?.up ?? [];
    return {
      rows: up
        .map((r) => ({ name: truncateName(String(r.ticker ?? "")), value: Number(r.change_pct) }))
        .filter((r) => Number.isFinite(r.value)),
      updatedAt: props.fxData?.generated_at,
    };
  }

  const source =
    cat === "ativos" ? props.assetPanorama : cat === "indices" ? props.worldPanorama : props.commPanorama;
  const raw: Row[] = source?.by_period?.[period]?.data ?? [];
  const rows: ChartRow[] = [];
  for (const row of raw) {
    if (cat === "ativos" && String(row.ticker ?? "") === "BRL=X") continue;
    let v: unknown;
    if (cat === "indices") {
      v = row.return_pct;
    } else if (cat === "ativos") {
      v = currency === "brl" ? row.return_brl_pct : row.return_usd_pct;
    } else {
      v = currency === "brl" ? row.return_pct_brl : row.return_pct_usd;
    }
    const num = typeof v === "number" ? v : Number(v);
    if (!Number.isFinite(num)) continue;
    rows.push({ name: truncateName(String(row.name ?? "")), value: num });
  }
  return { rows, updatedAt: source?.generated_at };
}

/**
 * Card unificado de mercados: Ativos | Índices globais | Moedas | Commodities
 * num único bar chart com segmented control. Grade vertical estilo ggplot2,
 * linha do zero em navy, valores na ponta das barras.
 */
export function MarketsPanel(props: Props) {
  const [cat, setCat] = useState<CategoryId>("ativos");
  const [period, setPeriod] = useState("1mo");
  const [currency, setCurrency] = useState<"brl" | "usd">("brl");

  const active = CATEGORIES.find((c) => c.id === cat) ?? CATEGORIES[0];

  const { rows, updatedAt } = useMemo(
    () => rowsFor(cat, period, currency, props),
    [cat, period, currency, props],
  );
  const sorted = useMemo(() => [...rows].sort((a, b) => b.value - a.value), [rows]);
  const height = Math.max(220, 28 * sorted.length + 56);

  return (
    <section className="w-full min-w-0 rounded-2xl border border-[#132960]/10 bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-bold text-[#132960] md:text-lg">Mercados — retornos (%)</h2>
        <div className="flex flex-wrap items-center gap-2">
          {active.currencyToggle ? <CurrencyToggle value={currency} onChange={setCurrency} /> : null}
          <PeriodSelector value={period} onChange={setPeriod} />
        </div>
      </div>

      <div className="mb-3 inline-flex flex-wrap rounded-lg bg-zinc-100 p-0.5">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setCat(c.id)}
            aria-pressed={cat === c.id}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
              cat === c.id ? "bg-white text-[#132960] shadow-sm" : "text-zinc-500 hover:text-[#132960]"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {sorted.length === 0 ? (
        <p className="py-10 text-center text-sm text-zinc-500">Sem dados para este período.</p>
      ) : (
        <div style={{ height }} className="w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={sorted}
              layout="vertical"
              barCategoryGap="35%"
              margin={{ left: 4, right: 48, top: 8, bottom: 4 }}
            >
              <CartesianGrid horizontal={false} stroke={AZ_CHART.grid} strokeWidth={1} />
              <XAxis
                type="number"
                tick={{ fontSize: 11, fill: AZ_CHART.ticks }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `${v}%`}
                tickCount={5}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={132}
                tick={{ fontSize: 11, fill: AZ_CHART.labels }}
                axisLine={false}
                tickLine={false}
                interval={0}
              />
              <ReferenceLine x={0} stroke={AZ_CHART.zero} strokeOpacity={0.55} strokeWidth={1.5} />
              <Tooltip
                cursor={{ fill: "rgba(19,41,96,0.05)" }}
                contentStyle={{
                  background: AZ_CHART.zero,
                  border: "none",
                  borderRadius: 8,
                  color: "#fff",
                  fontSize: 12,
                  boxShadow: "0 4px 12px rgba(19,41,96,.25)",
                }}
                itemStyle={{ color: "#fff" }}
                labelStyle={{ color: "#94A3B8", fontWeight: 600 }}
                formatter={(value) => {
                  const v = typeof value === "number" ? value : Number(value);
                  return [Number.isFinite(v) ? `${v > 0 ? "+" : ""}${v.toFixed(2)}%` : "—", "Retorno"];
                }}
              />
              <Bar dataKey="value" radius={[0, 3, 3, 0]} maxBarSize={16}>
                {sorted.map((e) => (
                  <Cell key={e.name} fill={e.value >= 0 ? AZ_CHART.pos : AZ_CHART.neg} />
                ))}
                <LabelList
                  dataKey="value"
                  position="right"
                  formatter={(v) => {
                    const n = typeof v === "number" ? v : Number(v);
                    if (!Number.isFinite(n)) return "";
                    return `${n > 0 ? "+" : ""}${n.toFixed(1)}%`;
                  }}
                  style={{ fontSize: 10.5, fill: "#475569", fontVariantNumeric: "tabular-nums" }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {updatedAt ? (
        <p className="mt-2 text-right">
          {/* Fonte intradiária (cron 15min): generated_at carrega os minutos do dado. */}
          <DataStamp giro={updatedAt} dado={updatedAt} />
        </p>
      ) : null}
    </section>
  );
}
