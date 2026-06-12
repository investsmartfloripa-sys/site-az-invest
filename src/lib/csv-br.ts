/**
 * Download de CSV client-side no padrão Excel pt-BR: separador ";", vírgula
 * decimal e BOM UTF-8 (sem o BOM o Excel pt-BR lê acentos quebrados).
 * Gerado dos dados já carregados — sem round-trip ao servidor.
 */

export type CsvCell = string | number | null | undefined;

function csvCell(c: CsvCell): string {
  if (c == null) return "";
  if (typeof c === "number") return String(c).replace(".", ","); // decimal pt-BR
  return /[;"\r\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c;
}

export function baixarCsv(nomeArquivo: string, header: string[], rows: ReadonlyArray<ReadonlyArray<CsvCell>>): void {
  const linhas = [header.join(";"), ...rows.map((r) => r.map(csvCell).join(";"))];
  const blob = new Blob(["﻿" + linhas.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeArquivo;
  a.click();
  URL.revokeObjectURL(url);
}
