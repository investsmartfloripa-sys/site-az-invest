/**
 * Helpers dos painéis de Atividade v2 (sem JSX): conversões mês/trimestre→ISO,
 * rebase pré-pandemia, médias móveis, faixas CODACE e leitura segura do JSON.
 *
 * Convenções da área (PLANO-GRAFICOS-ECONOMIA, com a crítica do revisor):
 * - nível e momentum NUNCA no mesmo eixo — painéis empilhados;
 * - ciclo longo = nível SA rebasado fev/2020 = 100;
 * - YoY suavizada = mm3; recessões CODACE sombreadas em séries de 5+ anos;
 * - derivadas pesadas vêm do BUILDER (contribuições, difusão, deflator, carrego).
 */

import type { AzSeriesPoint, AzXRefArea } from "@/components/painel/charts/AzTimeSeriesChart";
import type { CodaceFaixaAtividade } from "@/lib/painel-atividade";

export { baixarCsv } from "@/lib/csv-br";

/** Base do rebase pré-pandemia (último mês "normal" antes do choque covid). */
export const FEV_2020_ISO = "2020-02-01";

/** "2026-04" → "2026-04-01". */
export function mesIso(mes: string): string {
  return `${mes}-01`;
}

/** Mês CENTRAL do trimestre — alinhamento recomendado p/ sobrepor série trimestral à mensal. */
export function trimIsoCentral(trim: string): string {
  const m = trim.match(/^(\d{4})-T(\d{1,2})$/);
  if (!m) return trim;
  const central = ["02", "05", "08", "11"][parseInt(m[2], 10) - 1] ?? "02";
  return `${m[1]}-${central}-01`;
}

/** "2026-T01" → "1T26". */
export function fmtTrimCurto(trim: string): string {
  const m = trim.match(/^(\d{4})-T(\d{1,2})$/);
  if (!m) return trim;
  return `${parseInt(m[2], 10)}T${m[1].slice(2)}`;
}

/** Lê número de um registro do JSON (campos são number | null | string). */
export function num(row: Record<string, unknown> | undefined | null, key: string): number | null {
  const v = row?.[key];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** Série mensal {mes, [key]} → pontos [iso, valor]. */
export function toPointsMes(serie: ReadonlyArray<Record<string, unknown> & { mes: string }>, key: string): AzSeriesPoint[] {
  const out: AzSeriesPoint[] = [];
  for (const row of serie) {
    const v = num(row, key);
    if (v != null) out.push([mesIso(row.mes), v]);
  }
  return out;
}

/** Série trimestral {trim, [key]} → pontos [iso, valor] no mês central do trimestre. */
export function toPointsTrim(serie: ReadonlyArray<Record<string, unknown> & { trim: string }>, key: string): AzSeriesPoint[] {
  const out: AzSeriesPoint[] = [];
  for (const row of serie) {
    const v = num(row, key);
    if (v != null) out.push([trimIsoCentral(row.trim), v]);
  }
  return out;
}

/** Média móvel de N pontos sobre a série (descarta os primeiros N−1). */
export function mmPoints(points: ReadonlyArray<AzSeriesPoint>, n = 3): AzSeriesPoint[] {
  const out: AzSeriesPoint[] = [];
  for (let i = n - 1; i < points.length; i++) {
    let soma = 0;
    for (let j = i - n + 1; j <= i; j++) soma += points[j][1];
    out.push([points[i][0], +(soma / n).toFixed(4)]);
  }
  return out;
}

/**
 * Rebasa a série para 100 na data-base (1º ponto com data ≥ baseIso).
 * Séries com inícios distintos funcionam: cada uma rebasa no próprio ponto-base.
 * Retorna [] se a série não alcança a base (ex.: começou depois).
 */
export function rebase100(points: ReadonlyArray<AzSeriesPoint>, baseIso: string = FEV_2020_ISO): AzSeriesPoint[] {
  const base = points.find(([d]) => d >= baseIso);
  if (!base || !(base[1] > 0)) return [];
  return points.map(([d, v]) => [d, +((100 * v) / base[1]).toFixed(3)] as const);
}

/** Última observação não-nula da série para uma chave. */
export function ultimo<T extends Record<string, unknown>>(serie: ReadonlyArray<T>, key: string): { row: T; valor: number } | null {
  for (let i = serie.length - 1; i >= 0; i--) {
    const v = num(serie[i], key);
    if (v != null) return { row: serie[i], valor: v };
  }
  return null;
}

// ---------------------------------------------------------------------------
// CODACE — faixas de recessão p/ xRefAreas (AzTimeSeriesChart clipa à janela)
// ---------------------------------------------------------------------------

/** "2014-Q1" → "2014-01-01"; "2014-03" → "2014-03-01". */
function codaceIso(s: string, fimDeFaixa: boolean): string {
  const q = s.match(/^(\d{4})-Q(\d)$/);
  if (q) {
    const mes = (parseInt(q[2], 10) - 1) * 3 + (fimDeFaixa ? 3 : 1);
    return `${q[1]}-${String(mes).padStart(2, "0")}-01`;
  }
  const m = s.match(/^(\d{4})-(\d{2})$/);
  if (m) return `${m[1]}-${m[2]}-01`;
  return s;
}

/**
 * Converte a cronologia CODACE em faixas verticais. A cronologia oficial é
 * atualizada com anos de defasagem (última datação: 2020) — as faixas servem
 * para contexto histórico, não para detectar recessão corrente.
 */
export function codaceAreas(faixas: ReadonlyArray<CodaceFaixaAtividade> | undefined | null): AzXRefArea[] {
  if (!faixas) return [];
  return faixas
    .filter((f) => f.tipo === "recessao")
    .map((f) => ({ x1: codaceIso(f.pico, false), x2: codaceIso(f.vale, true) }));
}
