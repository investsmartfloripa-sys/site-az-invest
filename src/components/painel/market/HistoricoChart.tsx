"use client";

import { useMemo, useState } from "react";
import {
  Brush,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { CatalogAsset, MarketHistoryFull } from "@/lib/painel-market-data";
import { MarketCard } from "@/components/painel/market/MarketCard";
import { TickerPicker } from "@/components/painel/market/TickerPicker";
import {
  AzPeriodSelector,
  resolvePeriodRange,
  useAzPeriodQueryState,
} from "@/components/painel/charts";
import { AzTooltip, azGridProps, azXAxisProps, azYAxisProps } from "@/components/painel/core";
import { AZ_BRAND, AZ_SERIES, AZ_TOOLTIP_PROPS, benchmarkColor } from "@/lib/az-chart-theme";
import { diffDaysUTC, fmtDataBR, fmtNum, fmtSignedPct, formatAxisDate } from "@/lib/format-br";

type ScaleMode = "rebase" | "pct" | "raw" | "log";

const SCALE_MODES: Array<{ id: ScaleMode; label: string; hint: string }> = [
  { id: "rebase", label: "Rebase 100", hint: "Todos partem de 100 na data inicial" },
  { id: "pct", label: "% acumul.", hint: "Variação % acumulada" },
  { id: "raw", label: "Preço", hint: "Preço bruto (escalas diferentes)" },
  { id: "log", label: "Log", hint: "Eixo Y em escala logarítmica" },
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

function buildChartData(
  full: MarketHistoryFull,
  tickers: string[],
  from: string,
  to: string,
  scale: ScaleMode,
): Array<Record<string, number | string>> {
  if (tickers.length === 0) return [];

  // Datas de cada ticker
  const seriesByTicker: Record<string, Array<[string, number]>> = {};
  for (const t of tickers) {
    const s = full.tickers[t];
    if (!s) continue;
    seriesByTicker[t] = s.series_daily;
  }
  if (Object.keys(seriesByTicker).length === 0) return [];

  // Para rebase/pct, achamos o primeiro valor de cada ticker dentro do periodo.
  const baseByTicker: Record<string, number> = {};
  for (const [ticker, series] of Object.entries(seriesByTicker)) {
    const firstInWindow = series.find(([d]) => d >= from && d <= to);
    if (firstInWindow) baseByTicker[ticker] = firstInWindow[1];
  }

  // Coleta universo de datas e gera registros wide.
  const dateSet = new Set<string>();
  for (const series of Object.values(seriesByTicker)) {
    for (const [d] of series) {
      if (d >= from && d <= to) dateSet.add(d);
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

export function HistoricoChart({ full, catalog, initial }: Props) {
  const [selected, setSelected] = useState<string[]>(initial && initial.length > 0 ? initial : ["^BVSP", "^GSPC", "BRL=X"]);
  const [period, setPeriod] = useAzPeriodQueryState("hist-", { id: "1y" });
  const [scale, setScale] = useState<ScaleMode>("rebase");

  const tickerToAsset = useMemo(() => {
    const m: Record<string, CatalogAsset> = {};
    for (const a of catalog) m[a.ticker] = a;
    return m;
  }, [catalog]);

  // Range disponível (união das séries selecionadas) — limita o "Personalizado".
  const seriesRange = useMemo(() => {
    if (!full) return null;
    let min = "";
    let max = "";
    for (const t of selected) {
      const s = full.tickers[t];
      if (!s || s.series_daily.length === 0) continue;
      const first = s.series_daily[0]?.[0];
      const last = s.series_daily[s.series_daily.length - 1]?.[0];
      if (first && (!min || first < min)) min = first;
      if (last && (!max || last > max)) max = last;
    }
    return min && max ? { min, max } : null;
  }, [full, selected]);

  // Corte de período 100% UTC (resolvePeriodRange — nada de setMonth local).
  const range = useMemo(() => {
    if (!seriesRange) return null;
    return resolvePeriodRange(period, seriesRange.min, seriesRange.max);
  }, [period, seriesRange]);

  const chartData = useMemo(() => {
    if (!full || !range) return [];
    return buildChartData(full, selected, range.from, range.to, scale);
  }, [full, selected, range, scale]);

  // Cores: benchmarks com cor FIXA do site (IBOV navy, S&P 500 violeta,
  // USD/BRL verde...); demais ciclam AZ_SERIES pulando cores já usadas.
  const colorByTicker = useMemo(() => {
    const used = new Set<string>();
    const map: Record<string, string> = {};
    for (const t of selected) {
      const bench = benchmarkColor(t) ?? benchmarkColor(tickerToAsset[t]?.name ?? "");
      if (bench && !used.has(bench)) {
        map[t] = bench;
        used.add(bench);
      }
    }
    let i = 0;
    for (const t of selected) {
      if (map[t]) continue;
      while (i < AZ_SERIES.length && used.has(AZ_SERIES[i % AZ_SERIES.length])) i++;
      const c = AZ_SERIES[i % AZ_SERIES.length];
      map[t] = c;
      used.add(c);
      i++;
    }
    return map;
  }, [selected, tickerToAsset]);

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

  const firstPlottedDate = chartData[0]?.date ?? null;
  const lastPlottedDate = chartData[chartData.length - 1]?.date ?? null;
  // Janela visível em dias — controla o formato adaptativo dos ticks de data.
  const spanDays =
    typeof firstPlottedDate === "string" && typeof lastPlottedDate === "string"
      ? Math.max(1, diffDaysUTC(firstPlottedDate, lastPlottedDate))
      : 1;
  const showBrush = spanDays > 366;

  const fmtValue = (v: number): string => {
    if (scale === "rebase") return fmtNum(v, 2);
    if (scale === "pct") return fmtSignedPct(v, 2);
    return fmtNum(v, Math.abs(v) < 10 ? 4 : 2);
  };

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
        <AzPeriodSelector
          value={period}
          onChange={setPeriod}
          min={seriesRange?.min}
          max={seriesRange?.max}
        />
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
                scale={scale === "log" ? "log" : "auto"}
                tickFormatter={(v: number) => {
                  if (scale === "rebase") return fmtNum(v, 0);
                  if (scale === "pct") return `${fmtNum(v, 0)}%`;
                  return fmtNum(v, 2);
                }}
                width={56}
              />
              <Tooltip
                content={
                  <AzTooltip
                    labelFmt={(l) => fmtDataBR(String(l ?? ""))}
                    valueFmt={(v) => fmtValue(v)}
                  />
                }
                cursor={AZ_TOOLTIP_PROPS.cursor}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {selected.map((t) => (
                <Line
                  key={t}
                  type="monotone"
                  dataKey={t}
                  name={tickerToAsset[t]?.name ?? t}
                  stroke={colorByTicker[t]}
                  strokeWidth={1.8}
                  dot={false}
                  isAnimationActive={false}
                  connectNulls
                />
              ))}
              {showBrush ? (
                <Brush
                  dataKey="date"
                  height={26}
                  stroke={AZ_BRAND.azure}
                  fill="#eef2f8"
                  travellerWidth={8}
                  tickFormatter={(d) => formatAxisDate(String(d), spanDays)}
                />
              ) : null}
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
