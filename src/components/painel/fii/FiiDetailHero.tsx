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
import type { FiiDetailEntry } from "@/lib/painel-fii";

function formatPct(value: number | null | undefined, fractionDigits = 2): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `${value.toFixed(fractionDigits)}%`;
}
function formatBRL(value: number | null | undefined, frac = 2): string {
  if (value == null || Number.isNaN(value)) return "—";
  return value.toLocaleString("pt-BR", { minimumFractionDigits: frac, maximumFractionDigits: frac });
}
function formatBig(value: number | null | undefined, currency = ""): string {
  if (value == null || Number.isNaN(value)) return "—";
  const abs = Math.abs(value);
  const prefix = currency ? `${currency} ` : "";
  if (abs >= 1e9) return `${prefix}${(value / 1e9).toFixed(2)} Bi`;
  if (abs >= 1e6) return `${prefix}${(value / 1e6).toFixed(2)} M`;
  return `${prefix}${value.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;
}
function formatDateBR(d: string | null): string {
  if (!d) return "—";
  const dt = new Date(d + "T00:00:00Z");
  return dt.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", timeZone: "UTC" });
}
function formatAxisDate(d: string, span: TimeWindow): string {
  const dt = new Date(d + "T00:00:00Z");
  if (span === "7d" || span === "5d" || span === "30d") {
    return dt.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "UTC" });
  }
  return dt.toLocaleDateString("pt-BR", { month: "2-digit", year: "2-digit", timeZone: "UTC" });
}

function clipWindow(series: Array<{ date: string; close: number }>, windowId: TimeWindow) {
  if (!series.length) return [];
  const days = TIME_WINDOW_OPTIONS.find((o) => o.id === windowId)?.days ?? 365;
  const last = new Date(series[series.length - 1].date + "T00:00:00Z").getTime();
  const cutoff = last - days * 86_400_000;
  return series.filter((p) => new Date(p.date + "T00:00:00Z").getTime() >= cutoff);
}

type Props = { entry: FiiDetailEntry };

export function FiiDetailHero({ entry }: Props) {
  const [windowId, setWindowId] = useState<TimeWindow>("1y");
  const clipped = useMemo(() => clipWindow(entry.price_series_daily, windowId), [entry, windowId]);

  const hero = entry.hero;
  const positive = (hero.change_pct_1d ?? 0) >= 0;

  return (
    <section
      aria-label={`${entry.ticker} — Hero`}
      className="space-y-4 rounded-2xl border border-[#132960]/15 bg-white p-4 shadow-sm md:p-6"
    >
      {/* Linha de KPIs grandes */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5 md:gap-6">
        {/* Ticker badge */}
        <div className="flex items-center">
          <span className="rounded-md border-2 border-[#132960] px-3 py-1.5 text-base font-bold tracking-wider text-[#132960]">
            {entry.ticker}
          </span>
        </div>
        <KpiBlock
          label="Dividend Yield"
          value={formatPct(hero.dy_12m_pct)}
          tooltip={entry.dy_atypical ? "DY > 18% pode incluir amortização." : undefined}
        />
        <KpiBlock
          label="Último Rendimento"
          value={hero.last_dividend_brl != null ? `R$ ${formatBRL(hero.last_dividend_brl, 4)}` : "—"}
          sub={hero.last_dividend_date ? formatDateBR(hero.last_dividend_date) : undefined}
        />
        <KpiBlock label="Patrimônio Líquido" value={formatBig(hero.pl, "R$")} sub={hero.pl_ref_date ? `ref ${formatDateBR(hero.pl_ref_date)}` : undefined} />
        <KpiBlock
          label="P/VP"
          value={hero.pvp != null ? hero.pvp.toFixed(3) : "—"}
          tooltip={entry.pvp_warning ? "P/VP < 0,7 pode indicar distress." : undefined}
        />
      </div>

      {/* Cotação + gráfico */}
      <div className="grid gap-4 md:grid-cols-[minmax(180px,220px),1fr]">
        <div className="rounded-xl border border-[#132960]/10 bg-zinc-50/40 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Cotação</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-[#132960]">
            {hero.price != null ? formatBRL(hero.price) : "—"}
          </p>
          {hero.change_pct_1d != null ? (
            <p className={`text-[11px] font-semibold ${positive ? "text-[#16A34A]" : "text-[#DC2626]"}`}>
              {positive ? "▲" : "▼"} {Math.abs(hero.change_pct_1d).toFixed(2)}%
            </p>
          ) : null}
          <dl className="mt-3 space-y-1 text-[11px] text-zinc-600">
            <div className="flex items-center justify-between">
              <dt>Máxima 12m</dt>
              <dd className="font-semibold tabular-nums text-[#132960]">{hero.max_12m != null ? formatBRL(hero.max_12m) : "—"}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt>Mínima 12m</dt>
              <dd className="font-semibold tabular-nums text-[#132960]">{hero.min_12m != null ? formatBRL(hero.min_12m) : "—"}</dd>
            </div>
          </dl>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Cotação histórica
            </p>
            <TimeWindowToggle value={windowId} onChange={setWindowId} />
          </div>
          <div style={{ height: 200 }} className="w-full">
            {clipped.length < 2 ? (
              <div className="flex h-full items-center justify-center text-xs italic text-zinc-400">
                sem dados na janela
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={clipped} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
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
                    tickFormatter={(v) => typeof v === "number" ? formatBRL(v, 2) : String(v)}
                  />
                  <Tooltip
                    contentStyle={{ fontSize: 11, padding: "6px 10px", borderRadius: 6 }}
                    labelFormatter={(d) => new Date(String(d) + "T00:00:00Z").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" })}
                    formatter={(v) => {
                      const n = typeof v === "number" ? v : Number(v);
                      return [Number.isFinite(n) ? `R$ ${formatBRL(n)}` : "—", "Cotação"];
                    }}
                  />
                  <Line type="monotone" dataKey="close" stroke="#132960" strokeWidth={2} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function KpiBlock({ label, value, sub, tooltip }: { label: string; value: string; sub?: string; tooltip?: string }) {
  return (
    <div className="flex flex-col" title={tooltip}>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">{label}</p>
      <p className={`text-lg font-semibold tabular-nums text-[#132960] md:text-xl ${tooltip ? "cursor-help" : ""}`}>
        {value}
        {tooltip ? <span className="text-amber-700">*</span> : null}
      </p>
      {sub ? <p className="text-[10px] text-zinc-500">{sub}</p> : null}
    </div>
  );
}
