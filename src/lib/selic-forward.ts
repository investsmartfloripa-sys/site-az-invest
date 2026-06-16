/**
 * Selic implícita D+0 — modelo forward reunião-a-reunião do COPOM calculado no
 * NAVEGADOR a partir da curva DI ao vivo da B3, replicando exatamente o pipeline
 * R (build_selic_implicita.R):
 *   - curva PRE: cada vértice tem DU (dias úteis) e taxa 252 → df = 1/(1+r)^(du/252);
 *   - grade = [hoje, reuniões COPOM na janela de 1 ano, hoje+1ano];
 *   - cada data da grade "encosta" (snap) no contrato com vencimento MAIS PRÓXIMO;
 *     dedup por DU; forward entre vértices consecutivos
 *     fwd = (df_i/df_{i+1})^(252/(du_{i+1}-du_i)) − 1;
 *   - arredondado ao 0,25% MAIS PRÓXIMO (round nearest).
 *
 * O feed intraday da B3 não traz o DU, só a data de vencimento — por isso
 * carregamos o calendário de feriados ANBIMA/B3 (nacionais + móveis via Páscoa)
 * para contar dias úteis. Validado em produção reproduzindo a coluna "Recente"
 * (D-1) do pipeline a partir do ajuste anterior (prevAdjust) — bate em todas as
 * reuniões. Mantenha COPOM_DECISION_DATES em dia com o calendário oficial
 * (mesma lista do R).
 */

const DAY = 86_400_000;

/** Domingo de Páscoa (Gregoriano, algoritmo de Meeus/Butcher) em ms UTC. */
function easterUTC(year: number): number {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return Date.UTC(year, month - 1, day);
}

const holidayCache = new Map<number, Set<number>>();

/** Feriados nacionais (DU ANBIMA/B3) do ano: fixos + móveis derivados da Páscoa. */
function holidaysForYear(year: number): Set<number> {
  const cached = holidayCache.get(year);
  if (cached) return cached;
  const set = new Set<number>();
  // Fixos: Confraternização, Tiradentes, Trabalho, Independência, Aparecida,
  // Finados, Proclamação, Consciência Negra (nacional desde 2024), Natal.
  const fixed: [number, number][] = [
    [0, 1],
    [3, 21],
    [4, 1],
    [8, 7],
    [9, 12],
    [10, 2],
    [10, 15],
    [10, 20],
    [11, 25],
  ];
  for (const [mo, da] of fixed) set.add(Date.UTC(year, mo, da));
  // Móveis: Carnaval (seg/ter = Páscoa−48/−47), Sexta-feira Santa (−2), Corpus Christi (+60).
  const e = easterUTC(year);
  for (const off of [-48, -47, -2, 60]) {
    const dt = new Date(e + off * DAY);
    set.add(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate()));
  }
  holidayCache.set(year, set);
  return set;
}

function isBusinessDay(t: number): boolean {
  const wd = new Date(t).getUTCDay();
  if (wd === 0 || wd === 6) return false;
  return !holidaysForYear(new Date(t).getUTCFullYear()).has(t);
}

/** Dias úteis entre `from` (exclusivo) e `to` (inclusivo) — convenção do DU 252. */
function businessDays(fromT: number, toT: number): number {
  if (toT <= fromT) return 0;
  let n = 0;
  for (let t = fromT + DAY; t <= toT; t += DAY) if (isBusinessDay(t)) n++;
  return n;
}

function isoToUTC(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, (m ?? 1) - 1, d ?? 1);
}

function utcToISO(t: number): string {
  return new Date(t).toISOString().slice(0, 10);
}

/** Arredonda ao passo de 0,25% MAIS PRÓXIMO (não para cima; em fração: 0.0025). */
function roundStep(x: number, step = 0.0025): number {
  return Math.round(x / step) * step;
}

/**
 * Datas de decisão do COPOM (mesma lista do build_selic_implicita.R).
 * Atualize quando o BC divulgar o calendário do ano seguinte.
 */
export const COPOM_DECISION_DATES: string[] = [
  "2026-01-28",
  "2026-03-18",
  "2026-04-29",
  "2026-06-17",
  "2026-08-05",
  "2026-09-16",
  "2026-11-04",
  "2026-12-09",
  "2027-01-27",
  "2027-03-17",
  "2027-04-28",
  "2027-06-16",
];

export type CurvePoint = { maturity: string; rate: number | null };
/** `level` em PERCENTUAL ao ano (ex.: 14.25), para casar com o resto do painel. */
export type SelicSegment = { fromISO: string; level: number };

/**
 * Caminho forward da Selic implícita (degraus por período entre reuniões) a
 * partir de uma curva PRE (vértices com vencimento + taxa 252) e a data de
 * referência. Retorna os segmentos como `{ fromISO, level }` já arredondados.
 * Vazio se a curva for insuficiente.
 *
 * METODOLOGIA — interpolação, NÃO snapping. O pipeline R (build_selic_implicita.R)
 * usa a curva PRE OFICIAL da B3 (TaxaSwap), que é DENSA (um vértice por dia útil);
 * lá "encostar a reunião no vértice mais próximo" pega o df praticamente NA data
 * da reunião. A curva DI ao vivo só tem os FUTUROS (mensais → anuais), esparsa: o
 * snapping jogaria a reunião num contrato a até ~2 semanas e calcularia o forward
 * sobre vãos de DU errados, gerando zig-zag. Por isso aqui interpolamos a função
 * de desconto (ln df linear em DU = forward constante entre vértices, padrão
 * ANBIMA/B3) e avaliamos o df na data EXATA de cada reunião. Forward de cada
 * período entre reuniões consecutivas: fwd = (df_k/df_{k+1})^(252/Δdu) − 1,
 * arredondado ao 0,25% MAIS PRÓXIMO (round nearest).
 */
export type TermPremiumCfg = {
  /** Ajuste máximo a 1 ano, em fração (ex.: 0.0025 = 25 bps). */
  maxFrac: number;
  /** Multiplicador de regime (vol do dia / vol de referência), já clampado. */
  volMult: number;
  /** Expoente da forma no prazo: 1 = linear (50% no 6m), 2 = quadrática (25% no
   *  6m, mais peso na cauda). Default 2. */
  shapeExp?: number;
  /** Joelho: fração de 1 ano em que a rampa começa (prêmio = 0 antes disso).
   *  Ex.: 0.25 = 3 meses. Default 0. */
  kneeFrac?: number;
};

/**
 * Parâmetros do ajuste de prêmio de prazo — ÚNICA fonte (D+0 ao vivo e séries
 * históricas D-90/D-30/D-1 usam estes mesmos valores, garantindo o MESMO vetor).
 * Calibre aqui. `volMult` NÃO está aqui (vem do percentil de vol do IRF-M, por
 * série/dia). `clamp` é o piso/teto do multiplicador.
 */
export const SELIC_TERM_PREMIUM = {
  baseBps: 25,
  shapeExp: 1, // 1 = linear (rampa uniforme do joelho a 12m); 2 = quadrática (back-loaded).
  kneeFrac: 0.25,
  clamp: [0.5, 2] as [number, number],
};

/** Fração subtraída do forward bruto na reunião com DU `du` (0 antes do joelho). */
function premiumFrac(du: number, du1y: number, cfg: TermPremiumCfg): number {
  if (du <= 0) return 0;
  const knee = cfg.kneeFrac ?? 0;
  const ramp = Math.max(0, (du / du1y - knee) / (1 - knee));
  return cfg.maxFrac * ramp ** (cfg.shapeExp ?? 2) * cfg.volMult;
}

export function selicForwardPath(
  curve: CurvePoint[],
  refdateISO: string,
  copomDates: string[] = COPOM_DECISION_DATES,
  // EXPERIMENTAL — prêmio de prazo. Subtrai do forward BRUTO (antes do
  // arredondamento) um wedge crescente: forma QUADRÁTICA no prazo (0 no curto →
  // maxFrac·volMult a 1 ano). volMult deixa a vol do dia empurrar o ajuste pra
  // cima/baixo da base. Sem isto, a cauda longa lê o forward como expectativa e
  // fica viesada pra cima (term premium embutido).
  termPremium?: TermPremiumCfg,
): SelicSegment[] {
  const refT = isoToUTC(refdateISO);
  // Vértices (DU, ln df) a partir da curva. ln df = −(du/252)·ln(1+r).
  const pts = curve
    .map((c) => {
      if (c.rate == null || !Number.isFinite(c.rate)) return null;
      const du = businessDays(refT, isoToUTC(c.maturity));
      if (du <= 0) return null;
      return { du, lndf: -(du / 252) * Math.log(1 + c.rate / 100) };
    })
    .filter((p): p is { du: number; lndf: number } => p != null);
  if (pts.length < 2) return [];
  // Âncora hoje: DU=0, df=1 (ln df=0) — ancora o forward do trecho vigente.
  pts.push({ du: 0, lndf: 0 });
  pts.sort((a, b) => a.du - b.du);
  const seenDu = new Set<number>();
  const verts = pts.filter((p) => (seenDu.has(p.du) ? false : (seenDu.add(p.du), true)));

  // Interpolação flat-forward: ln df linear em DU (forward constante entre
  // vértices). Avalia o df numa data qualquer — inclusive na data da reunião.
  const lndfAt = (du: number): number => {
    if (du <= verts[0].du) return verts[0].lndf;
    for (let i = 0; i < verts.length - 1; i++) {
      const a = verts[i];
      const b = verts[i + 1];
      if (du <= b.du) {
        const w = (du - a.du) / (b.du - a.du);
        return a.lndf + w * (b.lndf - a.lndf);
      }
    }
    // Extrapola flat-forward além do último vértice (mesmo forward do último tramo).
    const a = verts[verts.length - 2];
    const b = verts[verts.length - 1];
    const slope = (b.lndf - a.lndf) / (b.du - a.du);
    return b.lndf + slope * (du - b.du);
  };

  const chartEnd = refT + 365 * DAY;
  const du1y = businessDays(refT, chartEnd) || 252;
  const grid = Array.from(
    new Set([refT, ...copomDates.map(isoToUTC).filter((t) => t >= refT && t <= chartEnd), chartEnd]),
  )
    .sort((a, b) => a - b)
    .map((t) => ({ t, du: businessDays(refT, t) }));
  // Dedup por DU (reuniões que caem no mesmo dia útil colapsam).
  const seenG = new Set<number>();
  const gg = grid.filter((g) => (seenG.has(g.du) ? false : (seenG.add(g.du), true)));

  const segs: SelicSegment[] = [];
  for (let i = 0; i < gg.length - 1; i++) {
    const a = gg[i];
    const b = gg[i + 1];
    if (b.du <= a.du) continue;
    // Forward sobre o período EXATO entre as duas reuniões (df interpolado).
    let fwd = Math.exp(((lndfAt(a.du) - lndfAt(b.du)) * 252) / (b.du - a.du)) - 1;
    if (!Number.isFinite(fwd)) continue;
    // Prêmio de prazo (experimental): tira o wedge crescente da cauda ANTES de
    // arredondar — mesma fórmula (premiumFrac) das séries históricas.
    if (termPremium) fwd -= premiumFrac(a.du, du1y, termPremium);
    // Fração arredondada ao passo de 0,25% → PERCENTUAL (ex.: 0.1425 → 14.25).
    segs.push({ fromISO: utcToISO(a.t), level: Math.round(roundStep(fwd) * 10000) / 100 });
  }
  return segs;
}

/** Nível do degrau que cobre `dateISO` (função escada). null se antes do 1º. */
export function selicLevelAt(segs: SelicSegment[], dateISO: string): number | null {
  let level: number | null = null;
  for (const s of segs) {
    if (s.fromISO <= dateISO) level = s.level;
    else break;
  }
  return level;
}

/**
 * Aplica o prêmio de prazo a um forward BRUTO (em PERCENTUAL, ex.: 13.68) de uma
 * reunião e retorna o nível arredondado a 0,25% (em PERCENTUAL, ex.: 13.50). Usa
 * o MESMO `premiumFrac` do D+0, então as séries históricas (D-90/D-30/D-1) ficam
 * ajustadas com o mesmo vetor. `refdateISO` = hoje (a forma é horizonte-a-partir-
 * de-hoje, igual para todas as séries → desloca todas pelo mesmo vetor).
 */
export function termPremiumLevel(
  rawPct: number,
  meetingISO: string,
  refdateISO: string,
  cfg: TermPremiumCfg,
): number {
  const refT = isoToUTC(refdateISO);
  const du = businessDays(refT, isoToUTC(meetingISO));
  const du1y = businessDays(refT, refT + 365 * DAY) || 252;
  const frac = rawPct / 100 - premiumFrac(du, du1y, cfg);
  return Math.round(roundStep(frac) * 10000) / 100;
}
