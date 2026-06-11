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

import type { TreasuryHistory, TreasuryCategory } from "@/lib/painel-renda-fixa-data";
import { MarketCard } from "@/components/painel/market/MarketCard";
import {
  AzPeriodSelector,
  resolvePeriodRange,
  type AzPeriodValue,
} from "@/components/painel/charts";
import { AzTooltip, azGridProps, azXAxisProps, azYAxisProps } from "@/components/painel/core";
import { AZ_TOOLTIP_PROPS, seriesColor } from "@/lib/az-chart-theme";
import { diffDaysUTC, fmtDataBR, fmtMesCurto, fmtNum, fmtPct, formatAxisDate } from "@/lib/format-br";

type CategoryKey = "PRE" | "IPCA";

function buildChartData(
  category: TreasuryCategory,
  selectedVencimentos: string[],
  from: string,
  to: string,
): Array<Record<string, number | string>> {
  if (selectedVencimentos.length === 0) return [];

  const dateSet = new Set<string>();
  for (const venc of selectedVencimentos) {
    const series = category.series[venc] ?? [];
    for (const [d] of series) {
      if (d >= from && d <= to) dateSet.add(d);
    }
  }
  const dates = Array.from(dateSet).sort();

  const indexed: Record<string, Record<string, number>> = {};
  for (const venc of selectedVencimentos) {
    const m: Record<string, number> = {};
    for (const [d, v] of (category.series[venc] ?? [])) m[d] = v;
    indexed[venc] = m;
  }

  return dates.map((d) => {
    const row: Record<string, number | string> = { date: d };
    for (const venc of selectedVencimentos) {
      const v = indexed[venc]?.[d];
      if (v !== undefined) row[venc] = v;
    }
    return row;
  });
}

type Props = {
  data: TreasuryHistory | null;
};

export function TreasuryTimeSeries({ data }: Props) {
  const [category, setCategory] = useState<CategoryKey>("PRE");
  const [period, setPeriod] = useState<AzPeriodValue>({ id: "3m" });
  const [selected, setSelected] = useState<Record<CategoryKey, string[]>>({
    PRE: [],
    IPCA: [],
  });

  const cat = data?.categories[category];

  // Default: pega 4 vencimentos espacados ENTRE OS AINDA VIVOS (data > last_data_date).
  // Pre/IPCA tem vencimentos antigos no historico (LTN 2010 etc.) que ja venceram —
  // useis pra ver series passadas, mas o default precisa mostrar a curva vigente.
  const defaultSelected = useMemo(() => {
    if (!cat) return [] as string[];
    const lastDate = data?.last_data_date ?? "9999-12-31";
    const alive = cat.vencimentos.filter((v) => v > lastDate);
    const pool = alive.length >= 4 ? alive : cat.vencimentos;
    if (pool.length <= 4) return pool;
    const idx = [0, Math.floor(pool.length / 3), Math.floor((pool.length * 2) / 3), pool.length - 1];
    return Array.from(new Set(idx.map((i) => pool[i])));
  }, [cat, data?.last_data_date]);

  const activeSelected = selected[category].length > 0 ? selected[category] : defaultSelected;

  // Observação mais antiga entre as séries da categoria (limita o "Personalizado").
  const seriesMin = useMemo(() => {
    if (!cat) return "1900-01-01";
    let min = "";
    for (const venc of cat.vencimentos) {
      const first = cat.series[venc]?.[0]?.[0];
      if (first && (!min || first < min)) min = first;
    }
    return min || "1900-01-01";
  }, [cat]);

  const seriesMax = data?.last_data_date ?? "9999-12-31";
  // Corte de período 100% UTC (resolvePeriodRange — nada de setMonth local).
  const range = resolvePeriodRange(period, seriesMin, seriesMax);

  const chartData = useMemo(() => {
    if (!cat) return [];
    return buildChartData(cat, activeSelected, range.from, range.to);
  }, [cat, activeSelected, range.from, range.to]);

  function toggleVencimento(venc: string) {
    setSelected((prev) => {
      const cur = prev[category].length > 0 ? prev[category] : defaultSelected;
      const has = cur.includes(venc);
      const next = has ? cur.filter((v) => v !== venc) : [...cur, venc];
      // Limita 6
      const limited = next.slice(-6);
      return { ...prev, [category]: limited };
    });
  }

  // Stats da serie principal (primeiro vencimento selecionado)
  const primaryVenc = activeSelected[0];
  const primarySeries = cat?.series[primaryVenc] ?? [];
  const inWindow = primarySeries.filter(([d]) => d >= range.from && d <= range.to);
  const values = inWindow.map(([, v]) => v);
  const currentVal = values.length > 0 ? values[values.length - 1] : null;
  const minVal = values.length > 0 ? Math.min(...values) : null;
  const maxVal = values.length > 0 ? Math.max(...values) : null;
  const medianVal =
    values.length > 0
      ? [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]
      : null;

  if (!data || !cat) {
    return (
      <MarketCard title="Curva histórica de juros — Títulos Públicos">
        <div className="py-10 text-center text-sm text-zinc-500">
          Dados ANBIMA ainda não publicados pelo pipeline diário.
        </div>
      </MarketCard>
    );
  }

  const firstPlotted = chartData[0]?.date;
  const lastPlotted = chartData[chartData.length - 1]?.date;
  // Janela visível em dias — controla o formato adaptativo dos ticks de data.
  const spanDays =
    typeof firstPlotted === "string" && typeof lastPlotted === "string"
      ? Math.max(1, diffDaysUTC(firstPlotted, lastPlotted))
      : 1;

  return (
    <MarketCard
      title="Curva histórica de juros"
      subtitle="Evolução da taxa indicativa de cada vencimento ao longo do tempo."
      badge={`ANBIMA · ${data.last_data_date}`}
      bodyClassName="px-4 pb-4 pt-2"
      footer={`Fonte: ${data.source}`}
      stampGiro={data.generated_at}
      stampDado={data.last_data_date}
      toolbar={
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setCategory("PRE")}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
              category === "PRE"
                ? "bg-[#027DFC] text-white"
                : "border border-[#132960]/20 bg-white text-[#132960] hover:border-[#027DFC]"
            }`}
          >
            Prefixado
          </button>
          <button
            type="button"
            onClick={() => setCategory("IPCA")}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
              category === "IPCA"
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
        {/* Periodos */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-zinc-500">Janela:</span>
          <AzPeriodSelector
            value={period}
            onChange={setPeriod}
            min={seriesMin}
            max={data.last_data_date}
          />
        </div>

        {/* Vencimentos disponiveis: separa vivos (em circulacao) de vencidos (historico) */}
        {(() => {
          const lastDate = data.last_data_date ?? "9999-12-31";
          const alive = cat.vencimentos.filter((v) => v > lastDate);
          const expired = cat.vencimentos.filter((v) => v <= lastDate);
          const renderChip = (venc: string, isExpired = false) => {
            const active = activeSelected.includes(venc);
            return (
              <button
                key={venc}
                type="button"
                onClick={() => toggleVencimento(venc)}
                className={`rounded-full px-2.5 py-1 text-xs font-semibold transition ${
                  active
                    ? "bg-[#027DFC] text-white"
                    : isExpired
                      ? "border border-zinc-200 bg-white text-zinc-500 hover:border-[#027DFC] hover:text-[#027DFC]"
                      : "border border-[#132960]/15 bg-zinc-50 text-[#132960] hover:border-[#027DFC]"
                }`}
                title={isExpired ? "Vencido — disponível para visualizar série histórica" : undefined}
              >
                {fmtMesCurto(venc)}
              </button>
            );
          };
          return (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-zinc-500">Em circulação:</span>
                {alive.map((v) => renderChip(v, false))}
              </div>
              {expired.length > 0 ? (
                <details className="group">
                  <summary className="cursor-pointer text-xs font-medium text-zinc-500 hover:text-[#027DFC]">
                    <span className="select-none">Vencidos ({expired.length}) — clique para mostrar séries históricas</span>
                  </summary>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {expired.map((v) => renderChip(v, true))}
                  </div>
                </details>
              ) : null}
              <p className="text-[11px] italic text-zinc-500">
                Máx 6 vencimentos simultâneos. Default: 4 espaçados entre os em circulação.
              </p>
            </div>
          );
        })()}

        <div className="grid gap-3 lg:grid-cols-[1fr_220px]">
          {/* Grafico principal */}
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
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {activeSelected.map((venc, i) => (
                  <Line
                    key={venc}
                    type="monotone"
                    dataKey={venc}
                    name={fmtMesCurto(venc)}
                    stroke={seriesColor(i)}
                    strokeWidth={1.8}
                    dot={false}
                    isAnimationActive={false}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Stats lateral */}
          <div className="rounded-xl border border-[#132960]/10 bg-zinc-50/50 p-3 text-sm">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              {category === "PRE" ? "Prefixado" : "IPCA+"} {fmtMesCurto(primaryVenc ?? "")}
            </p>
            <dl className="space-y-2">
              <div className="flex items-center justify-between">
                <dt className="text-zinc-600">Taxa atual</dt>
                <dd className="text-lg font-semibold tabular-nums text-[#132960]">
                  {currentVal != null ? `${currentVal.toFixed(2)}%` : "—"}
                </dd>
              </div>
              <div className="flex items-center justify-between border-t border-zinc-200 pt-2">
                <dt className="text-zinc-600">Mediana janela</dt>
                <dd className="font-semibold tabular-nums text-[#132960]">
                  {medianVal != null ? `${medianVal.toFixed(2)}%` : "—"}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-zinc-600">Mín na janela</dt>
                <dd className="tabular-nums text-[#16A34A]">
                  {minVal != null ? `${minVal.toFixed(2)}%` : "—"}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-zinc-600">Máx na janela</dt>
                <dd className="tabular-nums text-[#DC2626]">
                  {maxVal != null ? `${maxVal.toFixed(2)}%` : "—"}
                </dd>
              </div>
              <div className="flex items-center justify-between border-t border-zinc-200 pt-2 text-[11px]">
                <dt className="text-zinc-500">N observações</dt>
                <dd className="tabular-nums text-zinc-700">{values.length}</dd>
              </div>
            </dl>
          </div>
        </div>

        <p className="text-xs italic text-zinc-500">
          Cada linha mostra a evolução da <em>taxa indicativa</em> de um título com data de vencimento
          específica. Categoria Prefixado combina LTN e NTN-F (cupom). IPCA+ usa NTN-B.
        </p>
      </div>
    </MarketCard>
  );
}
