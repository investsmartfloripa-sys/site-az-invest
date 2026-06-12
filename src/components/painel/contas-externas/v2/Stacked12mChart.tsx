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
import { fmtUsBiSigned, mesIso } from "./shared";

/**
 * Gráfico-base dos blocos de DECOMPOSIÇÃO 12m de Contas Externas: barras
 * empilhadas por componente (stackOffset="sign" — positivos acima do zero,
 * negativos abaixo, a convenção dos gráficos de BP do BCB/research) + linha
 * navy do total. Mesmo padrão visual do AnchorContribuicoesPib (o modelo).
 *
 * RefLine 0 sempre; nunca eixo duplo. Os valores chegam em US$ bi (builder v2).
 */

export type StackSerie = {
  /** dataKey no registro mensal. */
  key: string;
  /** Nome na legenda/tooltip. */
  label: string;
  color: string;
};

export type LinhaExtra = {
  key: string;
  label: string;
  color: string;
};

export function Stacked12mChart<T extends { mes: string }>({
  rows,
  stacks,
  totalKey,
  totalLabel = "Total (12m)",
  linhasExtras = [],
  height = 340,
  valueFmt = (v: number) => fmtUsBiSigned(v, 1),
}: {
  rows: T[];
  stacks: StackSerie[];
  /** Chave da linha do total (navy). Omita p/ só empilhar. */
  totalKey?: string;
  totalLabel?: string;
  /** Linhas tracejadas de comparação no MESMO eixo (ex.: saldo de bens como memo). */
  linhasExtras?: LinhaExtra[];
  height?: number;
  valueFmt?: (v: number, name: string) => string;
}) {
  if (rows.length === 0) {
    return (
      <p className="flex h-72 items-center justify-center text-sm text-zinc-400">
        Sem dados para o período selecionado.
      </p>
    );
  }
  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={rows} stackOffset="sign" margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
          <CartesianGrid {...azGridProps()} />
          <XAxis
            {...azXAxisProps()}
            dataKey="mes"
            tickFormatter={(m: string) => fmtMesCurto(mesIso(m))}
            minTickGap={28}
          />
          <YAxis {...azYAxisProps()} width={48} tickFormatter={(v: number) => fmtNum(v, 0)} />

          <ReferenceLine y={0} stroke={AZ_CHART.zero} strokeOpacity={AZ_CHART.zeroOpacity} strokeWidth={1.5} />

          <Tooltip
            content={<AzTooltip labelFmt={(l) => fmtMesCurto(mesIso(String(l)))} valueFmt={valueFmt} />}
            cursor={AZ_TOOLTIP_PROPS.cursor}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />

          {stacks.map((s) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              name={s.label}
              stackId="bp12m"
              fill={s.color}
              isAnimationActive={false}
              maxBarSize={26}
            />
          ))}

          {linhasExtras.map((l) => (
            <Line
              key={l.key}
              type="monotone"
              dataKey={l.key}
              name={l.label}
              stroke={l.color}
              strokeWidth={1.5}
              strokeDasharray="5 3"
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
