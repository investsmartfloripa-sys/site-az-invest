"use client";

import { useId, useMemo } from "react";
import {
  Area,
  Brush,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceArea,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { AzTooltip } from "@/components/painel/core/AzTooltip";
import { azGridProps, azXAxisProps, azYAxisProps, azZeroLineProps } from "@/components/painel/core/azChartDefaults";
import { AZ_BRAND, AZ_CHART, AZ_TOOLTIP_PROPS, benchmarkColor, seriesColor, variationText } from "@/lib/az-chart-theme";
import {
  buildTimeTicks,
  diffDaysUTC,
  fmtBRL,
  fmtDataBR,
  fmtNum,
  fmtPct,
  fmtSignedPct,
  formatAxisDate,
  formatTimeTickLabel,
  isoFromUTC,
  parseIsoUTC,
} from "@/lib/format-br";
import { resolvePeriodRange, type AzPeriodValue } from "./AzPeriodSelector";

/**
 * O componente BASE de série temporal do site — embute todo o
 * PADRAO-VISUAL-GRAFICOS.md: grade sólida, eixos limpos, tooltip navy,
 * domain Y manual com 8% de folga (o Recharts clipa sem isso), ticks de
 * data ANCORADOS em viradas de mês/ano (`buildTimeTicks` — zero labels
 * duplicados) e cores AZ_SERIES respeitando BENCHMARK_COLORS quando o
 * rótulo casa.
 *
 * `variant="hero"` (opt-in) liga o tratamento premium dos gráficos de
 * destaque: área com gradiente, último valor em pill navy, máx/mín da
 * janela anotados, badge de variação e crosshair no hover.
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
  /**
   * Interpolação da linha — default "monotone". Use "stepAfter" p/ séries de
   * frequência menor sobrepostas a mensais (ex.: PIB trimestral × IBC-Br).
   */
  type?: "monotone" | "stepAfter";
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

/**
 * Variante visual do chart:
 * - "default": linha limpa (comportamento histórico — nada muda p/ quem já usa);
 * - "hero": tratamento premium p/ gráficos de destaque — 1ª série principal
 *   vira área com gradiente, último valor ganha dot + pill navy flutuante,
 *   máx/mín da janela são anotados, badge de variação no canto superior
 *   direito, cursor crosshair no hover e animação de entrada (~400ms).
 */
export type AzChartVariant = "default" | "hero";

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

/**
 * Faixa de referência VERTICAL (ex.: recessões CODACE sombreadas). Datas ISO.
 * A faixa é CLIPADA à janela visível: se começa antes do 1º ponto plotado (ou
 * termina depois do último), os limites são ajustados; faixas inteiramente fora
 * da janela são omitidas — em janelas curtas (ex.: 36m pós-2022) é esperado que
 * nenhuma apareça.
 */
export type AzXRefArea = {
  x1: string;
  x2: string;
  label?: string;
  color?: string;
  /** Opacidade do preenchimento — default 0.07. */
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
  /** Faixas VERTICAIS (ex.: recessões CODACE) — clipadas à janela visível. */
  xRefAreas?: AzXRefArea[];
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
  /**
   * ADITIVO (default "default" = comportamento atual). Use "hero" nos gráficos
   * de destaque das páginas (Ibov, IFIX, ativo...): área com gradiente,
   * último valor em pill, máx/mín anotados, badge de variação e crosshair.
   */
  variant?: AzChartVariant;
  /**
   * ADITIVO. Força exibir/ocultar a legenda. Default (undefined): automática —
   * visível quando há 2+ séries (comportamento atual). Passe `false` quando a
   * página já tem chips/toggles que fazem o papel de legenda.
   */
  showLegend?: boolean;
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

/**
 * Estatísticas da 1ª série principal NA JANELA plotada (valores já
 * transformados pelo `mode`) — alimentam as anotações do variant "hero".
 */
type MainSeriesStats = {
  lastT: number;
  lastV: number;
  maxT: number;
  maxV: number;
  minT: number;
  minV: number;
  /** Variação % bruta 1º→último ponto plotado (null se base ≤ 0). */
  windowPct: number | null;
};

type BuiltChart = {
  rows: ChartRow[];
  yDomain: [number, number];
  spanDays: number;
  hasNegative: boolean;
  main: MainSeriesStats | null;
};

function buildChart(
  all: { s: AzTimeSeries; isBenchmark: boolean }[],
  period: AzPeriodValue,
  mode: AzSeriesMode,
  forwardFill: boolean,
  padFrac = 0.08,
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
  let main: MainSeriesStats | null = null;

  for (const { s, isBenchmark } of all) {
    // Janela ordenada por data (não confia na ordenação do payload).
    const windowed = s.data
      .filter(([d, v]) => d >= from && d <= to && Number.isFinite(v))
      .slice()
      .sort((a, b) => (a[0] < b[0] ? -1 : 1));
    if (windowed.length === 0) continue;
    const base = windowed[0][1];

    // 1ª série PRINCIPAL com dados na janela — acumula os extremos plotados
    // (máx/mín/último, já transformados pelo mode) p/ as anotações do hero.
    const isMain = !isBenchmark && main === null;
    let mMaxV = -Infinity;
    let mMaxT = 0;
    let mMinV = Infinity;
    let mMinT = 0;
    let mLastV = 0;
    let mLastT = 0;

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
      const rounded = +v.toFixed(6);
      row[s.id] = rounded;
      if (v < lo) lo = v;
      if (v > hi) hi = v;
      if (isMain) {
        mLastV = rounded;
        mLastT = t;
        if (rounded > mMaxV) {
          mMaxV = rounded;
          mMaxT = t;
        }
        if (rounded < mMinV) {
          mMinV = rounded;
          mMinT = t;
        }
      }
    }

    if (isMain && Number.isFinite(mMaxV) && mMaxV !== -Infinity) {
      const firstRaw = windowed[0][1];
      const lastRaw = windowed[windowed.length - 1][1];
      main = {
        lastT: mLastT,
        lastV: mLastV,
        maxT: mMaxT,
        maxV: mMaxV,
        minT: mMinT,
        minV: mMinV,
        windowPct: firstRaw > 0 ? 100 * (lastRaw / firstRaw - 1) : null,
      };
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

  // Domain Y MANUAL — sem isso o Recharts clipa as linhas quando séries têm
  // vértices fora dos ticks "auto". No variant "hero" a folga é maior (padFrac
  // ~0.16) para os rótulos de máx/mín (acima/abaixo dos pontos) e a pill do
  // último valor não serem cortados pelo topo/base do gráfico.
  const span = hi - lo;
  const pad = span > 0 ? span * padFrac : Math.max(Math.abs(hi) * padFrac, 1);
  const yDomain: [number, number] = [lo - pad, hi + pad];

  const firstIso = isoFromUTC(rows[0].t);
  const lastIso = isoFromUTC(rows[rows.length - 1].t);
  const spanDays = Math.max(1, diffDaysUTC(firstIso, lastIso));

  return { rows, yDomain, spanDays, hasNegative: lo < 0 && hi > 0, main };
}

// ---------------------------------------------------------------------------
// Anotações do variant "hero"
// ---------------------------------------------------------------------------

/** Largura estimada da pill (texto 10,5px/600 tabular ≈ 6,3px por caractere + padding). */
function pillWidth(text: string): number {
  return Math.round(text.length * 6.3) + 16;
}

type PillViewBox = { x?: number; y?: number; width?: number; height?: number };

/**
 * Pill navy flutuante com o último valor — usada como `label` do ReferenceDot
 * do último ponto (o Recharts injeta o `viewBox` centrado no dot via clone).
 */
function AzLastValuePill({ viewBox, text }: { viewBox?: PillViewBox; text: string }) {
  if (!viewBox || typeof viewBox.x !== "number" || typeof viewBox.y !== "number") return null;
  const cx = viewBox.x + (viewBox.width ?? 0) / 2;
  const cy = viewBox.y + (viewBox.height ?? 0) / 2;
  const w = pillWidth(text);
  const h = 18;
  const x = cx + 9;
  return (
    <g pointerEvents="none">
      <rect x={x} y={cy - h / 2} width={w} height={h} rx={h / 2} fill={AZ_BRAND.navy} fillOpacity={0.95} />
      <text
        x={x + w / 2}
        y={cy}
        dy={3.5}
        textAnchor="middle"
        fontSize={10.5}
        fontWeight={600}
        fill="#FFFFFF"
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {text}
      </text>
    </g>
  );
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
  xRefAreas = [],
  dots = false,
  forwardFill = false,
  yAxisLabel,
  variant = "default",
  showLegend,
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
    // Hero precisa de mais folga vertical p/ os rótulos de máx/mín e a pill.
    () => buildChart(all, period ?? { id: "max" }, mode, forwardFill, variant === "hero" ? 0.16 : 0.08),
    [all, period, mode, forwardFill, variant],
  );

  const valueFmt = useMemo(() => buildValueFmt(mode, unit), [mode, unit]);
  const axisFmt = useMemo(() => buildAxisFmt(mode, unit), [mode, unit]);

  // Gradiente do hero precisa de id ÚNICO por instância (vários charts na página).
  const reactId = useId();
  const gradientId = `az-hero-grad-${reactId.replace(/[^a-zA-Z0-9_-]/g, "")}`;

  // Ticks de data ANCORADOS (viradas de mês/ano) — elimina o bug de labels
  // duplicados ("jul/25 jul/25") em todos os variants.
  const xTicks = useMemo(() => {
    if (!built) return undefined;
    const ticks = buildTimeTicks(
      built.rows.map((r) => isoFromUTC(r.t)),
      built.spanDays,
    )
      .map((iso) => parseIsoUTC(iso))
      .filter((t) => Number.isFinite(t));
    return ticks.length > 0 ? ticks : undefined;
  }, [built]);

  if (!built) {
    return (
      <div className={`flex w-full items-center justify-center ${className}`} style={{ height }}>
        <p className="text-sm text-zinc-400">Sem dados para o período selecionado.</p>
      </div>
    );
  }

  const { rows, yDomain, spanDays, hasNegative, main } = built;

  // Faixas verticais clipadas à janela plotada (faixa fora da janela é omitida).
  const firstT = rows[0].t;
  const lastT = rows[rows.length - 1].t;
  const xAreasVisiveis = xRefAreas
    .map((a) => ({
      ...a,
      t1: Date.parse(`${a.x1}T00:00:00Z`),
      t2: Date.parse(`${a.x2}T00:00:00Z`),
    }))
    .filter((a) => Number.isFinite(a.t1) && Number.isFinite(a.t2) && a.t2 >= firstT && a.t1 <= lastT)
    .map((a) => ({ ...a, t1: Math.max(a.t1, firstT), t2: Math.min(a.t2, lastT) }));
  const dotRadius = dots === true ? 2.5 : typeof dots === "number" ? dots : 0;
  const legendVisible = showLegend ?? all.length > 1;
  const zeroBaseline = mode === "pct_acum" ? 0 : mode === "rebase100" ? 100 : null;

  const isHero = variant === "hero";
  const mainColor = series.length > 0 ? resolveColor(series[0], 0, false) : AZ_BRAND.azure;
  // Pill do último valor vive na margem direita — reserva espaço p/ não cortar.
  const lastLabel = isHero && main ? valueFmt(main.lastV) : "";
  const marginRight = isHero && main ? Math.max(16, pillWidth(lastLabel) + 13) : 16;
  // Máx/mín só quando não coincidem com o último ponto (a pill já o destaca)
  // e a série não é flat (máx === mín seria anotação duplicada sem informação).
  const showMaxDot = isHero && main != null && main.maxV > main.minV && main.maxT !== main.lastT;
  const showMinDot = isHero && main != null && main.maxV > main.minV && main.minT !== main.lastT;
  // Chave estável por janela: re-anima ao trocar período/modo, nunca no hover.
  const heroAnimKey = `${rows[0]?.t ?? 0}:${rows[rows.length - 1]?.t ?? 0}:${mode}`;

  return (
    <div className={`relative w-full ${className}`} style={{ height }}>
      {/* Badge de variação da janela (1º→último ponto plotado da série principal). */}
      {isHero && main?.windowPct != null ? (
        <div
          className="pointer-events-none absolute right-2 top-0 z-10 rounded-full border border-[#132960]/10 bg-white/85 px-2 py-0.5 text-[10px] font-semibold tabular-nums shadow-sm"
          style={{ color: variationText(main.windowPct) }}
        >
          na janela: {fmtSignedPct(main.windowPct, 1)}
        </div>
      ) : null}
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={rows} margin={{ top: isHero ? 18 : 8, right: marginRight, bottom: isHero ? 12 : 4, left: 0 }}>
          {isHero ? (
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={mainColor} stopOpacity={0.16} />
                <stop offset="100%" stopColor={mainColor} stopOpacity={0} />
              </linearGradient>
            </defs>
          ) : null}
          <CartesianGrid {...azGridProps()} />
          <XAxis
            {...azXAxisProps()}
            dataKey="t"
            type="number"
            scale="time"
            domain={["dataMin", "dataMax"]}
            ticks={xTicks}
            tickFormatter={(t) => formatTimeTickLabel(isoFromUTC(Number(t)), spanDays)}
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

          {xAreasVisiveis.map((a, i) => (
            <ReferenceArea
              key={`xarea-${i}`}
              x1={a.t1}
              x2={a.t2}
              fill={a.color ?? AZ_CHART.ticks}
              fillOpacity={a.opacity ?? 0.07}
              stroke="none"
              label={
                a.label
                  ? { value: a.label, position: "insideTop", fontSize: 9, fill: AZ_CHART.ticks }
                  : undefined
              }
            />
          ))}

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
            cursor={
              isHero
                ? { stroke: AZ_BRAND.navy, strokeOpacity: 0.2, strokeWidth: 1 }
                : AZ_TOOLTIP_PROPS.cursor
            }
          />
          {legendVisible ? <Legend wrapperStyle={{ fontSize: 11 }} /> : null}

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
          {series.map((s, i) =>
            isHero && i === 0 ? (
              // Hero: série principal vira ÁREA com gradiente sob a linha.
              <Area
                key={`${s.id}:${heroAnimKey}`}
                type="monotone"
                dataKey={s.id}
                name={s.label}
                stroke={mainColor}
                strokeWidth={2.2}
                fill={`url(#${gradientId})`}
                fillOpacity={1}
                dot={dotRadius > 0 ? { r: dotRadius } : false}
                activeDot={{ r: 4, stroke: "#FFFFFF", strokeWidth: 1.5 }}
                connectNulls
                isAnimationActive
                animationDuration={400}
                animationEasing="ease-out"
              />
            ) : (
              <Line
                key={s.id}
                type={s.type ?? "monotone"}
                dataKey={s.id}
                name={s.label}
                stroke={resolveColor(s, i, false)}
                strokeWidth={2}
                dot={dotRadius > 0 ? { r: dotRadius } : false}
                connectNulls
                isAnimationActive={false}
              />
            ),
          )}

          {/* Anotações do hero: máx/mín da janela + último valor em pill navy. */}
          {showMaxDot && main ? (
            <ReferenceDot
              x={main.maxT}
              y={main.maxV}
              r={2.5}
              fill={AZ_CHART.ticks}
              stroke="none"
              label={{ value: axisFmt(main.maxV), position: "top", offset: 6, fontSize: 10, fill: AZ_CHART.ticks }}
            />
          ) : null}
          {showMinDot && main ? (
            <ReferenceDot
              x={main.minT}
              y={main.minV}
              r={2.5}
              fill={AZ_CHART.ticks}
              stroke="none"
              label={{ value: axisFmt(main.minV), position: "bottom", offset: 6, fontSize: 10, fill: AZ_CHART.ticks }}
            />
          ) : null}
          {isHero && main ? (
            <ReferenceDot
              x={main.lastT}
              y={main.lastV}
              r={3.5}
              fill={mainColor}
              stroke="#FFFFFF"
              strokeWidth={1.5}
              label={<AzLastValuePill text={lastLabel} />}
            />
          ) : null}

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
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
