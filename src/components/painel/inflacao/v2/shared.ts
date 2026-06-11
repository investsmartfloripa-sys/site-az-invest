/**
 * Helpers do Painel IPCA v2 (sem JSX): conversões mês→ISO, leitura segura de
 * números do JSON, thresholds EDITORIAIS documentados (manchete/títulos
 * afirmativos gerados por regra — nunca ad-hoc) e download de CSV client-side.
 */

import type { SerieGrupo } from "@/lib/painel-ipca";
import type { AzSeriesPoint } from "@/components/painel/charts/AzTimeSeriesChart";

// ---------------------------------------------------------------------------
// Meta de inflação (CMN) — referência onipresente nos gráficos de 12m
// ---------------------------------------------------------------------------
export const META = 3.0;
export const META_PISO = 1.5;
export const META_TETO = 4.5;

/**
 * Thresholds dos textos gerados por regra (documentados aqui e na ficha
 * técnica — título afirmativo errado é pior que título neutro):
 * - "em linha com o padrão sazonal" = |IPCA mês − mediana do mês civil| ≤ 0,05 p.p.;
 * - difusão "espalhada"/"contida" = MM3 acima/abaixo de média histórica ± 1 dp.
 */
export const SAZONAL_BANDA_PP = 0.05;

/** "2026-04" → "2026-04-01" (ISO p/ os componentes de série temporal). */
export function mesIso(mes: string): string {
  return `${mes}-01`;
}

/** Lê número de um registro do JSON (campos são number | null | string). */
export function num(row: Record<string, unknown> | undefined, key: string): number | null {
  const v = row?.[key];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** Série {mes, [key]} → pontos [iso, valor] p/ AzTimeSeriesChart. */
export function toPoints(serie: ReadonlyArray<SerieGrupo>, key: string): AzSeriesPoint[] {
  const out: AzSeriesPoint[] = [];
  for (const row of serie) {
    const v = num(row, key);
    if (v != null) out.push([mesIso(row.mes), v]);
  }
  return out;
}

/** Posição do 12m vs meta contínua, em prosa (regra única do painel). */
export function leituraMeta(v12m: number): string {
  if (v12m > META_TETO) return "acima do teto da meta (4,5%)";
  if (v12m < META_PISO) return "abaixo do piso da meta (1,5%)";
  return v12m >= META
    ? "dentro da banda da meta, acima do centro de 3,0%"
    : "dentro da banda da meta, abaixo do centro de 3,0%";
}

/** Versão curta p/ títulos: "acima do teto da meta" | "dentro da banda da meta" | "abaixo do piso da meta". */
export function leituraMetaCurta(v12m: number): string {
  if (v12m > META_TETO) return "acima do teto da meta";
  if (v12m < META_PISO) return "abaixo do piso da meta";
  return "dentro da banda da meta";
}

/** Comparação com o padrão sazonal do mês civil (banda de indiferença ±0,05 p.p.). */
export function leituraSazonal(ipcaMes: number, medianaMes: number): "acima" | "abaixo" | "em linha" {
  const dif = ipcaMes - medianaMes;
  if (dif > SAZONAL_BANDA_PP) return "acima";
  if (dif < -SAZONAL_BANDA_PP) return "abaixo";
  return "em linha";
}

/** Nome do grupo sem o prefixo numérico do IBGE ("1.Alimentação e bebidas" → "Alimentação e bebidas"). */
export function nomeGrupo(g: string): string {
  return g.replace(/^\d+\./, "");
}

// ---------------------------------------------------------------------------
// CSV client-side (gerado dos dados já carregados — sem round-trip)
// ---------------------------------------------------------------------------
type CsvCell = string | number | null | undefined;

function csvCell(c: CsvCell): string {
  if (c == null) return "";
  if (typeof c === "number") return String(c).replace(".", ","); // decimal pt-BR
  return /[;"\r\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c;
}

/**
 * Baixa um CSV no padrão Excel pt-BR: separador ";", vírgula decimal e BOM
 * UTF-8 (sem o BOM o Excel pt-BR lê acentos quebrados).
 */
export function baixarCsv(nomeArquivo: string, header: string[], rows: ReadonlyArray<ReadonlyArray<CsvCell>>): void {
  const linhas = [header.join(";"), ...rows.map((r) => r.map(csvCell).join(";"))];
  const blob = new Blob(["\uFEFF" + linhas.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeArquivo;
  a.click();
  URL.revokeObjectURL(url);
}
