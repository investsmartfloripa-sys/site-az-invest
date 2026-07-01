/**
 * Política monetária implícita a partir de FUTUROS de juros de curto prazo —
 * o mesmo princípio do Brasil (curva DI da B3 → Selic implícita): os contratos
 * de derivativos de cada vencimento são a precificação de mercado, em tempo real,
 * da trajetória esperada da taxa overnight. Aqui usamos as tiras públicas do
 * Yahoo Finance (server-side; ~15 min de atraso, como o feed da B3):
 *
 *   - EUA (Fed):  Fed Funds futures de 30 dias (CBOT `ZQ{M}{YY}.CBT`) — MENSAL.
 *                 Cada contrato liquida pela MÉDIA da EFFR no mês ⇒ dá p/ isolar
 *                 a taxa esperada APÓS cada reunião do FOMC (método CME FedWatch).
 *   - Zona euro (BCE): €STR futures (CME `ESR{M}{YY}.CME`) — TRIMESTRAL (IMM).
 *                 A €STR É a taxa que o BCE mira (≈ depo), sem o spread Euribor-OIS.
 *   - Japão (BoJ): 3-Month TONA futures (`TONA-{M}{YY}.SI`) — TRIMESTRAL (IMM).
 *
 * Os contratos trimestrais (€STR/TONA) dão a trajetória forward da overnight em
 * granularidade TRIMESTRAL (não reunião-a-reunião); os mensais (Fed Funds) dão
 * granularidade de reunião. Convenção universal: taxa implícita = 100 − preço.
 */

import type { PolicySegment } from "@/lib/global-rates";

/** Códigos de mês de futuros (jan..dez). */
export const MONTH_CODES = ["F", "G", "H", "J", "K", "M", "N", "Q", "U", "V", "X", "Z"] as const;
/** Meses do ciclo trimestral IMM (mar/jun/set/dez). */
export const QUARTERLY_MONTHS = [3, 6, 9, 12] as const;

const DAY_MS = 86_400_000;
const YEAR_DAYS = 365.2425;

function isoToUTC(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, (m ?? 1) - 1, d ?? 1);
}
function utcToISO(t: number): string {
  return new Date(t).toISOString().slice(0, 10);
}
function daysInMonth(year: number, month1: number): number {
  return new Date(Date.UTC(year, month1, 0)).getUTCDate();
}

/** Símbolo Yahoo de um contrato (root + código do mês + ano 2 dígitos + sufixo). */
export function futuresSymbol(root: string, year: number, month1: number, suffix: string, sep = ""): string {
  return `${root}${sep}${MONTH_CODES[month1 - 1]}${String(year).slice(2)}.${suffix}`;
}

/** Próximos `count` meses (a partir de year/month1 inclusive). */
export function monthlySchedule(year: number, month1: number, count: number): { year: number; month: number }[] {
  const out: { year: number; month: number }[] = [];
  let y = year;
  let m = month1;
  for (let i = 0; i < count; i++) {
    out.push({ year: y, month: m });
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  return out;
}

/** Próximos `count` vencimentos trimestrais (mar/jun/set/dez) ≥ (year, month1). */
export function quarterlySchedule(year: number, month1: number, count: number): { year: number; month: number }[] {
  // Primeiro mês trimestral >= month1.
  let m = QUARTERLY_MONTHS.find((q) => q >= month1) ?? 3;
  let y = m >= month1 ? year : year + 1;
  if (!QUARTERLY_MONTHS.includes(m as 3 | 6 | 9 | 12)) {
    m = 3;
    y = year + 1;
  }
  const out: { year: number; month: number }[] = [];
  let idx = QUARTERLY_MONTHS.indexOf(m as 3 | 6 | 9 | 12);
  for (let i = 0; i < count; i++) {
    out.push({ year: y, month: QUARTERLY_MONTHS[idx] });
    idx++;
    if (idx >= QUARTERLY_MONTHS.length) {
      idx = 0;
      y++;
    }
  }
  return out;
}

/** 3ª quarta-feira do mês (data IMM) em ISO. */
export function immDateISO(year: number, month1: number): string {
  // 1º dia do mês: dia da semana (0=dom..6=sáb). 1ª quarta = (3 - wd + 7) % 7 + 1.
  const first = new Date(Date.UTC(year, month1 - 1, 1)).getUTCDay();
  const firstWed = ((3 - first + 7) % 7) + 1;
  const thirdWed = firstWed + 14;
  return utcToISO(Date.UTC(year, month1 - 1, thirdWed));
}

export type FuturesQuote = {
  symbol: string;
  year: number;
  month: number;
  price: number;
  /** Taxa implícita = 100 − preço (% a.a.). */
  rate: number;
};

// ---------------------------------------------------------------------------
// Calendários de reunião (p/ linhas verticais de contexto)
// ---------------------------------------------------------------------------

/** Datas de decisão do FOMC (2º dia). Mesmo conjunto do pipeline R. */
export const FOMC_DECISION_DATES: readonly string[] = [
  "2026-01-28", "2026-03-18", "2026-04-29", "2026-06-17",
  "2026-07-29", "2026-09-16", "2026-10-28", "2026-12-09",
  "2027-01-27", "2027-03-17", "2027-04-28", "2027-06-09",
  "2027-07-28", "2027-09-15", "2027-10-27", "2027-12-08",
] as const;

/** Datas de decisão do BoJ (2º dia). 2026 oficial; 2027 ESTIMADO (cadência usual,
 *  o BoJ ainda não publicou) — usado só p/ estender o horizonte da implícita. */
export const BOJ_DECISION_DATES: readonly string[] = [
  "2026-01-23", "2026-03-19", "2026-04-28", "2026-06-16",
  "2026-07-31", "2026-09-18", "2026-10-30", "2026-12-18",
  "2027-01-22", "2027-03-12", "2027-04-28", "2027-06-16",
  "2027-07-30", "2027-09-17", "2027-10-28", "2027-12-17",
] as const;

/** Datas de anúncio do BoE (MPC, quinta-feira) — calendário 2026-2027. */
export const BOE_DECISION_DATES: readonly string[] = [
  "2026-02-05", "2026-03-19", "2026-04-30", "2026-06-18",
  "2026-07-30", "2026-09-17", "2026-11-05", "2026-12-17",
  "2027-02-04", "2027-03-18", "2027-04-29", "2027-06-17",
  "2027-07-29", "2027-09-16", "2027-11-04", "2027-12-16",
] as const;

// ---------------------------------------------------------------------------
// Fed Funds (mensal) → trajetória reunião-a-reunião (CME FedWatch)
// ---------------------------------------------------------------------------

/**
 * Trajetória implícita do Fed a partir da tira de Fed Funds futures (mensal).
 * Cada contrato do mês m liquida pela MÉDIA da EFFR no mês ⇒ a taxa de política
 * (escada que muda só nas reuniões) tem média mensal igual à do contrato. Meses
 * SEM reunião re-ancoram o nível (média = nível vigente); meses COM reunião
 * isolam o degrau pós-decisão: média = [(d−1)·nível_entra + (N−d+1)·nível_pós]/N.
 * Resolve a partir do 1º mês limpo, propagando p/ frente e p/ trás. Sem
 * arredondamento (a implícita é uma EXPECTATIVA ponderada, não um corte único).
 */
export function fedFundsImpliedPath(
  quotes: FuturesQuote[],
  fomcDates: readonly string[] = FOMC_DECISION_DATES,
  refISO?: string,
): PolicySegment[] {
  const strip = quotes
    .filter((q) => Number.isFinite(q.rate))
    .slice()
    .sort((a, b) => a.year - b.year || a.month - b.month);
  if (strip.length < 2) return [];

  const N = strip.map((s) => daysInMonth(s.year, s.month));
  const meetingsIn = (y: number, m: number): number[] =>
    fomcDates
      .filter((d) => {
        const [Y, M] = d.split("-").map(Number);
        return Y === y && M === m;
      })
      .map((d) => Number(d.split("-")[2]))
      .sort((a, b) => a - b);
  const mts = strip.map((s) => meetingsIn(s.year, s.month));

  let anchor = strip.findIndex((_, i) => mts[i].length === 0);
  if (anchor < 0) anchor = 0;
  const levelInto = new Array<number | null>(strip.length).fill(null);
  levelInto[anchor] = strip[anchor].rate;

  // Forward
  let lvl = levelInto[anchor]!;
  for (let i = anchor; i < strip.length; i++) {
    levelInto[i] = lvl;
    if (mts[i].length === 0) {
      lvl = strip[i].rate;
      levelInto[i] = lvl;
      continue;
    }
    const d = mts[i][0];
    lvl = (strip[i].rate * N[i] - lvl * (d - 1)) / (N[i] - d + 1);
  }
  // Backward (nível entrando antes da âncora)
  lvl = levelInto[anchor]!;
  for (let i = anchor - 1; i >= 0; i--) {
    if (mts[i].length === 0) {
      lvl = strip[i].rate;
      levelInto[i] = lvl;
      continue;
    }
    const d = mts[i][0];
    lvl = (strip[i].rate * N[i] - lvl * (N[i] - d + 1)) / (d - 1);
    levelInto[i] = lvl;
  }

  const ref = refISO ?? utcToISO(isoToUTC(`${strip[0].year}-${String(strip[0].month).padStart(2, "0")}-01`));
  const segs: PolicySegment[] = [{ fromISO: ref, level: round3(levelInto[0]!) }];
  for (let i = 0; i < strip.length; i++) {
    if (mts[i].length === 0) continue;
    const d = mts[i][0];
    const entering = levelInto[i]!;
    const post = (strip[i].rate * N[i] - entering * (d - 1)) / (N[i] - d + 1);
    const iso = `${strip[i].year}-${String(strip[i].month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    segs.push({ fromISO: iso, level: round3(post) });
  }
  // Clipa qualquer reunião já passada (a tira pode incluir o mês corrente).
  return dedupSegments(segs).filter((s) => s.fromISO >= ref);
}

// ---------------------------------------------------------------------------
// Contratos trimestrais (€STR / TONA / SOFR-3M) → trajetória forward trimestral
// ---------------------------------------------------------------------------

/**
 * Trajetória forward da overnight a partir de uma tira de futuros TRIMESTRAIS
 * (3M IMM): cada contrato do vencimento m precifica a média da overnight no
 * trimestre que COMEÇA na data IMM de m. Logo a taxa do contrato vale como nível
 * forward a partir de IMM(m). Degrau trimestral; o 1º começa em `refISO`.
 */
export function quarterlyForwardPath(quotes: FuturesQuote[], refISO: string): PolicySegment[] {
  const strip = quotes
    .filter((q) => Number.isFinite(q.rate))
    .slice()
    .sort((a, b) => a.year - b.year || a.month - b.month);
  if (strip.length === 0) return [];
  const segs: PolicySegment[] = strip.map((q, i) => {
    const imm = immDateISO(q.year, q.month);
    const fromISO = i === 0 || imm < refISO ? refISO : imm;
    return { fromISO, level: round3(q.rate) };
  });
  return dedupSegments(segs);
}

// ---------------------------------------------------------------------------
// Util
// ---------------------------------------------------------------------------

function round3(x: number): number {
  return Math.round(x * 1000) / 1000;
}

/** Remove segmentos com o MESMO fromISO (mantém o último) e ordena. */
function dedupSegments(segs: PolicySegment[]): PolicySegment[] {
  const byDate = new Map<string, number>();
  for (const s of segs) byDate.set(s.fromISO, s.level);
  return [...byDate.entries()]
    .map(([fromISO, level]) => ({ fromISO, level }))
    .sort((a, b) => (a.fromISO < b.fromISO ? -1 : 1));
}

/** Horizonte (anos) a partir de `refISO` da última reunião/segmento — p/ clipar o eixo. */
export function segmentsHorizonISO(segs: PolicySegment[], extraDays = 30): string | null {
  if (segs.length === 0) return null;
  const last = segs[segs.length - 1].fromISO;
  return utcToISO(isoToUTC(last) + extraDays * DAY_MS);
}

/** Anos corridos entre duas datas (p/ checagens). */
export function yearsBetweenISO(a: string, b: string): number {
  return (isoToUTC(b) - isoToUTC(a)) / (YEAR_DAYS * DAY_MS);
}
