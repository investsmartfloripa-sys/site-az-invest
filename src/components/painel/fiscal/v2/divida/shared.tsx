/**
 * Helpers do Painel Dívida v2 (sem JSX): conversões de PontoMensal ({data, valor})
 * para pontos AzSeriesPoint, deltas de 12 meses, máximo histórico derivado da
 * série (nunca hardcode) e clipping de faixas CODACE em eixos de categoria.
 *
 * codaceAreas/baixarCsv vêm do shared canônico de Atividade v2 — fonte única.
 */

import type { AzSeriesPoint, AzXRefArea } from "@/components/painel/charts/AzTimeSeriesChart";
import type { PontoMensal } from "@/lib/painel-fiscal";
import { addMonthsUTC } from "@/lib/format-br";

export { baixarCsv, codaceAreas } from "@/components/painel/atividade/v2/shared";

/** Normaliza a data do pipeline fiscal: "2026-04" → "2026-04-01" (mantém "YYYY-MM-DD"). */
export function dataIso(data: string): string {
  return data.length === 7 ? `${data}-01` : data;
}

/** PontoMensal[] ({data, valor}) → pontos [iso, valor], descartando nulos. */
export function toPoints(serie: ReadonlyArray<PontoMensal> | undefined | null): AzSeriesPoint[] {
  const out: AzSeriesPoint[] = [];
  if (!serie) return out;
  for (const p of serie) {
    if (p.valor != null && Number.isFinite(p.valor)) out.push([dataIso(p.data), p.valor]);
  }
  return out;
}

/** Última observação não-nula da série. */
export function ultimoPonto(serie: ReadonlyArray<PontoMensal> | undefined | null): { data: string; valor: number } | null {
  if (!serie) return null;
  for (let i = serie.length - 1; i >= 0; i--) {
    const v = serie[i].valor;
    if (v != null && Number.isFinite(v)) return { data: serie[i].data, valor: v };
  }
  return null;
}

/** Máximo histórico da série (valor e mês) — calculado do dado, nunca hardcode. */
export function maximoPonto(serie: ReadonlyArray<PontoMensal> | undefined | null): { data: string; valor: number } | null {
  if (!serie) return null;
  let melhor: { data: string; valor: number } | null = null;
  for (const p of serie) {
    if (p.valor != null && Number.isFinite(p.valor) && (melhor == null || p.valor > melhor.valor)) {
      melhor = { data: p.data, valor: p.valor };
    }
  }
  return melhor;
}

/**
 * Último valor + variação contra o MESMO mês de 12 meses antes (match por
 * "YYYY-MM"). `delta12m` é null quando a série não alcança 12 meses atrás.
 */
export function deltaDozeMeses(
  serie: ReadonlyArray<PontoMensal> | undefined | null,
): { data: string; valor: number; delta12m: number | null } | null {
  const ult = ultimoPonto(serie);
  if (!ult || !serie) return null;
  const alvo = addMonthsUTC(dataIso(ult.data), -12).slice(0, 7);
  let anterior: number | null = null;
  for (let i = serie.length - 1; i >= 0; i--) {
    const p = serie[i];
    if (p.valor != null && Number.isFinite(p.valor) && dataIso(p.data).slice(0, 7) === alvo) {
      anterior = p.valor;
      break;
    }
  }
  return { data: ult.data, valor: ult.valor, delta12m: anterior != null ? +(ult.valor - anterior).toFixed(2) : null };
}

/**
 * Clipa faixas CODACE (já em ISO, via codaceAreas) aos valores de um eixo de
 * CATEGORIA (lista ordenada de ISO visíveis) — p/ ComposedChart custom onde o
 * X não é numérico. Faixas inteiramente fora da janela são omitidas.
 */
export function clipFaixasCategoria(faixas: ReadonlyArray<AzXRefArea>, isosVisiveis: ReadonlyArray<string>): AzXRefArea[] {
  if (isosVisiveis.length === 0) return [];
  const primeiro = isosVisiveis[0];
  const ultimo = isosVisiveis[isosVisiveis.length - 1];
  const out: AzXRefArea[] = [];
  for (const f of faixas) {
    if (f.x2 < primeiro || f.x1 > ultimo) continue;
    const x1 = isosVisiveis.find((d) => d >= f.x1) ?? primeiro;
    const x2 = [...isosVisiveis].reverse().find((d) => d <= f.x2) ?? ultimo;
    if (x1 <= x2) out.push({ x1, x2 });
  }
  return out;
}
