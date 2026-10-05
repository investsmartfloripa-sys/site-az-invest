/**
 * Taxas básicas de juros (política monetária) de vários países — catálogo,
 * tipos e cálculos compartilhados entre o servidor (`policy-rates-server.ts` +
 * rota /api/global-rates/policy-rates) e o cliente (`PolicyRatesChart`).
 *
 * FONTE ÚNICA: BIS — dataset WS_CBPOL (Central bank policy rates), diário,
 * gratuito, sem chave. Exceção: Zona do Euro usa a taxa de DEPÓSITO do BCE
 * (ECB Data Portal, FM.D.U2.EUR.4F.KR.DFR.LEV) no histórico inteiro, porque o
 * BIS troca de MRO para depósito em 18/09/2024 e isso cria um "corte" falso.
 *
 * Quebras de definição tratadas com `since` (a série só começa quando a taxa
 * passa a ser comparável — antes disso o BIS publica outra coisa):
 *   - México:    até 20/01/2008 é a "bank funding rate" (taxa de mercado, não meta);
 *   - Indonésia: até 18/08/2016 é a BI rate (12m); a troca p/ 7-day reverse repo
 *                aparece como queda de 6,50→5,25 que NÃO foi corte;
 *   - Chile:     até 08/08/2001 a taxa era real (indexada à inflação).
 *
 * Fora do gráfico: Turquia (37%+ achata a escala dos demais) e Índia (série do
 * BIS parada há meses).
 */

export type PolicyRateCountryId =
  | "br"
  | "cl"
  | "co"
  | "id"
  | "jp"
  | "mx"
  | "za"
  | "us"
  | "xm"
  | "gb"
  | "cn"
  | "pe"
  | "ca"
  | "au"
  | "kr"
  | "ch";

export type PolicyRateCountry = {
  id: PolicyRateCountryId;
  /** Código de área no BIS (REF_AREA). */
  bis: string;
  /** ISO-3166 alpha-2 minúsculo p/ a bandeira (flagcdn.com); "eu" p/ Zona do Euro. */
  flag: string;
  name: string;
  /** Banco central. */
  bank: string;
  /** Nome da taxa no país. */
  rate: string;
  color: string;
  /** Ligado por padrão no gráfico. */
  defaultOn: boolean;
  /** 1ª data comparável (ISO) — corta o trecho com outra definição. */
  since?: string;
  /**
   * Meta em BANDA: o BIS publica o ponto médio (EUA: banda de 0,25 p.p.). A
   * tabela mostra a banda; o gráfico, o ponto médio.
   */
  band?: number;
};

/** Ordem = ordem dos chips (padrão primeiro, extras depois). */
export const POLICY_RATE_COUNTRIES: PolicyRateCountry[] = [
  { id: "br", bis: "BR", flag: "br", name: "Brasil", bank: "BCB", rate: "Selic meta", color: "#009C3B", defaultOn: true },
  { id: "cl", bis: "CL", flag: "cl", name: "Chile", bank: "BCCh", rate: "Tasa de política monetaria", color: "#6D28D9", defaultOn: true, since: "2001-08-09" },
  { id: "co", bis: "CO", flag: "co", name: "Colômbia", bank: "BanRep", rate: "Tasa de intervención", color: "#D97706", defaultOn: true },
  { id: "id", bis: "ID", flag: "id", name: "Indonésia", bank: "Bank Indonesia", rate: "BI-Rate (7-day reverse repo)", color: "#0EA5E9", defaultOn: true, since: "2016-08-19" },
  { id: "jp", bis: "JP", flag: "jp", name: "Japão", bank: "BoJ", rate: "Meta da call rate overnight", color: "#FF5713", defaultOn: true },
  { id: "mx", bis: "MX", flag: "mx", name: "México", bank: "Banxico", rate: "Tasa objetivo", color: "#0D9488", defaultOn: true, since: "2008-01-21" },
  { id: "za", bis: "ZA", flag: "za", name: "África do Sul", bank: "SARB", rate: "Repo rate", color: "#DB2777", defaultOn: true },
  { id: "us", bis: "US", flag: "us", name: "EUA", bank: "Fed", rate: "Fed funds (meio da banda)", color: "#132960", defaultOn: true, band: 0.25 },
  { id: "xm", bis: "XM", flag: "eu", name: "Zona do Euro", bank: "BCE", rate: "Taxa de depósito", color: "#027DFC", defaultOn: false },
  { id: "gb", bis: "GB", flag: "gb", name: "Reino Unido", bank: "BoE", rate: "Bank Rate", color: "#1E8A5C", defaultOn: false },
  { id: "cn", bis: "CN", flag: "cn", name: "China", bank: "PBoC", rate: "LPR 1 ano", color: "#B91C1C", defaultOn: false },
  { id: "pe", bis: "PE", flag: "pe", name: "Peru", bank: "BCRP", rate: "Tasa de referencia", color: "#854D0E", defaultOn: false },
  { id: "ca", bis: "CA", flag: "ca", name: "Canadá", bank: "BoC", rate: "Overnight target", color: "#E11D48", defaultOn: false },
  { id: "au", bis: "AU", flag: "au", name: "Austrália", bank: "RBA", rate: "Cash rate target", color: "#CA8A04", defaultOn: false },
  { id: "kr", bis: "KR", flag: "kr", name: "Coreia do Sul", bank: "BoK", rate: "Base rate", color: "#4F46E5", defaultOn: false },
  { id: "ch", bis: "CH", flag: "ch", name: "Suíça", bank: "SNB", rate: "SNB policy rate", color: "#525252", defaultOn: false },
];

export function policyCountry(id: PolicyRateCountryId): PolicyRateCountry {
  return POLICY_RATE_COUNTRIES.find((c) => c.id === id)!;
}

/** Ponto de MUDANÇA: [data ISO em que a taxa passou a valer, taxa % a.a.]. */
export type PolicyStep = [date: string, rate: number];

export type PolicyRateSeries = {
  id: PolicyRateCountryId;
  /** Data da última observação publicada pela fonte (a taxa vale até aqui, pelo menos). */
  asOf: string;
  source: "BIS" | "BCE";
  /** Só os pontos de mudança, em ordem; o 1º é o início da série. */
  steps: PolicyStep[];
};

export type PolicyRatesPayload = {
  generatedAt: string;
  series: PolicyRateSeries[];
  /** Países que a fonte não entregou nesta rodada. */
  missing: PolicyRateCountryId[];
};

/** Início do histórico pedido às fontes (vira o "Máx" do seletor). */
export const POLICY_HISTORY_START = "2000-01-01";

/** Início da janela padrão e do "pico do ciclo" (ciclo pós-pandemia). */
export const POLICY_CYCLE_START = "2021-01-01";

// ---------------------------------------------------------------------------
// Cálculos
// ---------------------------------------------------------------------------

/** Taxa em vigor numa data (último degrau com data ≤ iso). null antes do 1º. */
export function rateAt(steps: PolicyStep[], iso: string): number | null {
  let v: number | null = null;
  for (const [d, r] of steps) {
    if (d > iso) break;
    v = r;
  }
  return v;
}

function daysBetween(aIso: string, bIso: string): number {
  return Math.round((Date.parse(`${bIso}T00:00:00Z`) - Date.parse(`${aIso}T00:00:00Z`)) / 86_400_000);
}

function minusMonths(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const total = y * 12 + (m - 1) - n;
  const ny = Math.floor(total / 12);
  const nm = total - ny * 12;
  const last = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate();
  return new Date(Date.UTC(ny, nm, Math.min(d, last))).toISOString().slice(0, 10);
}

/**
 * Sem decisão há mais que isto ⇒ "Pausa". ~3 reuniões dos BCs que se reúnem a
 * cada 6–8 semanas (Fed, BCB, Banxico); pega também os mensais (BI) parados.
 */
export const PAUSE_AFTER_DAYS = 100;

export type PolicyStatus = "subindo" | "cortando" | "pausa";

export type PolicyStats = {
  current: number;
  asOf: string;
  /** Última decisão que MUDOU a taxa (data em que passou a valer + delta em p.p.). */
  lastMove: { date: string; delta: number } | null;
  /** Variação em 12 meses (p.p.) até asOf. */
  chg12m: number | null;
  /** Máximo desde POLICY_CYCLE_START (1ª data em que foi atingido). */
  peak: { value: number; date: string } | null;
  /** current − peak (p.p.; 0 = está no pico). */
  fromPeak: number | null;
  status: PolicyStatus;
  /** Direção do último movimento (p/ qualificar a pausa). */
  lastDirection: "alta" | "corte" | null;
};

export function policyStats(s: PolicyRateSeries): PolicyStats | null {
  const { steps, asOf } = s;
  if (steps.length === 0) return null;
  const current = steps[steps.length - 1][1];

  const lastMove =
    steps.length >= 2
      ? { date: steps[steps.length - 1][0], delta: round3(current - steps[steps.length - 2][1]) }
      : null;

  const ago = rateAt(steps, minusMonths(asOf, 12));
  const chg12m = ago == null ? null : round3(current - ago);

  let peak: PolicyStats["peak"] = null;
  const atStart = rateAt(steps, POLICY_CYCLE_START);
  if (atStart != null) peak = { value: atStart, date: POLICY_CYCLE_START };
  for (const [d, r] of steps) {
    if (d < POLICY_CYCLE_START) continue;
    if (peak == null || r > peak.value) peak = { value: r, date: d };
  }
  const fromPeak = peak ? round3(current - peak.value) : null;

  const lastDirection = lastMove ? (lastMove.delta > 0 ? "alta" : "corte") : null;
  const recent = lastMove != null && daysBetween(lastMove.date, asOf) <= PAUSE_AFTER_DAYS;
  const status: PolicyStatus = recent ? (lastMove!.delta > 0 ? "subindo" : "cortando") : "pausa";

  return { current, asOf, lastMove, chg12m, peak, fromPeak, status, lastDirection };
}

function round3(v: number): number {
  return Math.round(v * 1000) / 1000;
}
