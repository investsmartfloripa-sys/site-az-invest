/**
 * Barrel dos componentes de gráfico base (séries temporais + período).
 * `import { AzTimeSeriesChart, AzPeriodSelector } from "@/components/painel/charts";`
 */
export {
  AzPeriodSelector,
  AZ_PERIOD_LABELS,
  resolvePeriodRange,
  useAzPeriodQueryState,
  type AzPeriodId,
  type AzPeriodSelectorProps,
  type AzPeriodValue,
} from "./AzPeriodSelector";
export {
  AzTimeSeriesChart,
  type AzRefArea,
  type AzRefLine,
  type AzSeriesMode,
  type AzSeriesPoint,
  type AzTimeSeries,
  type AzTimeSeriesChartProps,
  type AzUnit,
  type AzXRefArea,
} from "./AzTimeSeriesChart";
export { HeroHeader, type HeroHeaderProps } from "./HeroHeader";
export { RangeBar, type RangeBarProps } from "./RangeBar";
