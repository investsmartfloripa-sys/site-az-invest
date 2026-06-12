/**
 * Helpers do Painel Receita e Gastos v2 (sem JSX).
 *
 * Convenções da área (crítica do revisor incorporada):
 * - datas das séries fiscais são "YYYY-MM" → sempre converter com mesIso;
 * - recessões = CODACE mensal (nunca regimes hardcoded); marcos institucionais
 *   = linhas verticais finas (EC 95 e LC 200);
 * - derivadas pesadas (estabilizador, deflação, famílias) vêm do BUILDER —
 *   aqui só razão/Δ de apresentação;
 * - charts custom usam eixo X NUMÉRICO de tempo (mesma régua do
 *   AzTimeSeriesChart: ticks ancorados em viradas de mês/ano).
 */

import type { AzSeriesPoint, AzXRefArea } from "@/components/painel/charts/AzTimeSeriesChart";
import { resolvePeriodRange, type AzPeriodValue } from "@/components/painel/charts/AzPeriodSelector";
import type { PontoMensal, PontoMensalPct, PontoPibYoY } from "@/lib/painel-fiscal";
import { buildTimeTicks, diffDaysUTC, fmtMesCurto, isoFromUTC, parseIsoUTC } from "@/lib/format-br";
import { mesIso } from "@/components/painel/atividade/v2/shared";

export { baixarCsv, codaceAreas, mesIso } from "@/components/painel/atividade/v2/shared";

// ---------------------------------------------------------------------------
// Marcos institucionais — substituem os "regimes" hardcoded do dashboard antigo
// ---------------------------------------------------------------------------

/** EC 95 (teto de gastos, promulgada dez/2016) e LC 200 (arcabouço, ago/2023). */
export const MARCOS_FISCAIS: ReadonlyArray<{ iso: string; label: string }> = [
  { iso: "2016-12-01", label: "EC 95" },
  { iso: "2023-08-01", label: "LC 200" },
];

// ---------------------------------------------------------------------------
// Conversão das séries do fiscal-classicos.json → pontos [ISO, valor]
// ---------------------------------------------------------------------------

/** PontoMensalPct[] (campo valor_pct) → pontos. */
export function pctPoints(serie: ReadonlyArray<PontoMensalPct> | undefined | null): AzSeriesPoint[] {
  if (!serie) return [];
  const out: AzSeriesPoint[] = [];
  for (const p of serie) {
    if (p.valor_pct != null && Number.isFinite(p.valor_pct)) out.push([mesIso(p.data), p.valor_pct]);
  }
  return out;
}

/** PontoMensal[] (campo valor) → pontos. */
export function mensalPoints(serie: ReadonlyArray<PontoMensal> | undefined | null): AzSeriesPoint[] {
  if (!serie) return [];
  const out: AzSeriesPoint[] = [];
  for (const p of serie) {
    if (p.valor != null && Number.isFinite(p.valor)) out.push([mesIso(p.data), p.valor]);
  }
  return out;
}

/** PontoPibYoY[] (campo valor_yoy_pct) → pontos. */
export function yoyPoints(serie: ReadonlyArray<PontoPibYoY> | undefined | null): AzSeriesPoint[] {
  if (!serie) return [];
  const out: AzSeriesPoint[] = [];
  for (const p of serie) {
    if (p.valor_yoy_pct != null && Number.isFinite(p.valor_yoy_pct)) out.push([mesIso(p.data), p.valor_yoy_pct]);
  }
  return out;
}

/** Última observação não-nula: { data: "YYYY-MM", valor }. */
export function ultimoPct(serie: ReadonlyArray<PontoMensalPct> | undefined | null): { data: string; valor: number } | null {
  if (!serie) return null;
  for (let i = serie.length - 1; i >= 0; i--) {
    const v = serie[i].valor_pct;
    if (v != null && Number.isFinite(v)) return { data: serie[i].data, valor: v };
  }
  return null;
}

/** Idem p/ PontoMensal (campo valor). */
export function ultimoMensal(serie: ReadonlyArray<PontoMensal> | undefined | null): { data: string; valor: number } | null {
  if (!serie) return null;
  for (let i = serie.length - 1; i >= 0; i--) {
    const v = serie[i].valor;
    if (v != null && Number.isFinite(v)) return { data: serie[i].data, valor: v };
  }
  return null;
}

/** Idem p/ PontoPibYoY (campo valor_yoy_pct). */
export function ultimoYoY(serie: ReadonlyArray<PontoPibYoY> | undefined | null): { data: string; valor: number } | null {
  if (!serie) return null;
  for (let i = serie.length - 1; i >= 0; i--) {
    const v = serie[i].valor_yoy_pct;
    if (v != null && Number.isFinite(v)) return { data: serie[i].data, valor: v };
  }
  return null;
}

/** Valor da série no mês exato "YYYY-MM" (null se ausente). */
export function pctEm(serie: ReadonlyArray<PontoMensalPct> | undefined | null, mes: string): number | null {
  if (!serie) return null;
  const p = serie.find((x) => x.data === mes);
  return p?.valor_pct != null && Number.isFinite(p.valor_pct) ? p.valor_pct : null;
}

/** "2026-04" → "2025-04". */
export function mes12mAntes(mes: string): string {
  const [y, m] = mes.split("-");
  return `${Number(y) - 1}-${m}`;
}

/** Δ em p.p. da participação vs o MESMO mês 12 meses antes (match exato de mês). */
export function deltaPp12m(serie: ReadonlyArray<PontoMensalPct> | undefined | null): number | null {
  const ult = ultimoPct(serie);
  if (!ult) return null;
  const antes = pctEm(serie, mes12mAntes(ult.data));
  return antes != null ? +(ult.valor - antes).toFixed(4) : null;
}

// ---------------------------------------------------------------------------
// Linhas {t, ...} p/ ComposedChart com eixo X numérico de tempo
// ---------------------------------------------------------------------------

export type LinhaTempo = { t: number } & Record<string, number>;

/** Funde séries {id → pontos} em linhas {t, [id]: valor} ordenadas por t. */
export function mergeTimeRows(seriesById: Record<string, ReadonlyArray<AzSeriesPoint>>): LinhaTempo[] {
  const byT = new Map<number, LinhaTempo>();
  for (const [id, pts] of Object.entries(seriesById)) {
    for (const [iso, v] of pts) {
      const t = parseIsoUTC(iso);
      if (!Number.isFinite(t) || !Number.isFinite(v)) continue;
      let row = byT.get(t);
      if (!row) {
        row = { t } as LinhaTempo;
        byT.set(t, row);
      }
      row[id] = v;
    }
  }
  return [...byT.values()].sort((a, b) => a.t - b.t);
}

/** Recorta as linhas à janela do AzPeriodSelector (mesma semântica do AzTimeSeriesChart). */
export function clipTimeRows(rows: ReadonlyArray<LinhaTempo>, period: AzPeriodValue): LinhaTempo[] {
  if (rows.length === 0) return [];
  const minIso = isoFromUTC(rows[0].t);
  const maxIso = isoFromUTC(rows[rows.length - 1].t);
  const { from, to } = resolvePeriodRange(period, minIso, maxIso);
  const tFrom = parseIsoUTC(from);
  const tTo = parseIsoUTC(to);
  return rows.filter((r) => r.t >= tFrom && r.t <= tTo);
}

/** Ticks ancorados (viradas de mês/ano) + spanDays p/ o XAxis numérico. */
export function timeAxis(rows: ReadonlyArray<LinhaTempo>): { ticks: number[] | undefined; spanDays: number } {
  if (rows.length === 0) return { ticks: undefined, spanDays: 1 };
  const isos = rows.map((r) => isoFromUTC(r.t));
  const spanDays = Math.max(1, diffDaysUTC(isos[0], isos[isos.length - 1]));
  const ticks = buildTimeTicks(isos, spanDays)
    .map((iso) => parseIsoUTC(iso))
    .filter((t) => Number.isFinite(t));
  return { ticks: ticks.length > 0 ? ticks : undefined, spanDays };
}

/** Label de tooltip p/ eixo numérico de tempo: t → "abr/26". */
export function fmtTLabel(label: string | number): string {
  return fmtMesCurto(isoFromUTC(Number(label)));
}

/**
 * Domain Y MANUAL com folga (sem isso o Recharts clipa linhas fora dos ticks
 * "auto"). `extras` injeta valores que precisam caber (bandas, metas).
 */
export function yDomainDe(
  rows: ReadonlyArray<Record<string, number | undefined>>,
  keys: ReadonlyArray<string>,
  opts?: { incluirZero?: boolean; padFrac?: number; extras?: ReadonlyArray<number> },
): [number, number] | undefined {
  let lo = Infinity;
  let hi = -Infinity;
  for (const r of rows) {
    for (const k of keys) {
      const v = r[k];
      if (typeof v === "number" && Number.isFinite(v)) {
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
    }
  }
  for (const v of opts?.extras ?? []) {
    if (Number.isFinite(v)) {
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
  }
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return undefined;
  if (opts?.incluirZero) {
    lo = Math.min(lo, 0);
    hi = Math.max(hi, 0);
  }
  const span = hi - lo;
  const pad = span > 0 ? span * (opts?.padFrac ?? 0.08) : Math.max(Math.abs(hi) * 0.08, 1);
  return [lo - pad, hi + pad];
}

/** Faixas verticais (CODACE) clipadas à janela numérica das linhas. */
export function clipXAreasT(
  areas: ReadonlyArray<AzXRefArea>,
  rows: ReadonlyArray<LinhaTempo>,
): { t1: number; t2: number }[] {
  if (rows.length === 0) return [];
  const firstT = rows[0].t;
  const lastT = rows[rows.length - 1].t;
  return areas
    .map((a) => ({ t1: parseIsoUTC(a.x1), t2: parseIsoUTC(a.x2) }))
    .filter((a) => Number.isFinite(a.t1) && Number.isFinite(a.t2) && a.t2 >= firstT && a.t1 <= lastT)
    .map((a) => ({ t1: Math.max(a.t1, firstT), t2: Math.min(a.t2, lastT) }));
}

/** Marcos institucionais (EC 95, LC 200) visíveis na janela plotada. */
export function marcosVisiveis(rows: ReadonlyArray<LinhaTempo>): { t: number; label: string }[] {
  if (rows.length === 0) return [];
  const firstT = rows[0].t;
  const lastT = rows[rows.length - 1].t;
  return MARCOS_FISCAIS.map((m) => ({ t: parseIsoUTC(m.iso), label: m.label })).filter(
    (m) => Number.isFinite(m.t) && m.t >= firstT && m.t <= lastT,
  );
}
