/**
 * Formatadores ÚNICOS pt-BR do site AZ Invest (números, %, R$, datas).
 *
 * Regras da casa:
 * - Vírgula decimal e ponto de milhar sempre (Intl pt-BR).
 * - Sinal explícito em variações: `+2,3%` / `−1,2%` (menos verdadeiro U+2212).
 * - Aritmética de datas 100% UTC (`Date.UTC`) — NUNCA `setMonth`/`getMonth`
 *   locais, que quebram na virada de fuso/horário de verão.
 */

const MINUS = "−"; // − (menos tipográfico, mais legível que o hífen)

const MESES_CURTO = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"] as const;
const MESES_LONGO = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
] as const;

// Cache de Intl.NumberFormat por nº de casas (criar formatter é caro).
const numFmtCache = new Map<string, Intl.NumberFormat>();

function numFmt(minDec: number, maxDec: number): Intl.NumberFormat {
  const key = `${minDec}:${maxDec}`;
  let fmt = numFmtCache.get(key);
  if (!fmt) {
    fmt = new Intl.NumberFormat("pt-BR", {
      minimumFractionDigits: minDec,
      maximumFractionDigits: maxDec,
    });
    numFmtCache.set(key, fmt);
  }
  return fmt;
}

// ---------------------------------------------------------------------------
// Números
// ---------------------------------------------------------------------------

/**
 * Número pt-BR ("1.234,56"). `dec` fixa as casas decimais; sem `dec`,
 * usa até 2 casas (sem zeros à direita). `null`/`NaN` viram "—".
 */
export function fmtNum(v: number | null | undefined, dec?: number): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return dec == null ? numFmt(0, 2).format(v) : numFmt(dec, dec).format(v);
}

/** Número com sinal explícito: "+1.234,5" / "−2,0" (zero sem sinal). P/ deltas absolutos e células de heatmap. */
export function fmtSignedNum(v: number | null | undefined, dec?: number): string {
  if (v == null || !Number.isFinite(v)) return "—";
  const body = fmtNum(Math.abs(v), dec);
  if (v > 0) return `+${body}`;
  if (v < 0) return `${MINUS}${body}`;
  return body;
}

/** Percentual pt-BR sem sinal: "12,3%". O valor já vem em pontos percentuais (12.3 → "12,3%"). */
export function fmtPct(v: number | null | undefined, dec = 1): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${fmtNum(v, dec)}%`;
}

/** Variação percentual com sinal explícito: "+2,3%" / "−1,2%" (zero sem sinal). Use em todo delta. */
export function fmtSignedPct(v: number | null | undefined, dec = 1): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${fmtSignedNum(v, dec)}%`;
}

/** Moeda: "R$ 1.234,56". `dec` default 2. */
export function fmtBRL(v: number | null | undefined, dec = 2): string {
  if (v == null || !Number.isFinite(v)) return "—";
  const body = fmtNum(Math.abs(v), dec);
  const sign = v < 0 ? MINUS : "";
  return `${sign}R$ ${body}`;
}

// ---------------------------------------------------------------------------
// Aritmética de datas — 100% UTC
// ---------------------------------------------------------------------------

const DAY_MS = 86_400_000;

/** Partes UTC de um ISO "YYYY-MM-DD" (ou "YYYY-MM", dia=1; ou ISO completo com hora). */
function isoParts(iso: string): { y: number; m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})(?:-(\d{2}))?/.exec(iso);
  if (!m) return null;
  return { y: Number(m[1]), m: Number(m[2]), d: m[3] ? Number(m[3]) : 1 };
}

/** Timestamp UTC (ms) da meia-noite UTC de um ISO "YYYY-MM-DD" / "YYYY-MM". NaN se inválido. */
export function parseIsoUTC(iso: string): number {
  const p = isoParts(iso);
  if (!p) return NaN;
  return Date.UTC(p.y, p.m - 1, p.d);
}

/** ISO "YYYY-MM-DD" a partir de um timestamp UTC (ms). */
export function isoFromUTC(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Soma `n` dias (UTC) a um ISO. */
export function addDaysUTC(iso: string, n: number): string {
  return isoFromUTC(parseIsoUTC(iso) + n * DAY_MS);
}

/**
 * Soma `n` meses (UTC) com clamp de fim de mês (31/jan − 1 mês ⇒ 31/dez;
 * 31/mar − 1 mês ⇒ 28/fev). Substitui qualquer `setMonth` local.
 */
export function addMonthsUTC(iso: string, n: number): string {
  const p = isoParts(iso);
  if (!p) return iso;
  const total = p.y * 12 + (p.m - 1) + n;
  const y = Math.floor(total / 12);
  const m = total - y * 12; // 0-11
  const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return isoFromUTC(Date.UTC(y, m, Math.min(p.d, lastDay)));
}

/** Soma `n` anos (UTC) com clamp (29/fev → 28/fev). */
export function addYearsUTC(iso: string, n: number): string {
  return addMonthsUTC(iso, n * 12);
}

/** Diferença `b − a` em dias corridos (UTC). */
export function diffDaysUTC(aIso: string, bIso: string): number {
  return Math.round((parseIsoUTC(bIso) - parseIsoUTC(aIso)) / DAY_MS);
}

// ---------------------------------------------------------------------------
// Datas formatadas
// ---------------------------------------------------------------------------

/** Mês curto: "2026-05" ou "2026-05-31" → "mai/26". */
export function fmtMesCurto(iso: string): string {
  const p = isoParts(iso);
  if (!p || p.m < 1 || p.m > 12) return iso;
  return `${MESES_CURTO[p.m - 1]}/${String(p.y).slice(2)}`;
}

/** Mês longo: "2026-05" → "maio/2026". */
export function fmtMesLongo(iso: string): string {
  const p = isoParts(iso);
  if (!p || p.m < 1 || p.m > 12) return iso;
  return `${MESES_LONGO[p.m - 1]}/${p.y}`;
}

/** Trimestre: "2026-T1" (formato do pipeline) → "1T26". Devolve a entrada se não casar. */
export function fmtTrim(s: string): string {
  const m = /^(\d{4})-T(\d)$/.exec(s);
  if (!m) return s;
  return `${m[2]}T${m[1].slice(2)}`;
}

/** Data completa: "2026-06-11" → "11/06/2026" (parse UTC, sem deslocamento de fuso). */
export function fmtDataBR(iso: string): string {
  const p = isoParts(iso);
  if (!p) return iso;
  const dd = String(p.d).padStart(2, "0");
  const mm = String(p.m).padStart(2, "0");
  return `${dd}/${mm}/${p.y}`;
}

/**
 * Formato ADAPTATIVO de tick de eixo temporal pela janela visível:
 * ≤180 dias → "dd/mm" · ≤730 dias → "mai/26" · acima → "2026".
 * `spanDays` = dias corridos entre o 1º e o último ponto plotado.
 */
export function formatAxisDate(dateIso: string, spanDays: number): string {
  const p = isoParts(dateIso);
  if (!p) return dateIso;
  if (spanDays <= 180) {
    return `${String(p.d).padStart(2, "0")}/${String(p.m).padStart(2, "0")}`;
  }
  if (spanDays <= 730) return fmtMesCurto(dateIso);
  return String(p.y);
}

/**
 * Ticks ANCORADOS de eixo temporal — devolve o array explícito de datas ISO
 * onde o eixo deve marcar, em vez de deixar o Recharts escolher posições
 * "bonitas" no meio do mês (que geravam labels repetidos: "jul/25 jul/25").
 *
 * Regra por janela (`spanDays` = dias corridos entre 1º e último ponto):
 * - > 730d  → 1º de janeiro de cada ano (rotule "2026"), com passo p/ ≤ ~10;
 * - ≤ 730d  → viradas de mês (rotule "mmm/aa"), com passo p/ ≤ ~9 ticks;
 * - ≤ 180d com menos de 3 viradas de mês na janela (ex.: 1M) → âncora em
 *   datas REAIS da série (~6 ticks, rotule "dd/mm").
 *
 * Sempre rotule com `formatTimeTickLabel` (mesma âncora ⇒ zero labels
 * repetidos consecutivos). `dates` não precisa vir ordenado nem único.
 */
export function buildTimeTicks(dates: string[], spanDays: number): string[] {
  const sorted = [...new Set(dates)].filter((d) => Number.isFinite(parseIsoUTC(d))).sort();
  if (sorted.length <= 2) return sorted;
  const first = sorted[0];
  const last = sorted[sorted.length - 1];

  // Janela longa: janeiro de cada ano dentro do range.
  if (spanDays > 730) {
    const years: string[] = [];
    for (let y = Number(first.slice(0, 4)); y <= Number(last.slice(0, 4)); y++) {
      const iso = `${y}-01-01`;
      if (iso >= first && iso <= last) years.push(iso);
    }
    if (years.length === 0) return [first, last];
    const step = Math.max(1, Math.ceil(years.length / 10));
    return years.filter((_, i) => i % step === 0);
  }

  // Viradas de mês dentro do range (inclui o 1º dia se a série começa nele).
  const monthStarts: string[] = [];
  let cursor = `${first.slice(0, 7)}-01`;
  if (cursor < first) cursor = addMonthsUTC(cursor, 1);
  while (cursor <= last) {
    monthStarts.push(cursor);
    cursor = addMonthsUTC(cursor, 1);
  }

  // Janela curta sem viradas suficientes (1M/3M no limite): ancora em dias
  // reais da série — dd/mm distintos, sem duplicata possível em ≤180d.
  if (spanDays <= 180 && monthStarts.length < 3) {
    const step = Math.max(1, Math.round((sorted.length - 1) / 5));
    const ticks: string[] = [];
    for (let i = 0; i < sorted.length; i += step) ticks.push(sorted[i]);
    return ticks;
  }

  if (monthStarts.length === 0) return [first, last];
  const step = Math.max(1, Math.ceil(monthStarts.length / 9));
  return monthStarts.filter((_, i) => i % step === 0);
}

/**
 * Rótulo do tick gerado por `buildTimeTicks`: "2026" em janelas > 730d;
 * senão "mmm/aa" nas viradas de mês (dia 1) e "dd/mm" nas âncoras diárias
 * de janela curta. Âncoras distintas ⇒ labels distintos (sem "jul/25 jul/25").
 */
export function formatTimeTickLabel(dateIso: string, spanDays: number): string {
  const p = isoParts(dateIso);
  if (!p) return dateIso;
  if (spanDays > 730) return String(p.y);
  if (p.d === 1) return fmtMesCurto(dateIso);
  return `${String(p.d).padStart(2, "0")}/${String(p.m).padStart(2, "0")}`;
}
