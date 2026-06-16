/**
 * Loaders dos JSONs da aba /painel-economico/mercado.
 *
 * Os JSONs sao gerados pelo workflow `.github/workflows/market-data.yml`
 * (rodando 1x/dia, fora do cron de 15min do painel) e ficam no Vercel Blob.
 *
 * Tres arquivos:
 *  - data/market_catalog.json           - lista de ativos com metadados
 *  - data/market_history_latest.json    - retornos pre-calculados por ticker
 *  - data/market_history_full.json      - serie diaria completa (pesado, so /historico)
 *  - data/market_fundamentals.json      - multiplos via yfinance .info
 *
 * Toda funcao retorna null em caso de falha (mesmo padrao do painel-data.ts).
 */

import { painelBlobUrl } from "@/lib/painel-blob";

/** Cache ISR de 1 hora para market data (atualiza 1x/dia, nao precisa ser tao agressivo). */
export const MARKET_REVALIDATE_SECONDS = 3600;

export type AssetClass =
  | "br_acoes"
  | "br_etf"
  | "br_fii"
  | "us_acoes"
  | "us_etf"
  | "indice"
  | "fx"
  | "commodity"
  | "cripto";

export type CatalogAsset = {
  ticker: string;
  name: string;
  klass: AssetClass;
  sector: string;
  country: "BR" | "US" | "GLOBAL";
  currency: "BRL" | "USD";
};

export type MarketCatalog = {
  generated_at: string;
  total: number;
  class_labels: Record<string, string>;
  assets: CatalogAsset[];
};

export type ReturnPeriods = {
  "1d": number | null;
  "1w": number | null;
  "1m": number | null;
  "3m": number | null;
  ytd: number | null;
  "1y": number | null;
  "5y": number | null;
};

export type TickerLatest = {
  name: string;
  klass: AssetClass;
  sector: string;
  country: "BR" | "US" | "GLOBAL";
  currency: "BRL" | "USD";
  last_date: string;
  last_close: number;
  returns: ReturnPeriods;
};

export type MarketHistoryLatest = {
  status: "ok" | "error";
  generated_at: string;
  lookback_years: number;
  total_tickers_attempted: number;
  total_tickers_loaded: number;
  tickers: Record<string, TickerLatest>;
};

export type TickerSeries = {
  name: string;
  klass: AssetClass;
  currency: "BRL" | "USD";
  series_daily: Array<[string, number]>;
};

export type MarketHistoryFull = {
  status: "ok" | "error";
  generated_at: string;
  lookback_years: number;
  tickers: Record<string, TickerSeries>;
};

export type FundamentalsInfo = {
  shortName?: string | null;
  longName?: string | null;
  sector?: string | null;
  industry?: string | null;
  country?: string | null;
  currency?: string | null;
  marketCap?: number | null;
  enterpriseValue?: number | null;
  sharesOutstanding?: number | null;
  trailingPE?: number | null;
  forwardPE?: number | null;
  priceToBook?: number | null;
  priceToSalesTrailing12Months?: number | null;
  enterpriseToEbitda?: number | null;
  enterpriseToRevenue?: number | null;
  dividendYield?: number | null;
  trailingAnnualDividendYield?: number | null;
  payoutRatio?: number | null;
  fiveYearAvgDividendYield?: number | null;
  returnOnEquity?: number | null;
  returnOnAssets?: number | null;
  debtToEquity?: number | null;
  currentRatio?: number | null;
  quickRatio?: number | null;
  profitMargins?: number | null;
  operatingMargins?: number | null;
  ebitdaMargins?: number | null;
  grossMargins?: number | null;
  revenueGrowth?: number | null;
  earningsGrowth?: number | null;
  earningsQuarterlyGrowth?: number | null;
  beta?: number | null;
  fiftyTwoWeekHigh?: number | null;
  fiftyTwoWeekLow?: number | null;
  regularMarketPrice?: number | null;
  regularMarketPreviousClose?: number | null;
  regularMarketChangePercent?: number | null;
  averageVolume?: number | null;
  trailingEps?: number | null;
  forwardEps?: number | null;
  bookValue?: number | null;
  exchange?: string | null;
};

export type TickerFundamentals = {
  name: string;
  klass: AssetClass;
  sector: string;
  country: "BR" | "US" | "GLOBAL";
  currency: "BRL" | "USD";
  info: FundamentalsInfo;
  fetched_at: string;
  stale: boolean;
};

export type MarketFundamentals = {
  status: "ok" | "error";
  generated_at: string;
  total_tickers_attempted: number;
  total_loaded: number;
  total_from_cache: number;
  total_failed: number;
  tickers: Record<string, TickerFundamentals>;
};

async function fetchBlobJson<T>(path: string): Promise<T | null> {
  const url = painelBlobUrl(path);
  if (!url) return null;
  try {
    const res = await fetch(url, { next: { revalidate: MARKET_REVALIDATE_SECONDS } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function getMarketCatalog(): Promise<MarketCatalog | null> {
  return fetchBlobJson<MarketCatalog>("data/market_catalog.json");
}

export async function getMarketHistoryLatest(): Promise<MarketHistoryLatest | null> {
  return fetchBlobJson<MarketHistoryLatest>("data/market_history_latest.json");
}

export async function getMarketHistoryFull(): Promise<MarketHistoryFull | null> {
  return fetchBlobJson<MarketHistoryFull>("data/market_history_full.json");
}

/**
 * Vol de regime da renda fixa pré BR (IRF-M via IRFM11). Calcula a vol-15d
 * ROLANTE ao longo de toda a série (preço do ETF de NTN-F move com a curva pré,
 * então sua vol É a vol da taxa pré) e mede em que PERCENTIL a vol-15d ATUAL está
 * na distribuição histórica. Percentil (em vez de ratio vs média de 5a) porque a
 * distribuição é torta à direita — um ratio simples fica manso (a média de 5a é
 * inflada por 2021-22); o percentil mede "quão extremo é o momento" sem esse
 * viés. mult = 2^((pct−50)/50): mediana→1,0; extremos→clamp [0,5; 2,0]. Reusa o
 * cache do market_history_full (já buscado por outras páginas).
 */
export type RatesVol = { vol15dAnn: number; pct: number; mult: number };

const RATES_VOL_TICKER = "IRFM11.SA";
const RATES_VOL_WINDOW = 15;
const RATES_VOL_CLAMP: readonly [number, number] = [0.5, 2];

export async function getRatesVolMult(): Promise<RatesVol | null> {
  const full = await getMarketHistoryFull();
  const series = full?.tickers?.[RATES_VOL_TICKER]?.series_daily ?? [];
  const closes = series
    .map((p) => p[1])
    .filter((v): v is number => typeof v === "number" && v > 0);
  if (closes.length < RATES_VOL_WINDOW + 30) return null;
  const rets: number[] = [];
  for (let i = 1; i < closes.length; i++) rets.push(Math.log(closes[i] / closes[i - 1]));
  const std = (a: number[]): number => {
    if (a.length < 2) return 0;
    const m = a.reduce((x, y) => x + y, 0) / a.length;
    return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / a.length);
  };
  // Série de vols-15d rolantes (uma por pregão, da janela 15 até o fim).
  const roll: number[] = [];
  for (let i = RATES_VOL_WINDOW; i <= rets.length; i++) {
    roll.push(std(rets.slice(i - RATES_VOL_WINDOW, i)));
  }
  if (roll.length < 30) return null;
  const cur = roll[roll.length - 1];
  if (!(cur > 0)) return null;
  const below = roll.filter((v) => v <= cur).length;
  const pct = (below / roll.length) * 100;
  // 2^((pct−50)/50): mediana=1; 0%→0,5; 100%→2. Clamp por garantia.
  const raw = Math.pow(2, (pct - 50) / 50);
  const mult = Math.min(RATES_VOL_CLAMP[1], Math.max(RATES_VOL_CLAMP[0], raw));
  return { vol15dAnn: cur * Math.sqrt(252), pct, mult };
}

export async function getMarketFundamentals(): Promise<MarketFundamentals | null> {
  return fetchBlobJson<MarketFundamentals>("data/market_fundamentals.json");
}

/** Carrega catalog + latest em paralelo. */
export async function getMarketOverview() {
  const [catalog, latest] = await Promise.all([getMarketCatalog(), getMarketHistoryLatest()]);
  return { catalog, latest };
}

// ---------------------------------------------------------------------------
// Helpers de formatacao / classificacao usados por componentes da UI
// ---------------------------------------------------------------------------

export function formatPct(value: number | null | undefined, fractionDigits = 2): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `${value.toFixed(fractionDigits)}%`;
}

export function formatRatio(value: number | null | undefined, fractionDigits = 2): string {
  if (value == null || Number.isNaN(value)) return "—";
  return value.toFixed(fractionDigits);
}

export function formatBigNumber(value: number | null | undefined, currency: "BRL" | "USD" | "" = ""): string {
  if (value == null || Number.isNaN(value)) return "—";
  const abs = Math.abs(value);
  const prefix = currency ? (currency === "BRL" ? "R$ " : "US$ ") : "";
  if (abs >= 1e12) return `${prefix}${(value / 1e12).toFixed(2)} T`;
  if (abs >= 1e9) return `${prefix}${(value / 1e9).toFixed(2)} B`;
  if (abs >= 1e6) return `${prefix}${(value / 1e6).toFixed(2)} M`;
  if (abs >= 1e3) return `${prefix}${(value / 1e3).toFixed(2)} K`;
  return `${prefix}${value.toFixed(2)}`;
}

export function formatPctFromRatio(value: number | null | undefined, fractionDigits = 2): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `${(value * 100).toFixed(fractionDigits)}%`;
}

export function classLabel(klass: AssetClass | string, fallback?: string): string {
  const map: Record<string, string> = {
    br_acoes: "Ações BR",
    br_etf: "ETFs BR",
    br_fii: "FIIs BR",
    us_acoes: "Ações EUA",
    us_etf: "ETFs EUA",
    indice: "Índices",
    fx: "Câmbio",
    commodity: "Commodities",
    cripto: "Cripto",
  };
  return map[klass] ?? fallback ?? klass;
}
