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

type CategoryKey = "PRE" | "IPCA";
type Period = "1m" | "3m" | "6m" | "1y" | "3y" | "5y" | "max";

const PERIODS: Array<{ id: Period; label: string }> = [
  { id: "1m", label: "1M" },
  { id: "3m", label: "3M" },
  { id: "6m", label: "6M" },
  { id: "1y", label: "1A" },
  { id: "3y", label: "3A" },
  { id: "5y", label: "5A" },
  { id: "max", label: "Max" },
];

// Paleta gradiente (mais escuro = mais longo)
const VENCIMENTO_COLORS = [
  "#56B4E9", // azul claro
  "#1F77B4",
  "#027DFC",
  "#0066CC",
  "#003F88",
  "#00008B", // azul escuro
  "#000033",
];

function periodCutoff(period: Period, latest: string): string {
  const d = new Date(latest + "T00:00:00Z");
  switch (period) {
    case "1m": d.setMonth(d.getMonth() - 1); break;
    case "3m": d.setMonth(d.getMonth() - 3); break;
    case "6m": d.setMonth(d.getMonth() - 6); break;
    case "1y": d.setFullYear(d.getFullYear() - 1); break;
    case "3y": d.setFullYear(d.getFullYear() - 3); break;
    case "5y": d.setFullYear(d.getFullYear() - 5); break;
    case "max": return "1900-01-01";
  }
  return d.toISOString().slice(0, 10);
}

function shortDate(d: string): string {
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y.slice(2)}`;
}

function vencimentoLabel(d: string): string {
  // "2030-01-01" -> "jan/30"
  const [y, m] = d.split("-");
  const months = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
  return `${months[parseInt(m,10)-1]}/${y.slice(2)}`;
}

function buildChartData(
  category: TreasuryCategory,
  selectedVencimentos: string[],
  cutoff: string,
): Array<Record<string, number | string>> {
  if (selectedVencimentos.length === 0) return [];

  const dateSet = new Set<string>();
  for (const venc of selectedVencimentos) {
    const series = category.series[venc] ?? [];
    for (const [d] of series) {
      if (d >= cutoff) dateSet.add(d);
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
  const [period, setPeriod] = useState<Period>("3m");
  const [selected, setSelected] = useState<Record<CategoryKey, string[]>>({
    PRE: [],
    IPCA: [],
  });

  const cat = data?.categories[category];

  // Default: pega 4 vencimentos espacados se nenhum estiver selecionado
  const defaultSelected = useMemo(() => {
    if (!cat) return [] as string[];
    const v = cat.vencimentos;
    if (v.length <= 4) return v;
    const idx = [0, Math.floor(v.length / 3), Math.floor((v.length * 2) / 3), v.length - 1];
    return Array.from(new Set(idx.map((i) => v[i])));
  }, [cat]);

  const activeSelected = selected[category].length > 0 ? selected[category] : defaultSelected;

  const cutoff = data?.last_data_date ? periodCutoff(period, data.last_data_date) : "1900-01-01";
  const chartData = useMemo(() => {
    if (!cat) return [];
    return buildChartData(cat, activeSelected, cutoff);
  }, [cat, activeSelected, cutoff]);

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
  const inWindow = primarySeries.filter(([d]) => d >= cutoff);
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

  const updatedTxt = data.generated_at
    ? `Atualizado em ${new Date(data.generated_at).toLocaleString("pt-BR")} · Fonte: ${data.source}`
    : "";

  return (
    <MarketCard
      title="Curva histórica de juros"
      subtitle="Evolução da taxa indicativa de cada vencimento ao longo do tempo."
      badge={`ANBIMA · ${data.last_data_date}`}
      bodyClassName="px-4 pb-4 pt-2"
      footer={updatedTxt}
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
          {PERIODS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPeriod(p.id)}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                period === p.id
                  ? "bg-[#132960] text-white"
                  : "border border-[#132960]/20 bg-white text-[#132960] hover:border-[#027DFC] hover:text-[#027DFC]"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Vencimentos disponiveis */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-zinc-500">Vencimento:</span>
          {cat.vencimentos.map((venc) => {
            const active = activeSelected.includes(venc);
            return (
              <button
                key={venc}
                type="button"
                onClick={() => toggleVencimento(venc)}
                className={`rounded-full px-2.5 py-1 text-xs font-semibold transition ${
                  active
                    ? "bg-[#027DFC] text-white"
                    : "border border-[#132960]/15 bg-zinc-50 text-[#132960] hover:border-[#027DFC]"
                }`}
              >
                {vencimentoLabel(venc)}
              </button>
            );
          })}
          <span className="text-[11px] italic text-zinc-500">
            Máx 6 simultâneos. Default: 4 espaçados.
          </span>
        </div>

        <div className="grid gap-3 lg:grid-cols-[1fr_220px]">
          {/* Grafico principal */}
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
                  domain={["auto", "auto"]}
                  tickFormatter={(v: number) => `${v.toFixed(1)}%`}
                  width={56}
                />
                <Tooltip
                  labelFormatter={(label) => shortDate(String(label ?? ""))}
                  formatter={(value, name) => {
                    const v = typeof value === "number" ? value : Number(value);
                    const venc = String(name ?? "");
                    if (!Number.isFinite(v)) return ["—", vencimentoLabel(venc)];
                    return [`${v.toFixed(2)}%`, vencimentoLabel(venc)];
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
                  formatter={(value: string) => vencimentoLabel(value)}
                />
                {activeSelected.map((venc, i) => (
                  <Line
                    key={venc}
                    type="monotone"
                    dataKey={venc}
                    stroke={VENCIMENTO_COLORS[i % VENCIMENTO_COLORS.length]}
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
              {category === "PRE" ? "Prefixado" : "IPCA+"} {vencimentoLabel(primaryVenc ?? "")}
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
