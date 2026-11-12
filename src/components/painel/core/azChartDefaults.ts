import {
  AZ_AXIS_PROPS,
  AZ_AXIS_TICK,
  AZ_GRID_PROPS,
  AZ_ZERO_LINE_PROPS,
} from "@/lib/az-chart-theme";

/**
 * Helpers que devolvem props padrão p/ spread direto nos elementos Recharts
 * (PADRAO-VISUAL-GRAFICOS.md §1): grade sólida #E2E8F0, eixos sem linha/tick
 * marks e linha do zero navy a 55%.
 *
 * Uso:
 *   <CartesianGrid {...azGridProps()} />
 *   <XAxis {...azXAxisProps()} dataKey="..." />
 *   <ReferenceLine {...azZeroLineProps("y")} />
 */

type GridDirection = "both" | "vertical-only" | "horizontal-only";

/**
 * Props da `<CartesianGrid>`: sólida slate-200. Em barras HORIZONTAIS use
 * `"vertical-only"` (só as linhas verticais dão régua).
 */
export function azGridProps(direction: GridDirection = "both"): {
  stroke: string;
  strokeWidth: number;
  horizontal?: boolean;
  vertical?: boolean;
} {
  if (direction === "vertical-only") return { ...AZ_GRID_PROPS, horizontal: false };
  if (direction === "horizontal-only") return { ...AZ_GRID_PROPS, vertical: false };
  return { ...AZ_GRID_PROPS };
}

type AxisDefaults = {
  axisLine: false;
  tickLine: false;
  tick: { fontSize: number; fill: string };
};

/** Props do `<XAxis>`: sem linha nem tick marks, tick 11px #64748B. */
export function azXAxisProps(): AxisDefaults {
  return { axisLine: false, tickLine: false, tick: { ...AZ_AXIS_TICK } };
}

/** Props do `<YAxis>`: idem XAxis (a grade já é a régua). */
export function azYAxisProps(): AxisDefaults {
  return { axisLine: false, tickLine: false, tick: { ...AZ_AXIS_TICK } };
}

/**
 * Props da `<ReferenceLine>` do zero (navy @55%). `axis="y"` p/ séries
 * temporais (linha horizontal em y=0); `axis="x"` p/ barras divergentes
 * horizontais (linha vertical em x=0).
 */
export function azZeroLineProps(axis: "x" | "y"): {
  x?: number;
  y?: number;
  stroke: string;
  strokeOpacity: number;
  strokeWidth: number;
} {
  return axis === "x" ? { x: 0, ...AZ_ZERO_LINE_PROPS } : { y: 0, ...AZ_ZERO_LINE_PROPS };
}

/**
 * Marcas "redondas" para eixos de gráficos Recharts feitos à mão (os que não usam
 * AzTimeSeriesChart): passo 1·2·2,5·5 × 10^k, ~`alvo` intervalos, sempre incluindo o zero
 * quando ele está no intervalo. Devolve também o domínio estendido até as marcas das pontas.
 * Uso: const { ticks, domain } = ticksRedondos(min, max); <YAxis ticks={ticks} domain={domain} />
 */
export function ticksRedondos(min: number, max: number, alvo = 4): { ticks: number[]; domain: [number, number] } {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return { ticks: [], domain: [0, 1] };
  if (min === max) {
    const folga = Math.abs(min) || 1;
    min -= folga / 2;
    max += folga / 2;
  }
  const bruto = (max - min) / alvo;
  const p = 10 ** Math.floor(Math.log10(bruto));
  const m = bruto / p;
  const passo = (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p;
  const ini = Math.floor(min / passo) * passo;
  const fim = Math.ceil(max / passo) * passo;
  const ticks: number[] = [];
  for (let v = ini; v <= fim + passo / 1e6; v += passo) ticks.push(+v.toFixed(10));
  return { ticks, domain: [ini, fim] };
}

export { AZ_AXIS_PROPS };
