/**
 * Re-export do segmented control padrão AZ (indicador navy deslizante,
 * container #eef2f8 — ver PADRAO-VISUAL-GRAFICOS.md §6).
 *
 * A implementação canônica vive em panorama/AzSegmented.tsx; este módulo
 * existe p/ que dashboards novos importem tudo de `painel/core` sem conhecer
 * a pasta panorama. Use p/ alternar CATEGORIAS dentro de um card
 * (BRL/USD, Brasil/Global). Período de série temporal é com AzPeriodSelector.
 */
export { AzSegmented, type AzSegmentedOption } from "@/components/painel/panorama/AzSegmented";
