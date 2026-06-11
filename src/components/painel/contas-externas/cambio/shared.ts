/**
 * Helpers da sub-área Câmbio econômico (sem JSX).
 *
 * REGRA DE LEITURA ÚNICA do painel (documentada também na ficha técnica):
 * tanto no REER (SGS 11752, jun/1994=100) quanto no bilateral construído,
 * ALTA do índice = DEPRECIAÇÃO real do BRL. Nunca inverta — uma proposta
 * anterior leu a 11752 ao contrário e o semáforo saiu com sinal trocado.
 */

import type { AzSeriesPoint } from "@/components/painel/charts/AzTimeSeriesChart";
import type { CambioRealPonto } from "@/lib/painel-contas-externas";

/** "2026-04" → "2026-04-01" (ISO p/ os componentes de série temporal). */
export function mesIso(mes: string): string {
  return `${mes}-01`;
}

/** Série {mes, indice} → pontos [iso, valor] p/ AzTimeSeriesChart. */
export function indicePoints(serie: ReadonlyArray<CambioRealPonto>): AzSeriesPoint[] {
  return serie
    .filter((p) => typeof p.indice === "number" && Number.isFinite(p.indice))
    .map((p) => [mesIso(p.mes), p.indice]);
}

/**
 * Leitura editorial do desvio do câmbio real vs média histórica (banda de
 * indiferença de ±0,5 dp implícita: até aí é "em linha"). Threshold
 * documentado — título afirmativo errado é pior que título neutro.
 */
export function leituraDesvio(desvioPct: number, dpPct: number): "mais depreciado" | "mais apreciado" | "em linha" {
  const banda = dpPct * 0.5;
  if (desvioPct > banda) return "mais depreciado";
  if (desvioPct < -banda) return "mais apreciado";
  return "em linha";
}

// ---------------------------------------------------------------------------
// CSV client-side (padrão Excel pt-BR: ";", vírgula decimal, BOM UTF-8)
// ---------------------------------------------------------------------------
type CsvCell = string | number | null | undefined;

function csvCell(c: CsvCell): string {
  if (c == null) return "";
  if (typeof c === "number") return String(c).replace(".", ","); // decimal pt-BR
  return /[;"\r\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c;
}

/** Baixa um CSV gerado no navegador a partir dos dados já carregados. */
export function baixarCsv(
  nomeArquivo: string,
  header: string[],
  rows: ReadonlyArray<ReadonlyArray<CsvCell>>,
): void {
  const linhas = [header.join(";"), ...rows.map((r) => r.map(csvCell).join(";"))];
  const blob = new Blob(["﻿" + linhas.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeArquivo;
  a.click();
  URL.revokeObjectURL(url);
}
