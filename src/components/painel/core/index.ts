/**
 * Barrel dos componentes compartilhados de dashboard (padrão visual AZ).
 * Importe daqui: `import { ChartCard, KpiCard, ... } from "@/components/painel/core";`
 *
 * Tokens de cor/estilo vivem em `@/lib/az-chart-theme`;
 * formatadores pt-BR em `@/lib/format-br`.
 */
export { AzTooltip, azTooltipProps, type AzTooltipProps, type AzTooltipPayloadEntry } from "./AzTooltip";
export { azGridProps, azXAxisProps, azYAxisProps, azZeroLineProps } from "./azChartDefaults";
export { KpiCard, type KpiCardProps } from "./KpiCard";
export { ChartCard, type ChartCardProps } from "./ChartCard";
export { AzSegmented, type AzSegmentedOption } from "./AzSegmented";
export { RankingTable, type RankingTableProps, type RankingTableRow } from "./RankingTable";
export {
  Heatmap,
  isDarkBg,
  steppedDivergingScale,
  steppedScale,
  steppedSequentialScale,
  type HeatmapProps,
  type HeatmapStep,
} from "./Heatmap";
export { IndicadorBox, type IndicadorBoxProps } from "./IndicadorBox";
export { DashboardScaffold, type DashboardScaffoldProps, type DashboardBloco } from "./DashboardScaffold";
