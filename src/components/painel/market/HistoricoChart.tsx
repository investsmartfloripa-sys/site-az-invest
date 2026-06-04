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
  Legend,
} from "recharts";

import type { CatalogAsset, MarketHistoryFull, TickerSeries } from "@/lib/painel-market-data";
import { MarketCard } from "@/components/painel/market/MarketCard";
import { TickerPicker } from "@/components/painel/market/TickerPicker";

type Period = "1m" | "3m" | "6m" | "ytd" | "1y" | "5y" | "max";
type ScaleMode = "rebase" | "pct" | "raw" | "log";

const PERIODS: Array<{ id: Period; label: string }> = [
  { id: "1m", label: "1M" },
  { id: "3m", label: "3M" },
  { id: "6m", label: "6M" },
  { id: "ytd", label: "YTD" },
  { id: "1y", label: "1A" },
  { id: "5y", label: "5A" },
  { id: "max", label: "Max" },
];

const SCALE_MODES: Array<{ id: ScaleMode; label: string; hint: string }> = [
  { id: "rebase", label: "Rebase 100", hint: "Todos partem de 100 na data inicial" },
  { id: "pct", label: "% acumul.", hint: "Variação % acumulada" },
  { id: "raw", label: "Preço", hint: "Preço bruto (escalas diferentes)" },
  { id: "log", label: "Log", hint: "Eixo Y em escala logarítmica" },
];

/** Paleta categórica institucional (até 8 séries simultâneas). */
const COLORS = [
  "#027DFC", // AZ azul
  "#F97316", // laranja
  "#16A34A", // verde
  "#DC2626", // vermelho
  "#7C3AED", // roxo
  "#0891B2", // ciano
  "#CA8A04", // amarelo terra
  "#0F172A", // grafite (último — vira o "principal" se for o foco)
];

const PRESETS: Array<{ name: string; tickers: string[] }> = [
  { name: "Brasil vs Mundo", tickers: ["^BVSP", "^GSPC", "EEM", "URTH"] },
  { name: "EUA Big Techs", tickers: ["AAPL", "MSFT", "GOOGL", "NVDA", "META", "AMZN"] },
  { name: "Bancos BR", tickers: ["ITUB4.SA", "BBDC4.SA", "BBAS3.SA", "SANB11.SA"] },
  { name: "Macro BR", tickers: ["^BVSP", "BRL=X", "BOVA11.SA", "IMAB11.SA"] },
  { name: "Commodities", tickers: ["GC=F", "CL=F", "ZS=F", "HG=F"] },
  { name: "Cripto", tickers: ["BTC-USD", "ETH-USD", "SOL-USD"] },
  { name: "Treasury vs HY", tickers: ["TLT", "IEF", "SHV", "HYG", "LQD"] },
  { name: "FX vs BRL", tickers: ["BRL=X", "EURBRL=X", "GBPBRL=X"] },
];

type Props = {
  full: MarketHistoryFull | null;
  catalog: CatalogAsset[];
  /** Tickers iniciais. */
  initial?: string[];
};

function periodCutoffDate(period: Period, latestDateIso: string): string {
  // latestDateIso eh "YYYY-MM-DD". Calcula data de corte conforme o periodo.
  const last = new Date(latestDateIso + "T00:00:00Z");
  const d = new Date(last);
  switch (period) {
    case "1m":
      d.setMonth(d.getMonth() - 1);
      break;
    case "3m":
      d.setMonth(d.getMonth() - 3);
      break;
    case "6m":
      d.setMonth(d.getMonth() - 6);
      break;
    case "ytd":
      return `${last.getUTCFullYear()}-01-01`;
    case "1y":
      d.setFullYear(d.getFullYear() - 1);
      break;
    case "5y":
      d.setFullYear(d.getFullYear() - 5);
      break;
    case "max":
      return "1900-01-01";
  }
  return d.toISOString().slice(0, 10);
}

function buildChartData(
  full: MarketHistoryFull,
  tickers: string[],
  period: Period,
  scale: ScaleMode,
): Array<Record<string, number | string>> {
  if (tickers.length === 0) return [];

  // Datas de cada ticker
  const seriesByTicker: Record<string, Array<[string, number]>> = {};
  let globalLast = "1900-01-01";
  for (const t of tickers) {
    const s = full.tickers[t];
    if (!s) continue;
    seriesByTicker[t] = s.series_daily;
    const last = s.series_daily[s.series_daily.length - 1]?.[0];
    if (last && last > globalLast) globalLast = last;
  }
  if (Object.keys(seriesByTicker).length === 0) return [];

  const cutoff = periodCutoffDate(period, globalLast);

  // Para rebase/pct, achamos o primeiro valor de cada ticker dentro do periodo.
  const baseByTicker: Record<string, number> = {};
  for (const [ticker, series] of Object.entries(seriesByTicker)) {
    const firstInWindow = series.find(([d]) => d >= cutoff);
    if (firstInWindow) baseByTicker[ticker] = firstInWindow[1];
  }

  // Coleta universo de datas e gera registros wide.
  const dateSet = new Set<string>();
  for (const series of Object.values(seriesByTicker)) {
    for (const [d] of series) {
      if (d >= cutoff) dateSet.add(d);
    }
  }
  const dates = Array.from(dateSet).sort();

  // Index por ticker pra lookup rapido
  const indexedByTicker: Record<string, Record<string, number>> = {};
  for (const [ticker, series] of Object.entries(seriesByTicker)) {
    const m: Record<string, number> = {};
    for (const [d, v] of series) m[d] = v;
    indexedByTicker[ticker] = m;
  }

  // Wide
  const rows: Array<Record<string, number | string>> = [];
  // Track ultimo valor por ticker pra forward-fill em datas faltantes
  const lastSeen: Record<string, number | undefined> = {};
  for (const d of dates) {
    const row: Record<string, number | string> = { date: d };
    for (const t of tickers) {
      const idx = indexedByTicker[t];
      if (!idx) continue;
      const raw = idx[d];
      if (raw !== undefined) lastSeen[t] = raw;
      const v = lastSeen[t];
      if (v === undefined) continue;
      const base = baseByTicker[t];
      if (scale === "rebase") {
        if (base && base > 0) row[t] = +(100 * (v / base)).toFixed(2);
      } else if (scale === "pct") {
        if (base && base > 0) row[t] = +(100 * (v / base - 1)).toFixed(2);
      } else {
        row[t] = +v.toFixed(4);
      }
    }
    rows.push(row);
  }

  return rows;
}

function tickerColor(idx: number): string {
  return COLORS[idx % COLORS.length];
}

function shortDate(d: string): string {
  // YYYY-MM-DD -> DD/MM/YY
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y.slice(2)}`;
}

export function HistoricoChart({ full, catalog, initial }: Props) {
  const [selected, setSelected] = useState<string[]>(initial && initial.length > 0 ? initial : ["^BVSP", "^GSPC", "BRL=X"]);
  const [period, setPeriod] = useState<Period>("1y");
  const [scale, setScale] = useState<ScaleMode>("rebase");

  const tickerToAsset = useMemo(() => {
    const m: Record<string, CatalogAsset> = {};
    for (const a of catalog) m[a.ticker] = a;
    return m;
  }, [catalog]);

  const chartData = useMemo(() => {
    if (!full) return [];
    return buildChartData(full, selected, period, scale);
  }, [full, selected, period, scale]);

  const yDomain: [number | "auto", number | "auto"] = useMemo(() => {
    if (scale === "log") return ["auto", "auto"];
    if (scale === "rebase" || scale === "pct") return ["auto", "auto"];
    return ["auto", "auto"];
  }, [scale]);

  function applyPreset(tickers: string[]) {
    setSelected(tickers.filter((t) => full?.tickers[t]));
  }

  if (!full) {
    return (
      <MarketCard title="Histórico comparativo">
        <div className="py-10 text-center text-sm text-zinc-500">
          Sem dados de mercado disponíveis no momento. O pipeline diário ainda não publicou os JSONs.
        </div>
      </MarketCard>
    );
  }

  const lastPlottedDate = chartData[chartData.length - 1]?.date ?? null;

  return (
    <MarketCard
      title="Histórico comparativo"
      subtitle="Compare até 8 ativos em janelas de 1M a 5 anos."
      badge="Yahoo Finance"
      bodyClassName="px-4 pb-4 pt-2"
      footer="Fonte: Yahoo Finance"
      stampGiro={full.generated_at}
      stampDado={typeof lastPlottedDate === "string" ? lastPlottedDate : null}
      toolbar={
        <div className="flex flex-wrap items-center gap-2">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPeriod(p.id)}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                period === p.id
                  ? "bg-[#027DFC] text-white"
                  : "border border-[#132960]/20 bg-white text-[#132960] hover:border-[#027DFC] hover:text-[#027DFC]"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      }
    >
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-medium text-zinc-500">Escala:</span>
          {SCALE_MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setScale(m.id)}
              title={m.hint}
              className={`rounded-md px-2 py-1 font-semibold transition ${
                scale === m.id
                  ? "bg-[#132960] text-white"
                  : "border border-[#132960]/20 bg-white text-[#132960] hover:border-[#027DFC] hover:text-[#027DFC]"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-medium text-zinc-500">Presets:</span>
          {PRESETS.map((preset) => (
            <button
              key={preset.name}
              type="button"
              onClick={() => applyPreset(preset.tickers)}
              className="rounded-full border border-[#132960]/15 bg-zinc-50 px-2.5 py-1 font-medium text-[#132960] hover:border-[#027DFC] hover:text-[#027DFC]"
            >
              {preset.name}
            </button>
          ))}
        </div>

        <TickerPicker
          catalog={catalog}
          selected={selected}
          onChange={setSelected}
          max={8}
        />

        <div className="h-[420px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 16, bottom: 10, left: 0 }}>
              <CartesianGrid stroke="#e2e8f0" strokeDasharray="2 4" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: "#475569" }}
                tickFormatter={shortDate}
                minTickGap={28}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#475569" }}
                domain={yDomain}
                scale={scale === "log" ? "log" : "auto"}
                tickFormatter={(v: number) => {
                  if (scale === "rebase") return v.toFixed(0);
                  if (scale === "pct") return `${v.toFixed(0)}%`;
                  return v.toFixed(2);
                }}
                width={56}
              />
              <Tooltip
                labelFormatter={(label) => shortDate(String(label ?? ""))}
                formatter={(value, name) => {
                  const v = typeof value === "number" ? value : Number(value);
                  const nm = String(name ?? "");
                  const asset = tickerToAsset[nm];
                  const displayName = asset ? asset.name : nm;
                  if (Number.isNaN(v)) return ["—", displayName];
                  if (scale === "rebase") return [v.toFixed(2), displayName];
                  if (scale === "pct") return [`${v.toFixed(2)}%`, displayName];
                  return [v.toFixed(4), displayName];
                }}
                contentStyle={{
                  borderRadius: 8,
                  border: "1px solid #132960",
                  fontSize: 12,
                  padding: "6px 10px",
                }}
              />
              <Legend
                wrapperStyle={{ fontSize: 12 }}
                formatter={(value: string) => {
                  const asset = tickerToAsset[value];
                  return asset ? asset.name : value;
                }}
              />
              {selected.map((t, i) => (
                <Line
                  key={t}
                  type="monotone"
                  dataKey={t}
                  stroke={tickerColor(i)}
                  strokeWidth={1.8}
                  dot={false}
                  isAnimationActive={false}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>

        <p className="text-xs italic text-zinc-500">
          {scale === "rebase"
            ? "Todas as séries rebasadas a 100 no primeiro pregão da janela selecionada."
            : scale === "pct"
              ? "Variação % acumulada desde o primeiro pregão da janela selecionada."
              : scale === "log"
                ? "Eixo Y em escala logarítmica."
                : "Preço bruto em moeda nativa."}
          {" "}Datas faltantes são forward-filled (último close conhecido).
        </p>
      </div>
    </MarketCard>
  );
}
