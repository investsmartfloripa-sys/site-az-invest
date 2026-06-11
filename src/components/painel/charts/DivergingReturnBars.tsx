"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { AzTooltip } from "@/components/painel/core/AzTooltip";
import { azGridProps, azXAxisProps, azZeroLineProps } from "@/components/painel/core/azChartDefaults";
import { AZ_CHART, AZ_TOOLTIP_PROPS, variationFill } from "@/lib/az-chart-theme";
import { fmtSignedPct } from "@/lib/format-br";

/**
 * Barras horizontais DIVERGENTES padrão AZ (PADRAO-VISUAL-GRAFICOS.md §4):
 * grade vertical estilo ggplot2, linha do zero navy a 55%, barras 16px com
 * radius [0,3,3,0], valor com SINAL na ponta (10.5px #475569 tabular-nums) e
 * verde/azul/vermelho pela direção (variationFill). Altura derivada do nº de
 * linhas — lista curta não estica.
 *
 * Reutilizado por commodities (grupos por setor) e câmbio (top movers).
 */

export type DivergingBarRow = {
  /** Nome exibido (truncado a ~18 chars aqui — o SVG não quebra linha). */
  label: string;
  /** Variação % do período. */
  value: number;
};

export type DivergingReturnBarsProps = {
  rows: DivergingBarRow[];
  /**
   * Domain X explícito [min, max] — fixe o MESMO entre gráficos irmãos
   * (grupos de setor) p/ barras comparáveis. Default: auto.
   */
  xDomain?: [number, number];
  /** Largura do eixo Y de categorias — fixe entre gráficos irmãos. Default 128. */
  yAxisWidth?: number;
  /** Casas decimais do rótulo na ponta. Default 1. */
  labelDec?: number;
  className?: string;
};

function truncate(s: string, max = 18): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

export function DivergingReturnBars({
  rows,
  xDomain,
  yAxisWidth = 128,
  labelDec = 1,
  className = "",
}: DivergingReturnBarsProps) {
  if (rows.length === 0) {
    return <p className="py-6 text-center text-sm text-zinc-400">Sem dados para este período.</p>;
  }

  const data = rows.map((r) => ({ name: truncate(r.label), value: r.value }));
  const height = 28 * data.length + 56;

  return (
    <div className={`w-full ${className}`} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          barCategoryGap="35%"
          margin={{ left: 4, right: 48, top: 4, bottom: 4 }}
        >
          <CartesianGrid {...azGridProps("vertical-only")} />
          <XAxis
            {...azXAxisProps()}
            type="number"
            domain={xDomain ?? ["auto", "auto"]}
            tickFormatter={(v) => `${Number(v)}%`}
            tickCount={5}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={yAxisWidth}
            interval={0}
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: AZ_CHART.labels }}
          />
          <ReferenceLine {...azZeroLineProps("x")} />
          <Tooltip
            content={<AzTooltip hideDot valueFmt={(v) => fmtSignedPct(v, 2)} />}
            cursor={AZ_TOOLTIP_PROPS.cursor}
          />
          <Bar dataKey="value" radius={[0, 3, 3, 0]} maxBarSize={16} isAnimationActive={false}>
            {data.map((e, i) => (
              <Cell key={`${e.name}-${i}`} fill={variationFill(e.value)} />
            ))}
            <LabelList
              dataKey="value"
              position="right"
              formatter={(v) => {
                const n = typeof v === "number" ? v : Number(v);
                return Number.isFinite(n) ? fmtSignedPct(n, labelDec) : "";
              }}
              style={{ fontSize: 10.5, fill: "#475569", fontVariantNumeric: "tabular-nums" }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
