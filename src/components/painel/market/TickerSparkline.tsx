"use client";

import { useMemo } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, YAxis } from "recharts";

type Props = {
  series: Array<[string, number]>;
  positive?: boolean;
  height?: number;
};

export function TickerSparkline({ series, positive = true, height = 60 }: Props) {
  const data = useMemo(
    () => series.map(([d, v]) => ({ date: d, value: v })),
    [series],
  );

  const stroke = positive ? "#16A34A" : "#DC2626";
  const fill = positive ? "rgba(22,163,74,0.18)" : "rgba(220,38,38,0.18)";

  if (data.length < 2) {
    return <div className="text-xs italic text-zinc-400">sem série</div>;
  }

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={`sparkfill-${positive ? "p" : "n"}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity={0.35} />
              <stop offset="100%" stopColor={stroke} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <YAxis hide domain={["auto", "auto"]} />
          <Tooltip
            contentStyle={{ fontSize: 11, padding: "4px 8px", borderRadius: 6 }}
            labelFormatter={(d) => d}
            formatter={(v) => {
              const num = typeof v === "number" ? v : Number(v);
              return Number.isFinite(num) ? num.toFixed(2) : "—";
            }}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke={stroke}
            strokeWidth={1.5}
            fill={`url(#sparkfill-${positive ? "p" : "n"})`}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
