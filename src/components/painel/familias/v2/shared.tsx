/**
 * Helpers do Painel Famílias v2 (Brasil) — conversões de data, merges mensais,
 * faixas editoriais e o Chip de destaque dos cards.
 *
 * Convenções herdadas do template narrativo (atividade/v2):
 * - nível e momentum NUNCA no mesmo eixo — painéis empilhados;
 * - recessões CODACE sombreadas em séries de 5+ anos;
 * - faixas EDITORIAIS (ciclos de aperto Selic, regimes do salário mínimo)
 *   sempre declaradas como tal no footer do card.
 *
 * Datas no payload Famílias:
 * - SeriePonto.mes  = "YYYY-MM-DD" (dia 01);
 * - RendaTotalPonto.trim / RendaPosicaoPonto.trim = "YYYY-MM" (trimestre MÓVEL,
 *   rotulado pelo mês final) — converta com mesIso;
 * - pontos de poder_compra usam data = "YYYY-MM" — converta com isoData.
 */

import type { AzSeriesPoint, AzXRefArea } from "@/components/painel/charts/AzTimeSeriesChart";
import type { FamiliasEstruturaSocialData, IpcaFaixaPonto, SeriePonto } from "@/lib/painel-familias";
import { addMonthsUTC } from "@/lib/format-br";

export { baixarCsv, codaceAreas, mesIso, mmPoints, num } from "@/components/painel/atividade/v2/shared";

const MESES_CURTO = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"] as const;

/** Normaliza "YYYY-MM" → "YYYY-MM-01"; "YYYY-MM-DD..." → "YYYY-MM-DD". */
export function isoData(s: string): string {
  if (/^\d{4}-\d{2}$/.test(s)) return `${s}-01`;
  return s.slice(0, 10);
}

/** Rótulo do trimestre MÓVEL terminado no mês: "2026-04" → "fev–abr/26". */
export function fmtTrimMovel(trim: string): string {
  const m = /^(\d{4})-(\d{2})/.exec(trim);
  if (!m) return trim;
  const fim = parseInt(m[2], 10) - 1;
  if (fim < 0 || fim > 11) return trim;
  const ini = (fim - 2 + 12) % 12;
  return `${MESES_CURTO[ini]}–${MESES_CURTO[fim]}/${m[1].slice(2)}`;
}

/** SeriePonto[] (BCB) → pontos [iso, valor]. */
export function serieToPoints(serie: ReadonlyArray<SeriePonto> | undefined | null): AzSeriesPoint[] {
  const out: AzSeriesPoint[] = [];
  for (const p of serie ?? []) {
    if (Number.isFinite(p.valor)) out.push([isoData(p.mes), p.valor]);
  }
  return out;
}

/** Série {data, [key]} (poder de compra / transferências) → pontos [iso, valor]. */
export function pontosData(
  serie: ReadonlyArray<Record<string, unknown> & { data: string }> | undefined | null,
  key: string,
): AzSeriesPoint[] {
  const out: AzSeriesPoint[] = [];
  for (const row of serie ?? []) {
    const v = row[key];
    if (typeof v === "number" && Number.isFinite(v)) out.push([isoData(row.data), v]);
  }
  return out;
}

/** Variação do último ponto vs ~12 meses antes (mesmo mês do ano anterior). */
export function delta12m(points: ReadonlyArray<AzSeriesPoint>): number | null {
  if (points.length === 0) return null;
  const [dataUlt, vUlt] = points[points.length - 1];
  const alvo = addMonthsUTC(dataUlt, -12).slice(0, 7);
  const base = points.find(([d]) => d.slice(0, 7) === alvo);
  return base ? +(vUlt - base[1]).toFixed(2) : null;
}

/** Média aritmética dos valores da série (régua de "média histórica"). */
export function mediaPontos(points: ReadonlyArray<AzSeriesPoint>): number | null {
  if (points.length === 0) return null;
  let soma = 0;
  for (const [, v] of points) soma += v;
  return +(soma / points.length).toFixed(2);
}

/** Mín/máx históricos da série, com as datas em que ocorreram. */
export function minMaxPontos(
  points: ReadonlyArray<AzSeriesPoint>,
): { min: number; minData: string; max: number; maxData: string } | null {
  if (points.length === 0) return null;
  let min = points[0][1];
  let minData = points[0][0];
  let max = points[0][1];
  let maxData = points[0][0];
  for (const [d, v] of points) {
    if (v < min) {
      min = v;
      minData = d;
    }
    if (v > max) {
      max = v;
      maxData = d;
    }
  }
  return { min, minData, max, maxData };
}

/** Linha de um merge mensal: { mes: ISO } + aliases numéricos. */
export type LinhaMensal = { mes: string } & Record<string, number | string | null>;

/** Junta várias SeriePonto[] num array de linhas por mês (chave ISO), ordenado. */
export function mergeMensal(
  series: Record<string, SeriePonto[]> | undefined | null,
  keys: ReadonlyArray<{ src: string; alias: string }>,
): LinhaMensal[] {
  const byMes = new Map<string, LinhaMensal>();
  for (const { src, alias } of keys) {
    for (const p of series?.[src] ?? []) {
      if (!Number.isFinite(p.valor)) continue;
      const mes = isoData(p.mes);
      let row = byMes.get(mes);
      if (!row) {
        row = { mes };
        byMes.set(mes, row);
      }
      row[alias] = p.valor;
    }
  }
  return [...byMes.values()].sort((a, b) => (a.mes < b.mes ? -1 : 1));
}

/**
 * Clipa faixas verticais (CODACE, ciclos editoriais) às CHAVES visíveis de um
 * eixo categórico (ISO mensal): ReferenceArea em eixo category exige x1/x2
 * presentes nos dados. Faixas inteiramente fora da janela são omitidas.
 */
export function clipFaixas(faixas: ReadonlyArray<AzXRefArea>, keys: ReadonlyArray<string>): AzXRefArea[] {
  if (keys.length === 0) return [];
  const out: AzXRefArea[] = [];
  for (const f of faixas) {
    if (f.x2 < keys[0] || f.x1 > keys[keys.length - 1]) continue;
    const x1 = keys.find((k) => k >= f.x1) ?? keys[0];
    let x2: string | null = null;
    for (let i = keys.length - 1; i >= 0; i--) {
      if (keys[i] <= f.x2) {
        x2 = keys[i];
        break;
      }
    }
    if (x2 != null && x1 <= x2) out.push({ ...f, x1, x2 });
  }
  return out;
}

/** Primeira chave visível ≥ alvo (p/ ReferenceLine x em eixo categórico). null se fora da janela. */
export function chaveMaisProxima(keys: ReadonlyArray<string>, alvoIso: string): string | null {
  if (keys.length === 0 || alvoIso < keys[0] || alvoIso > keys[keys.length - 1]) return null;
  return keys.find((k) => k >= alvoIso) ?? null;
}

// ---------------------------------------------------------------------------
// Faixas EDITORIAIS declaradas (não são réguas oficiais — repita no footer)
// ---------------------------------------------------------------------------

/** Ciclos de APERTO monetário (alta/platô da Selic) — marcação editorial declarada. */
export const CICLOS_APERTO_SELIC: AzXRefArea[] = [
  { x1: "2013-04-01", x2: "2016-10-01", label: "aperto Selic", color: "#FF5713", opacity: 0.06 },
  { x1: "2021-03-01", x2: "2024-12-01", label: "aperto Selic", color: "#FF5713", opacity: 0.06 },
];

/** Regimes do salário mínimo REAL — leitura editorial declarada da série. */
export const REGIMES_SM: AzXRefArea[] = [
  { x1: "2005-01-01", x2: "2015-12-01", label: "valorização real", color: "#1E8A5C", opacity: 0.05 },
  { x1: "2016-01-01", x2: "2022-12-01", label: "estagnação", color: "#64748B", opacity: 0.07 },
  { x1: "2023-01-01", x2: "2099-12-01", label: "retomada", color: "#027DFC", opacity: 0.05 },
];

// ---------------------------------------------------------------------------
// Leitura segura de campos v2 ainda não declarados no loader
// ---------------------------------------------------------------------------

/**
 * `serie_12m` do bloco IPCA por faixa de renda (acumulado 12m + spread_pp) —
 * campo v2 do builder ainda não tipado em painel-familias.ts. Leitura
 * estrutural sem `any`; [] quando o JSON antigo não o traz.
 */
export function serie12mIpcaFaixa(bloco: FamiliasEstruturaSocialData["bloco_ipca_faixa_renda"]): IpcaFaixaPonto[] {
  const v2 = (bloco as { serie_12m?: IpcaFaixaPonto[] }).serie_12m;
  return Array.isArray(v2) ? v2 : [];
}

// ---------------------------------------------------------------------------
// Chip — destaque numérico pequeno dentro do card (rotativo, BPC pessoas...)
// ---------------------------------------------------------------------------

export function Chip({ label, valor, hint }: { label: string; valor: string; hint?: string }) {
  return (
    <div className="rounded-lg bg-zinc-50 px-3 py-1.5">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">{label}</p>
      <p className="text-sm font-bold tabular-nums text-[#132960]">{valor}</p>
      {hint ? <p className="max-w-[260px] text-[10px] text-zinc-400">{hint}</p> : null}
    </div>
  );
}
