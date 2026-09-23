"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { AzTooltip, azGridProps, azXAxisProps, azYAxisProps } from "@/components/painel/core";
import { AZ_BRAND, AZ_CHART, AZ_TOOLTIP_PROPS } from "@/lib/az-chart-theme";
import { fmtMesCurto, fmtNum } from "@/lib/format-br";
import { isoMes } from "./cockpit-shared";

/**
 * Barras empilhadas por sinal (stackOffset="sign") + linha navy do total — o
 * gráfico canônico de decomposição do BP. Versão do cockpit do
 * v2/Stacked12mChart que aceita `mes` em "YYYY-MM-01" (o mesIso de Atividade
 * anexa "-01" e quebraria o eixo) e linhas extras sólidas ou tracejadas.
 * Altura FIXA (Recharts some com altura derivada de min-height).
 */
export type StackDef = { key: string; label: string; color: string };
export type LinhaDef = { key: string; label: string; color: string; dashed?: boolean };

export function StackedBpChart<T extends { mes: string }>({
  rows,
  stacks,
  totalKey,
  totalLabel = "Total",
  linhas = [],
  height = 300,
  valueFmt,
  yTickFmt = (v: number) => fmtNum(v, 0),
  refY,
}: {
  rows: T[];
  stacks: StackDef[];
  totalKey?: string;
  totalLabel?: string;
  linhas?: LinhaDef[];
  height?: number;
  valueFmt: (v: number, name: string) => string;
  yTickFmt?: (v: number) => string;
  refY?: { y: number; label: string; color?: string }[];
}) {
  if (rows.length === 0) {
    return <p className="flex h-64 items-center justify-center text-sm text-zinc-400">Sem dados na janela.</p>;
  }
  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={rows} stackOffset="sign" margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
          <CartesianGrid {...azGridProps()} />
          <XAxis {...azXAxisProps()} dataKey="mes" tickFormatter={(m: string) => fmtMesCurto(isoMes(m))} minTickGap={28} />
          <YAxis {...azYAxisProps()} width={48} tickFormatter={yTickFmt} />
          <ReferenceLine y={0} stroke={AZ_CHART.zero} strokeOpacity={AZ_CHART.zeroOpacity} strokeWidth={1.5} />
          {refY?.map((r) => (
            <ReferenceLine
              key={r.label}
              y={r.y}
              stroke={r.color ?? AZ_CHART.neg}
              strokeDasharray="4 4"
              label={{ value: r.label, position: "insideBottomLeft", fontSize: 9, fill: AZ_CHART.ticks }}
            />
          ))}
          <Tooltip
            content={<AzTooltip labelFmt={(l) => fmtMesCurto(isoMes(String(l)))} valueFmt={valueFmt} />}
            cursor={AZ_TOOLTIP_PROPS.cursor}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {stacks.map((s) => (
            <Bar key={s.key} dataKey={s.key} name={s.label} stackId="bp" fill={s.color} isAnimationActive={false} maxBarSize={26} />
          ))}
          {linhas.map((l) => (
            <Line
              key={l.key}
              type="monotone"
              dataKey={l.key}
              name={l.label}
              stroke={l.color}
              strokeWidth={1.75}
              strokeDasharray={l.dashed ? "5 3" : undefined}
              dot={false}
              connectNulls
              isAnimationActive={false}
            />
          ))}
          {totalKey ? (
            <Line
              type="monotone"
              dataKey={totalKey}
              name={totalLabel}
              stroke={AZ_BRAND.navy}
              strokeWidth={2}
              dot={false}
              connectNulls
              isAnimationActive={false}
            />
          ) : null}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
