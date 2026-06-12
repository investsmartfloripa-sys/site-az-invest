"use client";

import { AzTimeSeriesChart, type AzSeriesPoint } from "@/components/painel/charts";

export type MetricDailyViewsChartProps = {
  /** Pontos [ISO "YYYY-MM-DD", views] já agregados por dia (serializáveis). */
  data: AzSeriesPoint[];
  /** Nome da série no tooltip. Default "Pageviews". */
  label?: string;
  /** Cor da linha. Default azul AZ (#027DFC). */
  color?: string;
  /** Altura do chart em px. Default 260. */
  height?: number;
};

/**
 * Wrapper client do AzTimeSeriesChart para a série diária de pageviews do
 * workspace (dashboard-cockpit e métricas). As pages do workspace são Server
 * Components — este wrapper recebe apenas dados serializáveis por props e
 * delega tudo ao componente base de série temporal da casa.
 */
export function MetricDailyViewsChart({
  data,
  label = "Pageviews",
  color = "#027DFC",
  height = 260,
}: MetricDailyViewsChartProps) {
  return (
    <AzTimeSeriesChart
      series={[{ id: "views", label, color, data }]}
      unit="none"
      height={height}
      showLegend={false}
    />
  );
}
