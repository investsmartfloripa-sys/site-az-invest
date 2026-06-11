import type { CSSProperties } from "react";

/**
 * Fonte ÚNICA de tokens visuais dos gráficos AZ Invest.
 *
 * Codifica o PADRAO-VISUAL-GRAFICOS.md (2026-06-04): grade ggplot2, tooltip
 * navy, cores de variação com contraste AA e paleta categórica oficial.
 * TODO gráfico novo importa daqui — nunca redeclarar hex em componente.
 */

// ---------------------------------------------------------------------------
// Marca
// ---------------------------------------------------------------------------

/** Cores de marca AZ Invest. Navy = títulos/zero-line; azure = série principal/links; rust = destaque pontual. */
export const AZ_BRAND = {
  navy: "#132960",
  azure: "#027DFC",
  rust: "#FF5713",
} as const;

// ---------------------------------------------------------------------------
// Tokens estruturais de gráfico (grade, eixos, variação)
// ---------------------------------------------------------------------------

/**
 * Paleta padrão AZ p/ gráficos (ver PADRAO-VISUAL-GRAFICOS.md).
 * `pos`/`neg` em barras e áreas; `posText`/`negText` em valores pequenos;
 * `neutral` (azul AZ) p/ variação dentro da banda ±0,03%; `zero` na
 * ReferenceLine do zero a 55% de opacidade.
 */
export const AZ_CHART = {
  pos: "#1E8A5C",
  neg: "#BE3B33",
  posText: "#166B47",
  negText: "#9C2B24",
  neutral: "#027DFC",
  zero: "#132960",
  zeroOpacity: 0.55,
  grid: "#E2E8F0",
  ticks: "#64748B",
  labels: "#334155",
} as const;

/** Banda neutra de variação (±0,03 p.p.): dentro dela o delta é "no zero" e pinta de azul AZ. */
export const AZ_NEUTRAL_BAND = 0.03;

/**
 * Cor de PREENCHIMENTO (barra/badge) pela direção da variação.
 * Verde subiu · azul dentro da banda ±0,03 · vermelho caiu — direção literal
 * do número, sem julgamento de bom/ruim (inverta a semântica no chamador).
 */
export function variationFill(value: number, band: number = AZ_NEUTRAL_BAND): string {
  if (!Number.isFinite(value) || Math.abs(value) <= band) return AZ_CHART.neutral;
  return value > 0 ? AZ_CHART.pos : AZ_CHART.neg;
}

/** Cor de TEXTO pela direção da variação (família escura, contraste em fundo claro). */
export function variationText(value: number, band: number = AZ_NEUTRAL_BAND): string {
  if (!Number.isFinite(value) || Math.abs(value) <= band) return AZ_CHART.neutral;
  return value > 0 ? AZ_CHART.posText : AZ_CHART.negText;
}

// ---------------------------------------------------------------------------
// Paleta categórica e benchmarks
// ---------------------------------------------------------------------------

/**
 * Paleta categórica oficial p/ séries simultâneas (até 8). Ordem importa:
 * a 1ª série de um gráfico leva o azul AZ. Use `seriesColor(i)` p/ ciclar.
 */
export const AZ_SERIES = [
  "#027DFC", // azul AZ — série principal
  "#132960", // navy
  "#FF5713", // rust
  "#1E8A5C", // verde-mar
  "#7C3AED", // violeta
  "#A16207", // ocre
  "#0891B2", // ciano
  "#64748B", // slate
] as const;

/** Cor da i-ésima série categórica (cicla após 8). */
export function seriesColor(index: number): string {
  return AZ_SERIES[((index % AZ_SERIES.length) + AZ_SERIES.length) % AZ_SERIES.length];
}

/**
 * Mapa FIXO benchmark → cor: a mesma série usa a mesma cor no site inteiro.
 * Resolva pelo `benchmarkColor(label)` (normaliza aliases tipo "Ibovespa").
 */
export const BENCHMARK_COLORS = {
  CDI: "#64748B", // slate — taxa de referência, neutra
  IBOV: "#132960", // navy — o índice da casa
  "S&P 500": "#7C3AED", // violeta
  "USD/BRL": "#1E8A5C", // verde — convenção "dólar"
  "IMA-B": "#0891B2", // ciano
  "NTN-B": "#A16207", // ocre
  IPCA: "#FF5713", // rust — inflação
} as const satisfies Record<string, string>;

/** Nome canônico dos benchmarks com cor fixa. */
export type BenchmarkName = keyof typeof BENCHMARK_COLORS;

const BENCHMARK_ALIASES: Record<string, BenchmarkName> = {
  CDI: "CDI",
  IBOV: "IBOV",
  IBOVESPA: "IBOV",
  BVSP: "IBOV",
  "^BVSP": "IBOV",
  "S&P500": "S&P 500",
  "S&P 500": "S&P 500",
  SP500: "S&P 500",
  SPX: "S&P 500",
  "^GSPC": "S&P 500",
  "USD/BRL": "USD/BRL",
  USDBRL: "USD/BRL",
  "BRL=X": "USD/BRL",
  DOLAR: "USD/BRL",
  DÓLAR: "USD/BRL",
  "IMA-B": "IMA-B",
  IMAB: "IMA-B",
  "NTN-B": "NTN-B",
  NTNB: "NTN-B",
  IPCA: "IPCA",
};

/**
 * Cor fixa do benchmark se o rótulo casar (case-insensitive, tolera aliases
 * comuns: "Ibovespa", "^GSPC", "Dólar"...). `undefined` se não é benchmark —
 * caia então em `seriesColor(i)`.
 */
export function benchmarkColor(label: string): string | undefined {
  const key = label.trim().toUpperCase();
  const direct = BENCHMARK_ALIASES[key];
  if (direct) return BENCHMARK_COLORS[direct];
  // Tolerância a espaços ("USD / BRL") e sufixos curtos ("CDI (a.a.)").
  const compact = key.replace(/\s+/g, "");
  const byCompact = BENCHMARK_ALIASES[compact];
  if (byCompact) return BENCHMARK_COLORS[byCompact];
  return undefined;
}

// ---------------------------------------------------------------------------
// Constantes prontas p/ spread em props Recharts
// ---------------------------------------------------------------------------

/** Spread em `<CartesianGrid {...AZ_GRID_PROPS} />`: grade sólida slate-200, nunca tracejada. */
export const AZ_GRID_PROPS = {
  stroke: AZ_CHART.grid,
  strokeWidth: 1,
} as const;

/** Tick padrão de eixo (11px slate-500). Use dentro de `tick={{ ...AZ_AXIS_TICK }}`. */
export const AZ_AXIS_TICK = {
  fontSize: 11,
  fill: AZ_CHART.ticks,
} as const;

/** Spread em `<XAxis {...AZ_AXIS_PROPS} />` / `<YAxis {...AZ_AXIS_PROPS} />`: eixos limpos, a grade é a régua. */
export const AZ_AXIS_PROPS = {
  axisLine: false,
  tickLine: false,
  tick: AZ_AXIS_TICK,
} as const;

/** Spread em `<ReferenceLine y={0} {...AZ_ZERO_LINE_PROPS} />` (ou x={0} em barras horizontais). */
export const AZ_ZERO_LINE_PROPS = {
  stroke: AZ_CHART.zero,
  strokeOpacity: AZ_CHART.zeroOpacity,
  strokeWidth: 1.5,
} as const;

/**
 * Tooltip navy "momento de marca" — spread direto: `<Tooltip {...AZ_TOOLTIP_PROPS} />`.
 * Para conteúdo custom mantenha `cursor` e use o componente `AzTooltip`
 * (src/components/painel/core) como `content`.
 */
export const AZ_TOOLTIP_PROPS = {
  contentStyle: {
    background: AZ_BRAND.navy,
    border: "none",
    borderRadius: 8,
    color: "#fff",
    fontSize: 12,
    boxShadow: "0 4px 12px rgba(19,41,96,.25)",
  } satisfies CSSProperties,
  itemStyle: { color: "#fff" } satisfies CSSProperties,
  labelStyle: { color: "#94A3B8", fontWeight: 600 } satisfies CSSProperties,
  cursor: { fill: "rgba(19,41,96,0.05)" },
} as const;
