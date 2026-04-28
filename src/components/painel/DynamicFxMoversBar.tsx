"use client";

import { useMemo, useState } from "react";
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type MoverRow = { ticker: string; change_pct: number };

type FxTop = {
  day?: { up?: MoverRow[] };
  week?: { up?: MoverRow[] };
  month?: { up?: MoverRow[] };
  quarter?: { up?: MoverRow[] };
  year?: { up?: MoverRow[] };
};

export type FxMoversPayload = {
  top?: FxTop;
};

const FX_PERIODS = [
  { id: "day", label: "1D" },
  { id: "week", label: "1S" },
  { id: "month", label: "1M" },
  { id: "quarter", label: "3M" },
  { id: "year", label: "1A" },
] as const;

type FxPeriod = (typeof FX_PERIODS)[number]["id"];

type Props = {
  title: string;
  data: FxMoversPayload | null;
};

export function DynamicFxMoversBar({ title, data }: Props) {
  const [period, setPeriod] = useState<FxPeriod>("month");

  const chartData = useMemo(() => {
    const up = data?.top?.[period]?.up ?? [];
    return [...up]
      .map((r) => ({ name: r.ticker, value: r.change_pct }))
      .sort((a, b) => b.value - a.value);
  }, [data, period]);

  return (
    <div className="rounded-2xl border border-[#132960]/15 bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-[#027DFC]">{title}</h2>
        <div className="flex flex-wrap gap-1">
          {FX_PERIODS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPeriod(p.id)}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
                period === p.id
                  ? "bg-[#027DFC] text-white"
                  : "border border-[#132960]/20 bg-white text-[#132960] hover:bg-zinc-50"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
      <div className="h-[min(420px,50vh)] w-full min-h-[280px]">
        {chartData.length === 0 ? (
          <p className="py-8 text-center text-sm text-zinc-500">Sem dados de FX.</p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ left: 4, right: 12, top: 8, bottom: 8 }}
            >
              <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
              <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 10 }} interval={0} />
              <Tooltip
                formatter={(value) => {
                  const v = typeof value === "number" ? value : Number(value);
                  const t = Number.isFinite(v) ? v.toFixed(2) : "—";
                  return [`${t}%`, "Var."];
                }}
              />
              <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={22}>
                {chartData.map((e) => (
                  <Cell key={e.name} fill={e.value >= 0 ? "#2ECC71" : "#E74C3C"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
