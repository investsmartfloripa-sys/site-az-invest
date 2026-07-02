/**
 * Juros soberanos internacionais — tipos, config de países e modelo de política
 * monetária implícita (forward reunião-a-reunião), compartilhados entre o
 * servidor (fetchers em `global-rates-server.ts` + route handlers) e o cliente
 * (panes do Panorama + comparador "Juros Globais").
 *
 * PREMISSA DE DADOS: só entram países com curva soberana DIÁRIA reproduzível de
 * fonte pública gratuita (testadas e acessíveis deste ambiente):
 *   - EUA (us)        — já coberto pelo pipeline (Treasury/FRED); aqui só p/ o
 *                       comparador histórico (FRED keyless: DGS2/5/10/20/30).
 *   - Japão (jp)      — MOF (JGB CME, CSV diário 1Y..40Y).
 *   - Alemanha (de)   — Deutsche Bundesbank (Zinsstrukturkurve Svensson, 1..30a).
 *   - Reino Unido (gb)— Bank of England (gilts, par yields nominais 5/10/20a).
 *
 * França e China foram DESCARTADAS: não há curva diária completa gratuita
 * reproduzível (BdF/FRED só mensal p/ França; sem CGB diária livre p/ China) e,
 * no caso da França, a política implícita seria a do BCE — idêntica à Alemanha.
 *
 * POLÍTICA IMPLÍCITA: só onde há ponta CURTA livre o suficiente p/ resolver os
 * períodos entre reuniões — EUA (Fed, via pipeline) e Alemanha/zona do euro
 * (BCE, via curva curta AAA do ECB). Japão e Reino Unido ficam só com a CURVA
 * (MOF começa em 1Y; BoE só publica par yields longos), sem ponta curta gratuita.
 */

// ---------------------------------------------------------------------------
// Países
// ---------------------------------------------------------------------------

/**
 * Países com curva diária. "br" e "cn" vêm de PIPELINE+Blob (ANBIMA/Tesouro e
 * ChinaBond, respectivamente), os demais de fetch ao vivo; no Panorama o
 * Brasil usa a trilha própria intraday da B3 (o "br" daqui serve ao
 * comparador histórico).
 */
export type GlobalCountryId = "br" | "us" | "jp" | "de" | "gb" | "co" | "cl" | "cn";

export type CountryPolicy = {
  /** Banco central (ex.: "Fed", "BCE", "BoJ"). */
  bank: string;
  /** Nome curto da implícita exibido na aba (ex.: "Fed implícita"). */
  label: string;
};

export type GlobalCountry = {
  id: GlobalCountryId;
  /** Código ISO-3166 alpha-2 minúsculo p/ a bandeira (flagcdn.com). */
  flag: string;
  /** Nome em pt-BR (ex.: "Alemanha"). */
  name: string;
  /** Rótulo da curva (ex.: "Treasury", "JGB", "Bund", "Gilt"). */
  curveLabel: string;
  /** Fonte exibida no rodapé. */
  source: string;
  /** Config da política monetária implícita — ausente onde não há ponta curta. */
  policy?: CountryPolicy;
};

/**
 * Catálogo dos países internacionais. A ordem define a ordem dos botões de
 * bandeira (o Brasil é injetado à frente pelo componente do Panorama).
 */
export const GLOBAL_COUNTRIES: readonly GlobalCountry[] = [
  {
    id: "br",
    flag: "br",
    name: "Brasil",
    curveLabel: "Pré",
    source: "ANBIMA (ETTJ) / Tesouro Direto",
  },
  {
    id: "us",
    flag: "us",
    name: "EUA",
    curveLabel: "Treasury",
    source: "FRED / Tesouro EUA",
    policy: { bank: "Fed", label: "Fed implícita" },
  },
  {
    id: "jp",
    flag: "jp",
    name: "Japão",
    curveLabel: "JGB",
    source: "Ministério das Finanças do Japão (JGB)",
  },
  {
    id: "de",
    flag: "de",
    name: "Alemanha",
    curveLabel: "Bund",
    source: "Deutsche Bundesbank",
    policy: { bank: "BCE", label: "BCE implícita" },
  },
  {
    id: "gb",
    flag: "gb",
    name: "Reino Unido",
    curveLabel: "Gilt",
    source: "Bank of England",
  },
  {
    id: "co",
    flag: "co",
    name: "Colômbia",
    curveLabel: "TES",
    source: "Banco de la República (TES cero cupón)",
    policy: { bank: "BanRep", label: "BanRep implícita" },
  },
  {
    id: "cl",
    flag: "cl",
    name: "Chile",
    curveLabel: "BCP/BTP",
    source: "Banco Central de Chile (BDE)",
  },
  {
    id: "cn",
    flag: "cn",
    name: "China",
    curveLabel: "CGB",
    source: "ChinaBond (CCDC)",
  },
] as const;

export function countryById(id: string): GlobalCountry | undefined {
  return GLOBAL_COUNTRIES.find((c) => c.id === id);
}

/** Prazos padrão (anos) do comparador "Juros Globais". */
export const COMPARATOR_TENORS = [1, 2, 5, 10, 20, 30] as const;

// ---------------------------------------------------------------------------
// Tipos de payload (rotas /api/global-rates/*)
// ---------------------------------------------------------------------------

/** Ponto de curva por prazo. `years` é o prazo em anos; `rate` em % a.a. */
export type CurvePoint = { years: number; rate: number };

/** Curva soberana de um país com cortes históricos (Agora / D-1 / D-30 / D-90). */
export type CountryCurve = {
  country: GlobalCountryId;
  /** Data de referência da curva corrente (ISO yyyy-mm-dd). */
  asOf: string;
  tenors: CurvePoint[];
  /** Curva do pregão anterior (D-1) p/ a linha tracejada de comparação. */
  prevAsOf?: string;
  prevTenors?: CurvePoint[];
  /** Curva ~30 dias atrás. */
  d30AsOf?: string;
  d30Tenors?: CurvePoint[];
  /** Curva ~90 dias atrás. */
  d90AsOf?: string;
  d90Tenors?: CurvePoint[];
  source: string;
};

/** Série histórica de UM prazo. */
export type TenorHistory = {
  years: number;
  /** Pontos [ISO, taxa %] em ordem crescente de data. */
  points: [string, number][];
};

/** Histórico por prazo de um país (p/ o comparador). */
export type CountryHistory = {
  country: GlobalCountryId;
  asOf: string;
  series: TenorHistory[];
  source: string;
};

/** Segmento da escada de política implícita (de `fromISO` em diante, nível %). */
export type PolicySegment = { fromISO: string; level: number };

/** Nível implícito por reunião/degrau, nas 3 datas de referência (padrão Selic). */
export type PolicyRow = {
  /** Data da reunião/degrau (ISO). */
  date: string;
  /** D+0 (hoje), D-30 (~30d atrás), D-90 (~90d atrás) — % a.a., null se ausente. */
  d0: number | null;
  d30: number | null;
  d90: number | null;
};

/** Resposta de /api/global-rates/[country]. */
export type CountryRatesPayload = {
  country: GlobalCountryId;
  curve: CountryCurve | null;
  /** Implícita (degraus por reunião, com histórico D-30/D-90) — null sem ponta curta. */
  policy: {
    label: string;
    bank: string;
    /** Linhas por reunião/degrau (inclui a âncora "vigente" de hoje na 1ª). */
    rows: PolicyRow[];
    /** Rótulos com data de referência (ex.: "D-30 (30/05/2026)"). */
    labels: { d0: string; d30: string; d90: string };
    /** Datas das reuniões do banco central (ISO) — linhas verticais de contexto. */
    meetings: string[];
    asOf: string;
    note: string;
  } | null;
  error?: string;
};

// ---------------------------------------------------------------------------
// Calendário de reuniões (apenas BCE é novo; Fed/COPOM vivem no pipeline/selic)
// ---------------------------------------------------------------------------

/**
 * Datas de DECISÃO do Conselho do BCE (2º dia / coletiva). Fonte: calendário
 * oficial do BCE. Só importam as FUTURAS (filtradas em tempo de cálculo); manter
 * ~18 meses à frente p/ o último degrau usar a reunião real, não o synthetic.
 */
export const ECB_DECISION_DATES: readonly string[] = [
  "2026-07-23",
  "2026-09-10",
  "2026-10-29",
  "2026-12-17",
  "2027-02-04",
  "2027-03-18",
  "2027-04-29",
  "2027-06-10",
  "2027-09-09",
  "2027-10-28",
  "2027-12-16",
] as const;

/**
 * Datas de DECISÃO de taxa da Junta Directiva do BanRep (Colômbia). 2026 =
 * calendário OFICIAL (8 decisões/ano; as reuniões sem decisão de taxa ficam
 * fora). 2027 = ESTIMADO pelo padrão (fim de mês; atualizar quando o BanRep
 * publicar o calendário oficial).
 */
export const BANREP_DECISION_DATES: readonly string[] = [
  "2026-01-30",
  "2026-03-31",
  "2026-04-30",
  "2026-06-30",
  "2026-07-31",
  "2026-09-30",
  "2026-10-30",
  "2026-12-18",
  // 2027 — ESTIMADO
  "2027-01-29",
  "2027-03-31",
  "2027-04-30",
  "2027-06-30",
  "2027-07-30",
  "2027-09-30",
  "2027-10-29",
  "2027-12-17",
] as const;

// ---------------------------------------------------------------------------
// Política monetária implícita — forward reunião-a-reunião (ACT/365)
// ---------------------------------------------------------------------------

const DAY_MS = 86_400_000;
const YEAR_DAYS = 365.2425;

function isoToUTC(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, (m ?? 1) - 1, d ?? 1);
}

function utcToISO(t: number): string {
  return new Date(t).toISOString().slice(0, 10);
}

/** Anos corridos (ACT/365.2425) entre duas datas. */
function yearsBetween(fromT: number, toT: number): number {
  return (toT - fromT) / (YEAR_DAYS * DAY_MS);
}

/** Arredonda ao passo `step` (% a.a.) MAIS PRÓXIMO (ex.: 0,25 do Fed/BCE). */
function roundToStep(x: number, step: number): number {
  if (step <= 0) return x;
  return Math.round(x / step) * step;
}

/**
 * Caminho forward da taxa de política implícita (degraus entre reuniões) a
 * partir de uma curva curta de juros à vista (prazos em anos + taxa % a.a.) e do
 * calendário de reuniões do BC. Mesmo modelo da Selic/Fed implícita: interpola
 * ln(df) LINEAR em anos (flat-forward) e avalia o df na data EXATA de cada
 * reunião; o forward de cada período é arredondado ao passo do BC.
 *
 * df(prazo) = (1 + r/100)^(-prazo); forward fwd entre prazos a<b:
 *   fwd = (df(a)/df(b))^(1/(b-a)) − 1  →  arredondado a `stepPct`.
 *
 * Diferença p/ a Selic (`selic-forward.ts`): usa ACT/365 corrido (sem o
 * calendário de feriados B3/DU 252) — suficiente p/ uma trajetória editorial em
 * mercados onde não temos o day-count oficial, e SEM ajuste de prêmio de prazo
 * (igual o tratamento atual dos EUA). Vazio se a curva for insuficiente.
 */
export function impliedPolicyPath(
  curve: CurvePoint[],
  refISO: string,
  meetingISOs: readonly string[],
  opts?: { stepPct?: number; horizonYears?: number },
): PolicySegment[] {
  const stepPct = opts?.stepPct ?? 0.25;
  const horizonYears = opts?.horizonYears ?? 1;
  const refT = isoToUTC(refISO);

  // Vértices (anos, ln df) a partir da curva à vista.
  const pts = curve
    .filter((c) => Number.isFinite(c.rate) && c.years > 0)
    .map((c) => ({ y: c.years, lndf: -c.years * Math.log(1 + c.rate / 100) }));
  if (pts.length < 2) return [];
  // Âncora hoje: prazo 0, df 1.
  pts.push({ y: 0, lndf: 0 });
  pts.sort((a, b) => a.y - b.y);
  const seen = new Set<number>();
  const verts = pts.filter((p) => (seen.has(p.y) ? false : (seen.add(p.y), true)));

  // Interpolação flat-forward de ln df (linear em anos), com extrapolação flat.
  const lndfAt = (y: number): number => {
    if (y <= verts[0].y) return verts[0].lndf;
    for (let i = 0; i < verts.length - 1; i++) {
      const a = verts[i];
      const b = verts[i + 1];
      if (y <= b.y) {
        const w = (y - a.y) / (b.y - a.y);
        return a.lndf + w * (b.lndf - a.lndf);
      }
    }
    const a = verts[verts.length - 2];
    const b = verts[verts.length - 1];
    const slope = (b.lndf - a.lndf) / (b.y - a.y);
    return b.lndf + slope * (y - b.y);
  };

  const horizonT = refT + Math.round(horizonYears * YEAR_DAYS) * DAY_MS;
  const future = meetingISOs
    .map(isoToUTC)
    .filter((t) => t >= refT)
    .sort((a, b) => a - b);
  const inWindow = future.filter((t) => t < horizonT);
  // Fronteira do último degrau = próxima reunião após o horizonte (período
  // inteiro e estável); se a lista acabar, gap típico de 45 dias.
  const nextAfter = future.find((t) => t >= horizonT);
  const lastW = inWindow.length ? inWindow[inWindow.length - 1] : refT;
  const boundary = nextAfter ?? lastW + 45 * DAY_MS;

  const gridTs = Array.from(new Set([refT, ...inWindow, boundary])).sort((a, b) => a - b);
  const grid = gridTs.map((t) => ({ t, y: yearsBetween(refT, t) }));
  // Dedup por prazo (reuniões no mesmo dia colapsam).
  const seenY = new Set<number>();
  const gg = grid.filter((g) => (seenY.has(g.y) ? false : (seenY.add(g.y), true)));

  const segs: PolicySegment[] = [];
  for (let i = 0; i < gg.length - 1; i++) {
    const a = gg[i];
    const b = gg[i + 1];
    if (b.y <= a.y) continue;
    const fwd = Math.exp((lndfAt(a.y) - lndfAt(b.y)) / (b.y - a.y)) - 1;
    if (!Number.isFinite(fwd)) continue;
    const level = roundToStep(fwd * 100, stepPct);
    segs.push({ fromISO: utcToISO(a.t), level: Math.round(level * 100) / 100 });
  }
  return segs;
}

/** Nível do degrau que cobre `dateISO` (função escada). null se antes do 1º. */
export function policyLevelAt(segs: PolicySegment[], dateISO: string): number | null {
  let level: number | null = null;
  for (const s of segs) {
    if (s.fromISO <= dateISO) level = s.level;
    else break;
  }
  return level;
}

/** Reuniões futuras (>= hoje) de um calendário, ordenadas. */
export function futureMeetings(dates: readonly string[], refISO: string): string[] {
  return dates.filter((d) => d >= refISO).slice().sort();
}

// ---------------------------------------------------------------------------
// Helpers de interpolação de curva (p/ comparar prazos exatos no comparador)
// ---------------------------------------------------------------------------

/** Interpola linearmente a taxa da curva no prazo `years` (em anos). null fora do range sem extrapolar. */
export function rateAtTenor(tenors: CurvePoint[], years: number): number | null {
  const pts = tenors
    .filter((p) => Number.isFinite(p.rate))
    .slice()
    .sort((a, b) => a.years - b.years);
  if (pts.length === 0) return null;
  if (years <= pts[0].years) return pts[0].rate;
  if (years >= pts[pts.length - 1].years) return pts[pts.length - 1].rate;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    if (years >= a.years && years <= b.years) {
      const w = (years - a.years) / (b.years - a.years);
      return a.rate + w * (b.rate - a.rate);
    }
  }
  return null;
}
