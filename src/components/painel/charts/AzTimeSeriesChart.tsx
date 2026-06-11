"use client";

import { useMemo } from "react";
import {
  Brush,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { AzTooltip } from "@/components/painel/core/AzTooltip";
import { azGridProps, azXAxisProps, azYAxisProps, azZeroLineProps } from "@/components/painel/core/azChartDefaults";
import { AZ_BRAND, AZ_CHART, AZ_TOOLTIP_PROPS, benchmarkColor, seriesColor } from "@/lib/az-chart-theme";
import {
  diffDaysUTC,
  fmtBRL,
  fmtDataBR,
  fmtNum,
  fmtPct,
  fmtSignedPct,
  formatAxisDate,
  isoFromUTC,
} from "@/lib/format-br";
import { resolvePeriodRange, type AzPeriodValue } from "./AzPeriodSelector";

/**
 * O componente BASE de série temporal do site — embute todo o
 * PADRAO-VISUAL-GRAFICOS.md: grade sólida, eixos limpos, tooltip navy,
 * domain Y manual com 8% de folga (o Recharts clipa sem isso), ticks de
 * data adaptativos (dd/mm → mmm/aa → aaaa) e cores AZ_SERIES respeitando
 * BENCHMARK_COLORS quando o rótulo casa.
 *
 * Integra com AzPeriodSelector via a prop `period` (controlada pelo pai).
 */

/** Ponto da série: tupla [ISO "YYYY-MM-DD", valor]. */
export type AzSeriesPoint = readonly [dateIso: string, value: number];

/** Uma série plotável. `color` opcional — default: BENCHMARK_COLORS pelo label, senão AZ_SERIES pela ordem. */
export type AzTimeSeries = {
  /** Chave estável e única no chart (vira dataKey). */
  id: string;
  /** Nome exibido na legenda/tooltip (ex.: "IBOV", "CDI"). */
  label: string;
  color?: string;
  data: ReadonlyArray<AzSeriesPoint>;
};

/** Unidade dos VALORES BRUTOS — controla formatação de eixo e tooltip no modo "raw". */
export type AzUnit = "%" | "R$" | "pts" | "index" | "none";

/**
 * Transformação aplicada à janela visível:
 * - "raw": valores como vieram;
 * - "rebase100": todas as séries = 100 no 1º ponto da janela (comparação de trajetória);
 * - "pct_acum": variação % acumulada desde o 1º ponto da janela (sempre com sinal).
 */
export type AzSeriesMode = "raw" | "rebase100" | "pct_acum";

/** Linha de referência horizontal (meta, teto de banda...). */
export type AzRefLine = {
  y: number;
  label?: string;
  color?: string;
  /** default true (tracejada "4 4"). */
  dashed?: boolean;
};

/** Faixa de referência horizontal (banda da meta, intervalo de tolerância). */
export type AzRefArea = {
  y1: number;
  y2: number;
  label?: string;
  color?: string;
  /** Opacidade do preenchimento — default 0.06. */
  opacity?: number;
};

export type AzTimeSeriesChartProps = {
  /** Séries principais (linha cheia, strokeWidth 2). */
  series: AzTimeSeries[];
  /** Unidade dos valores brutos (ignorada nos modos rebase100/pct_acum). Default "none". */
  unit?: AzUnit;
  /** Default "raw". */
  mode?: AzSeriesMode;
  /** Janela visível — conecte ao AzPeriodSelector. Default {id:"max"}. */
  period?: AzPeriodValue;
  /** Altura do chart em px. Default 320. */
  height?: number;
  /** Mini-brush de navegação no rodapé (séries longas). Default false. */
  showBrush?: boolean;
  /**
   * Séries de comparação (linha tracejada fina). Cor fixa de
   * BENCHMARK_COLORS quando o label casa (CDI, IBOV, S&P 500...).
   */
  benchmarks?: AzTimeSeries[];
  /** Linhas de referência (ex.: meta de inflação). */
  refLines?: AzRefLine[];
  /** Faixas de referência (ex.: banda da meta). */
  refAreas?: AzRefArea[];
  /** Reservado: empilhamento NÃO suportado neste componente (use gráfico de área dedicado). */
  stacked?: false;
  /** Dots nos vértices: true (r=2.5) ou raio custom. Default false (séries diárias densas). */
  dots?: boolean | number;
  /**
   * Forward-fill: datas em que uma série não tem observação herdam o último
   * valor conhecido (último close). Útil p/ comparar calendários distintos
   * (B3 × NYSE × cripto); deixe false p/ dados macro mensais. Default false.
   */
  forwardFill?: boolean;
  /** Título do eixo Y (ex.: "Taxa (% a.a.)") — renderizado a -90°. */
  yAxisLabel?: string;
  className?: string;
};

type ChartRow = { t: number } & Record<string, number>;

function resolveColor(s: AzTimeSeries, index: number, isBenchmark: boolean): string {
  if (s.color) return s.color;
  const bench = benchmarkColor(s.label);
  if (bench) return bench;
  return isBenchmark ? AZ_CHART.ticks : seriesColor(index);
}

function buildValueFmt(mode: AzSeriesMode, unit: AzUnit): (v: number) => string {
  if (mode === "pct_acum") return (v) => fmtSignedPct(v, 2);
  if (mode === "rebase100") return (v) => fmtNum(v, 1);
  switch (unit) {
    case "%":
      return (v) => fmtPct(v, 2);
    case "R$":
      return (v) => fmtBRL(v);
    case "pts":
      return (v) => `${fmtNum(v, 0)} pts`;
    case "index":
      return (v) => fmtNum(v, 1);
    default:
      return (v) => fmtNum(v);
  }
}

function buildAxisFmt(mode: AzSeriesMode, unit: AzUnit): (v: number) => string {
  if (mode === "pct_acum") return (v) => `${fmtNum(v, 0)}%`;
  if (mode === "rebase100") return (v) => fmtNum(v, 0);
  switch (unit) {
    case "%":
      return (v) => `${fmtNum(v, 1)}%`;
    case "R$":
      return (v) => fmtNum(v, v >= 100 ? 0 : 2);
    default:
      return (v) => fmtNum(v);
  }
}

type BuiltChart = {
  rows: ChartRow[];
  yDomain: [number, number];
  spanDays: number;
  hasNegative: boolean;
};

function buildChart(
  all: { s: AzTimeSeries }[],
  period: AzPeriodValue,
  mode: AzSeriesMode,
  forwardFill: boolean,
): BuiltChart | null {
  // Range disponível (união de todas as séries).
  let minIso = "";
  let maxIso = "";
  for (const { s } of all) {
    for (const [d] of s.data) {
      if (!minIso || d < minIso) minIso = d;
      if (!maxIso || d > maxIso) maxIso = d;
    }
  }
  if (!minIso || !maxIso) return null;

  const { from, to } = resolvePeriodRange(period, minIso, maxIso);

  const byT = new Map<number, ChartRow>();
  let lo = Infinity;
  let hi = -Infinity;

  for (const { s } of all) {
    // Janela ordenada por data (não confia na ordenação do payload).
    const windowed = s.data
      .filter(([d, v]) => d >= from && d <= to && Number.isFinite(v))
      .slice()
      .sort((a, b) => (a[0] < b[0] ? -1 : 1));
    if (windowed.length === 0) continue;
    const base = windowed[0][1];

    for (const [d, raw] of windowed) {
      let v = raw;
      if (mode === "rebase100") {
        if (!(base > 0)) continue;
        v = (100 * raw) / base;
      } else if (mode === "pct_acum") {
        if (!(base > 0)) continue;
        v = 100 * (raw / base - 1);
      }
      const t = Date.parse(`${d}T00:00:00Z`);
      if (!Number.isFinite(t)) continue;
      let row = byT.get(t);
      if (!row) {
        row = { t } as ChartRow;
        byT.set(t, row);
      }
      row[s.id] = +v.toFixed(6);
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
  }

  const rows = [...byT.values()].sort((a, b) => a.t - b.t);
  if (rows.length === 0 || !Number.isFinite(lo) || !Number.isFinite(hi)) return null;

  if (forwardFill) {
    const lastSeen: Record<string, number> = {};
    for (const row of rows) {
      for (const { s } of all) {
        const v = row[s.id];
        if (v !== undefined) {
          lastSeen[s.id] = v;
        } else if (lastSeen[s.id] !== undefined) {
          row[s.id] = lastSeen[s.id];
        }
      }
    }
  }

  // Domain Y MANUAL com 8% de folga — sem isso o Recharts clipa as linhas
  // quando séries têm vértices fora dos ticks "auto".
  const span = hi - lo;
  const pad = span > 0 ? span * 0.08 : Math.max(Math.abs(hi) * 0.08, 1);
  const yDomain: [number, number] = [lo - pad, hi + pad];

  const firstIso = isoFromUTC(rows[0].t);
  const lastIso = isoFromUTC(rows[rows.length - 1].t);
  const spanDays = Math.max(1, diffDaysUTC(firstIso, lastIso));

  return { rows, yDomain, spanDays, hasNegative: lo < 0 && hi > 0 };
}

/**
 * Série temporal padrão AZ. Exemplo:
 *
 * ```tsx
 * const [period, setPeriod] = useState<AzPeriodValue>({ id: "1y" });
 * <AzPeriodSelector value={period} onChange={setPeriod} min="2015-01-02" max="2026-06-10" />
 * <AzTimeSeriesChart
 *   series={[{ id: "ibov", label: "IBOV", data: ibov }]}
 *   benchmarks={[{ id: "cdi", label: "CDI", data: cdi }]}
 *   mode="rebase100"
 *   period={period}
 * />
 * ```
 */
export function AzTimeSeriesChart({
  series,
  unit = "none",
  mode = "raw",
  period,
  height = 320,
  showBrush = false,
  benchmarks = [],
  refLines = [],
  refAreas = [],
  dots = false,
  forwardFill = false,
  yAxisLabel,
  className = "",
}: AzTimeSeriesChartProps) {
  const all = useMemo(
    () => [
      ...series.map((s) => ({ s, isBenchmark: false })),
      ...benchmarks.map((s) => ({ s, isBenchmark: true })),
    ],
    [series, benchmarks],
  );

  const built = useMemo(
    () => buildChart(all, period ?? { id: "max" }, mode, forwardFill),
    [all, period, mode, forwardFill],
  );

  const valueFmt = useMemo(() => buildValueFmt(mode, unit), [mode, unit]);
  const axisFmt = useMemo(() => buildAxisFmt(mode, unit), [mode, unit]);

  if (!built) {
    return (
      <div className={`flex w-full items-center justify-center ${className}`} style={{ height }}>
        <p className="text-sm text-zinc-400">Sem dados para o período selecionado.</p>
      </div>
    );
  }

  const { rows, yDomain, spanDays, hasNegative } = built;
  const dotRadius = dots === true ? 2.5 : typeof dots === "number" ? dots : 0;
  const showLegend = all.length > 1;
  const zeroBaseline = mode === "pct_acum" ? 0 : mode === "rebase100" ? 100 : null;

  return (
    <div className={`w-full ${className}`} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
          <CartesianGrid {...azGridProps()} />
          <XAxis
            {...azXAxisProps()}
            dataKey="t"
            type="number"
            scale="time"
            domain={["dataMin", "dataMax"]}
            tickFormatter={(t) => formatAxisDate(isoFromUTC(Number(t)), spanDays)}
            minTickGap={28}
          />
          <YAxis
            {...azYAxisProps()}
            width={56}
            domain={yDomain}
            tickFormatter={(v) => axisFmt(Number(v))}
            label={
              yAxisLabel
                ? { value: yAxisLabel, angle: -90, position: "insideLeft", fontSize: 10, fill: AZ_CHART.ticks }
                : undefined
            }
          />

          {refAreas.map((a, i) => (
            <ReferenceArea
              key={`area-${i}`}
              y1={a.y1}
              y2={a.y2}
              fill={a.color ?? AZ_BRAND.azure}
              fillOpacity={a.opacity ?? 0.06}
              stroke="none"
              label={
                a.label
                  ? { value: a.label, position: "insideTopRight", fontSize: 9, fill: AZ_CHART.ticks }
                  : undefined
              }
            />
          ))}

          {/* Linha do zero (ou base 100 no rebase) quando a régua cruza a base. */}
          {hasNegative && zeroBaseline !== 0 ? <ReferenceLine {...azZeroLineProps("y")} /> : null}
          {zeroBaseline != null ? (
            <ReferenceLine
              y={zeroBaseline}
              stroke={AZ_CHART.zero}
              strokeOpacity={AZ_CHART.zeroOpacity}
              strokeWidth={1.5}
            />
          ) : null}

          {refLines.map((r, i) => (
            <ReferenceLine
              key={`ref-${i}`}
              y={r.y}
              stroke={r.color ?? AZ_BRAND.rust}
              strokeDasharray={r.dashed === false ? undefined : "4 4"}
              strokeWidth={1.2}
              label={
                r.label
                  ? { value: r.label, position: "right", fontSize: 9, fill: r.color ?? AZ_BRAND.rust }
                  : undefined
              }
            />
          ))}

          <Tooltip
            content={
              <AzTooltip
                labelFmt={(l) => fmtDataBR(isoFromUTC(Number(l)))}
                valueFmt={(v) => valueFmt(v)}
              />
            }
            cursor={AZ_TOOLTIP_PROPS.cursor}
          />
          {showLegend ? <Legend wrapperStyle={{ fontSize: 11 }} /> : null}

          {benchmarks.map((s, i) => (
            <Line
              key={s.id}
              type="monotone"
              dataKey={s.id}
              name={s.label}
              stroke={resolveColor(s, series.length + i, true)}
              strokeWidth={1.5}
              strokeDasharray="5 3"
              dot={false}
              connectNulls
              isAnimationActive={false}
            />
          ))}
          {series.map((s, i) => (
            <Line
              key={s.id}
              type="monotone"
              dataKey={s.id}
              name={s.label}
              stroke={resolveColor(s, i, false)}
              strokeWidth={2}
              dot={dotRadius > 0 ? { r: dotRadius } : false}
              connectNulls
              isAnimationActive={false}
            />
          ))}

          {showBrush ? (
            <Brush
              dataKey="t"
              height={26}
              stroke={AZ_BRAND.azure}
              fill="#eef2f8"
              travellerWidth={8}
              tickFormatter={(t) => formatAxisDate(isoFromUTC(Number(t)), spanDays)}
            />
          ) : null}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
