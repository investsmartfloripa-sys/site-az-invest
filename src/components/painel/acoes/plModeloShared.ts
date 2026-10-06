import { AZ_BRAND, AZ_CHART } from "@/lib/az-chart-theme";
import { fmtDataBR, fmtMesCurto } from "@/lib/format-br";

/** Cores fixas da seção P/L × juros (AcoesPlModelo e cards de detalhe). */
export const PL_CORES = {
  obs: AZ_BRAND.navy, // P/L observado
  completo: AZ_BRAND.azure, // justificado pelo modelo completo
  juros: AZ_BRAND.rust, // justificado só pelos juros (tracejado)
  banda: AZ_BRAND.azure,
  media: AZ_CHART.ticks,
} as const;

/** "06/10/2026 (mês em curso)" quando o mês está em curso; "set/26" nos meses fechados. */
export function rotuloMes(r: { date: string; parcial: boolean }): string {
  return r.parcial ? `${fmtDataBR(r.date)} (mês em curso)` : fmtMesCurto(r.date);
}
