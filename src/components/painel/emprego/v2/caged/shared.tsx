/**
 * Helpers do dashboard CAGED v2 (sem JSX) — convenções herdadas da crítica
 * do revisor:
 * - saldo é FLUXO que troca de sinal: variação SEMPRE em Δ absoluto (mil
 *   postos), NUNCA deltaPct;
 * - share (%) só de fluxo BRUTO (admissões) — saldo não comporta participação;
 * - convenção única de formatação: mil postos com 1 casa decimal ("12,3 mil").
 *
 * Helpers genéricos de série (mesIso, mmPoints, toPointsMes, baixarCsv,
 * codaceAreas) vêm de @/components/painel/atividade/v2/shared.
 */

import type { CodaceFaixaAtividade } from "@/lib/painel-atividade";
import type { CagedQuebraPonto, CagedTotalPonto } from "@/lib/painel-emprego";
import { fmtNum, fmtSignedNum } from "@/lib/format-br";

/** Nomes curtos dos meses (colunas de heatmap, eixo do YTD). */
export const MESES_CURTO_PT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"] as const;

// ---------------------------------------------------------------------------
// Formatação — convenção única: saldos em MIL postos, 1 casa
// ---------------------------------------------------------------------------

/** Saldo em mil postos: 232100 → "232,1 mil". */
export function fmtMil(v: number | null | undefined, dec = 1): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${fmtNum(v / 1000, dec)} mil`;
}

/** Δ absoluto em mil postos com sinal explícito: "+45,3 mil" / "−12,0 mil". */
export function fmtSignedMil(v: number | null | undefined, dec = 1): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${fmtSignedNum(v / 1000, dec)} mil`;
}

// ---------------------------------------------------------------------------
// Navegação na série mensal
// ---------------------------------------------------------------------------

/** "2026-04" → "2025-04". */
export function mesmoMesAnoAnterior(mes: string): string {
  const ano = parseInt(mes.slice(0, 4), 10);
  return `${ano - 1}${mes.slice(4)}`;
}

/** Registro de um mês exato (busca do fim — o mês recente está no fim). */
export function findMes<T extends { mes: string }>(serie: ReadonlyArray<T>, mes: string): T | null {
  for (let i = serie.length - 1; i >= 0; i--) if (serie[i].mes === mes) return serie[i];
  return null;
}

/** Última observação não-nula segundo o seletor (p/ campos v2 que podem ser null nos meses finais). */
export function ultimoCom<T extends { mes: string }>(
  serie: ReadonlyArray<T>,
  pick: (r: T) => number | null | undefined,
): { mes: string; valor: number } | null {
  for (let i = serie.length - 1; i >= 0; i--) {
    const v = pick(serie[i]);
    if (v != null && Number.isFinite(v)) return { mes: serie[i].mes, valor: v };
  }
  return null;
}

/** Soma do saldo cru de janeiro até mesLimite (inclusive) no ano dado; null se nenhum mês existe. */
export function somaYtd(serie: ReadonlyArray<CagedTotalPonto>, ano: number, mesLimite: number): number | null {
  let soma = 0;
  let achou = false;
  for (const r of serie) {
    const y = parseInt(r.mes.slice(0, 4), 10);
    if (y !== ano) continue;
    const m = parseInt(r.mes.slice(5, 7), 10);
    if (m <= mesLimite && r.saldo != null) {
      soma += r.saldo;
      achou = true;
    }
  }
  return achou ? soma : null;
}

/**
 * Momentum dessazonalizado: último mm3 do saldo SA e a direção vs 3 meses
 * antes. Limiar de 5 mil postos/mês p/ não chamar ruído de tendência.
 */
export type Mm3Tendencia = { mes: string; valor: number; dir: "acelera" | "desacelera" | "estavel" };

export function tendenciaMm3(serie: ReadonlyArray<CagedTotalPonto>, limiar = 5000): Mm3Tendencia | null {
  let iUlt = -1;
  for (let i = serie.length - 1; i >= 0; i--) {
    if (serie[i].saldo_sa_mm3 != null) {
      iUlt = i;
      break;
    }
  }
  if (iUlt < 0) return null;
  const valor = serie[iUlt].saldo_sa_mm3 as number;
  const ant = iUlt - 3 >= 0 ? serie[iUlt - 3].saldo_sa_mm3 : null;
  let dir: Mm3Tendencia["dir"] = "estavel";
  if (ant != null) {
    if (valor - ant > limiar) dir = "acelera";
    else if (valor - ant < -limiar) dir = "desacelera";
  }
  return { mes: serie[iUlt].mes, valor, dir };
}

// ---------------------------------------------------------------------------
// Quebras (microdado) — janelas de 12 meses
// ---------------------------------------------------------------------------

/** Soma campo Record<categoria, número> ao longo de uma janela da série de quebras. */
export function somaJanela(
  janela: ReadonlyArray<CagedQuebraPonto>,
  campo: "saldo_por_setor_ibge" | "saldo_por_faixa_salario" | "admissoes_por_faixa",
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of janela) {
    const rec = r[campo];
    if (!rec) continue;
    for (const [k, v] of Object.entries(rec)) out[k] = (out[k] ?? 0) + v;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Estatística robusta (heatmap sazonal — 2020 não pode dominar a escala)
// ---------------------------------------------------------------------------

export function mediana(vals: ReadonlyArray<number>): number | null {
  if (vals.length === 0) return null;
  const s = [...vals].sort((a, b) => a - b);
  const meio = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[meio] : (s[meio - 1] + s[meio]) / 2;
}

/** Desvio robusto = MAD × 1,4826 (consistente com σ sob normalidade). null quando MAD = 0. */
export function desvioRobusto(vals: ReadonlyArray<number>): number | null {
  const med = mediana(vals);
  if (med == null) return null;
  const mad = mediana(vals.map((v) => Math.abs(v - med)));
  if (mad == null || mad === 0) return null;
  return mad * 1.4826;
}

// ---------------------------------------------------------------------------
// CODACE em eixo CATEGÓRICO de meses "YYYY-MM" (ComposedChart custom)
// ---------------------------------------------------------------------------

/** "2014-Q2" → "2014-04" (início) ou "2014-06" (fim); "2014-05" passa direto. */
function codaceMes(s: string, fimDeFaixa: boolean): string {
  const q = s.match(/^(\d{4})-Q(\d)$/);
  if (q) {
    const m = (parseInt(q[2], 10) - 1) * 3 + (fimDeFaixa ? 3 : 1);
    return `${q[1]}-${String(m).padStart(2, "0")}`;
  }
  return s.slice(0, 7);
}

/**
 * Faixas de recessão CODACE clipadas a um eixo categórico de meses visíveis.
 * (A versão p/ eixo temporal contínuo é codaceAreas de atividade/v2/shared.)
 */
export function codaceFaixasCat(
  faixas: ReadonlyArray<CodaceFaixaAtividade> | undefined | null,
  meses: ReadonlyArray<string>,
): { x1: string; x2: string }[] {
  if (!faixas || meses.length === 0) return [];
  const out: { x1: string; x2: string }[] = [];
  for (const f of faixas) {
    if (f.tipo !== "recessao") continue;
    const pico = codaceMes(f.pico, false);
    const vale = codaceMes(f.vale, true);
    if (vale < meses[0] || pico > meses[meses.length - 1]) continue;
    const x1 = meses.find((m) => m >= pico) ?? meses[0];
    const x2 = [...meses].reverse().find((m) => m <= vale) ?? meses[meses.length - 1];
    if (x1 <= x2) out.push({ x1, x2 });
  }
  return out;
}
