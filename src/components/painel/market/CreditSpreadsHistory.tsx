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

type ClassKey = "DI" | "IPCA";
type Period = "1m" | "3m" | "6m" | "max";

const PERIODS: Array<{ id: Period; label: string }> = [
  { id: "1m", label: "1M" },
  { id: "3m", label: "3M" },
  { id: "6m", label: "6M" },
  { id: "max", label: "Max" },
];

function periodCutoff(period: Period, latest: string): string {
  const d = new Date(latest + "T00:00:00Z");
  switch (period) {
    case "1m": d.setMonth(d.getMonth() - 1); break;
    case "3m": d.setMonth(d.getMonth() - 3); break;
    case "6m": d.setMonth(d.getMonth() - 6); break;
    case "max": return "1900-01-01";
  }
  return d.toISOString().slice(0, 10);
}

function shortDate(d: string): string {
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y.slice(2)}`;
}

function buildChartData(c: CreditClass, cutoff: string) {
  // Index por data
  const byDate: Record<string, { median?: number; p25?: number; p75?: number; n?: number }> = {};
  for (const [d, v] of c.series.median) if (d >= cutoff) (byDate[d] ??= {}).median = v;
  for (const [d, v] of c.series.p25) if (d >= cutoff) (byDate[d] ??= {}).p25 = v;
  for (const [d, v] of c.series.p75) if (d >= cutoff) (byDate[d] ??= {}).p75 = v;
  for (const [d, v] of c.series.n) if (d >= cutoff) (byDate[d] ??= {}).n = v;
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
  const [period, setPeriod] = useState<Period>("3m");

  const c = data?.classes[klass];
  const cutoff = data?.last_data_date ? periodCutoff(period, data.last_data_date) : "1900-01-01";
  const chartData = useMemo(() => (c ? buildChartData(c, cutoff) : []), [c, cutoff]);

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

  const updatedTxt = data.generated_at
    ? `Atualizado em ${new Date(data.generated_at).toLocaleString("pt-BR")} · Fonte: ${data.source}`
    : "";

  const yLabel = klass === "DI" ? "Spread sobre CDI" : "Taxa real (IPCA+)";

  return (
    <MarketCard
      title="Spreads de crédito privado"
      subtitle="Mediana e quartis da taxa indicativa de debêntures, por indexador."
      badge={`ANBIMA · ${data.last_data_date}`}
      bodyClassName="px-4 pb-4 pt-2"
      footer={updatedTxt}
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

        <div className="grid gap-3 lg:grid-cols-[1fr_220px]">
          <div className="h-[380px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 10, right: 16, bottom: 10, left: 0 }}>
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
                    if (!Number.isFinite(v)) return ["—", String(name)];
                    if (name === "median") return [`${v.toFixed(2)}%`, "Mediana"];
                    if (name === "p25") return [`${v.toFixed(2)}%`, "P25"];
                    if (name === "p75") return [`${v.toFixed(2)}%`, "P75"];
                    return [`${v.toFixed(2)}`, String(name)];
                  }}
                  contentStyle={{
                    borderRadius: 8,
                    border: "1px solid #132960",
                    fontSize: 12,
                    padding: "6px 10px",
                  }}
                />
                {/* Banda P25-P75 (area) */}
                <Area
                  type="monotone"
                  dataKey="band"
                  stroke="none"
                  fill="#027DFC"
                  fillOpacity={0.15}
                  isAnimationActive={false}
                />
                {/* Linha da mediana */}
                <Line
                  type="monotone"
                  dataKey="median"
                  stroke="#027DFC"
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
                {/* Linhas finas p25 e p75 */}
                <Line
                  type="monotone"
                  dataKey="p25"
                  stroke="#16A34A"
                  strokeWidth={1}
                  strokeDasharray="3 3"
                  dot={false}
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="p75"
                  stroke="#DC2626"
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
                <dt className="text-zinc-500">Papéis no último dia</dt>
                <dd className="tabular-nums text-zinc-700">{latestN ?? "—"}</dd>
              </div>
            </dl>
            <p className="mt-3 border-t border-zinc-200 pt-2 text-[10px] italic text-zinc-500">
              Mediana (linha sólida), banda sombreada = P25–P75 (50% central das taxas).
            </p>
          </div>
        </div>

        <p className="text-xs italic text-zinc-500">
          Para classe <strong>DI/CDI</strong>, a taxa indicativa publicada pela ANBIMA já é o spread
          sobre o CDI. Para <strong>IPCA+</strong>, é a taxa real (cupom acima do IPCA). Mediana e
          quartis são calculados sobre todos os papéis ativos em cada dia.
        </p>
      </div>
    </MarketCard>
  );
}
