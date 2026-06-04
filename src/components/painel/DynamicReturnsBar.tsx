"use client";

import { useMemo, useState } from "react";
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { CurrencyToggle } from "./CurrencyToggle";
import DataStamp from "./DataStamp";
import { PeriodSelector } from "./PeriodSelector";

export type Row = Record<string, unknown>;

export type ByPeriodBlock = Record<string, { data?: Row[] }>;

type Props = {
  title: string;
  byPeriod: ByPeriodBlock;
  nameKey?: string;
  currencyToggle?: boolean;
  positiveColor?: string;
  negativeColor?: string;
  updatedAt?: string;
  getValue: (row: Row, opts?: { currency: "brl" | "usd" }) => number | null;
  filterRow?: (row: Row) => boolean;
};

export function DynamicReturnsBar({
  title,
  byPeriod,
  nameKey = "name",
  currencyToggle = false,
  positiveColor = "#2ECC71",
  negativeColor = "#E74C3C",
  updatedAt,
  getValue,
  filterRow,
}: Props) {
  const [period, setPeriod] = useState("1mo");
  const [currency, setCurrency] = useState<"brl" | "usd">("brl");

  const chartData = useMemo(() => {
    const slice = byPeriod[period];
    const raw = slice?.data ?? [];
    const rows = filterRow ? raw.filter(filterRow) : raw;
    const out: { name: string; value: number }[] = [];
    for (const row of rows) {
      const name = String(row[nameKey] ?? "");
      const v = getValue(row, currencyToggle ? { currency } : undefined);
      if (v == null || Number.isNaN(Number(v))) continue;
      out.push({ name, value: Number(v) });
    }
    return out.sort((a, b) => b.value - a.value);
  }, [byPeriod, period, currency, currencyToggle, nameKey, getValue, filterRow]);

  return (
    <div className="w-full min-w-0 rounded-2xl bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-[#027DFC]">{title}</h2>
        <div className="flex flex-wrap items-center gap-2">
          {currencyToggle ? <CurrencyToggle value={currency} onChange={setCurrency} /> : null}
          <PeriodSelector value={period} onChange={setPeriod} />
        </div>
      </div>
      <div className="h-[min(420px,50vh)] w-full min-h-[280px]">
        {chartData.length === 0 ? (
          <p className="py-8 text-center text-sm text-zinc-500">Sem dados para este periodo.</p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ left: 4, right: 12, top: 8, bottom: 8 }}
            >
              <XAxis
                type="number"
                tick={{ fontSize: 11 }}
                tickFormatter={(v) => `${v}%`}
                domain={["auto", "auto"]}
              />
              <YAxis type="category" dataKey="name" width={118} tick={{ fontSize: 10 }} interval={0} />
              <Tooltip
                formatter={(value) => {
                  const v = typeof value === "number" ? value : Number(value);
                  const t = Number.isFinite(v) ? v.toFixed(2) : "—";
                  return [`${t}%`, "Retorno"];
                }}
              />
              <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={22}>
                {chartData.map((e) => (
                  <Cell key={e.name} fill={e.value >= 0 ? positiveColor : negativeColor} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
      {updatedAt ? (
        <p className="mt-2 text-right">
          {/* Fonte intradiária (cron 15min): generated_at carrega os minutos do dado. */}
          <DataStamp giro={updatedAt} dado={updatedAt} />
        </p>
      ) : null}
    </div>
  );
}
