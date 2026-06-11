/**
 * Loaders das páginas de mercado "global + câmbio" do Painel Econômico:
 *  - /painel-economico/mercado/global/commodities
 *  - /painel-economico/mercado/global/moedas (absorveu /mercado/brasil/cambio)
 *  - /painel-economico/mercado/global/indices-globais
 *
 * Duas famílias de fonte no Vercel Blob:
 *  1. JSONs do panorama (data-pipeline.yml, cron 15 min): retornos prontos
 *     por período — data/commodities_returns_panorama.json,
 *     data/world_indices_returns_panorama.json e data/fx_top_movers.json.
 *  2. data/market_history_full.json (market-data.yml, diário útil): série
 *     diária de 5 anos por ticker. O JSON tem ~220 tickers — extraímos no
 *     SERVIDOR apenas os tickers de cada página (getHistorySlice) e nunca
 *     repassamos o arquivo inteiro pro cliente.
 *
 * Toda função retorna null/slice vazio em falha (mesmo padrão do
 * painel-data.ts): a página decide como degradar com honestidade.
 */

import { painelBlobUrl } from "@/lib/painel-blob";
import { getMarketHistoryFull } from "@/lib/painel-market-data";

/** Cache do fetch dos JSONs do panorama (gira a cada 15 min; mesmo valor do painel-data.ts). */
const PANORAMA_FETCH_REVALIDATE_SECONDS = 300;

/** Revalidate ISR das três páginas (coerente com as demais páginas de mercado). */
export const MERCADO_GLOBAL_REVALIDATE_SECONDS = 3600;

// ---------------------------------------------------------------------------
// Tipos dos JSONs do panorama
// ---------------------------------------------------------------------------

/** Chaves de período dos JSONs *_returns_panorama. */
export type PanoramaPeriodKey = "1d" | "1wk" | "1mo" | "3mo" | "1y";

export const PANORAMA_PERIODS: { id: PanoramaPeriodKey; label: string }[] = [
  { id: "1d", label: "1D" },
  { id: "1wk", label: "1S" },
  { id: "1mo", label: "1M" },
  { id: "3mo", label: "3M" },
  { id: "1y", label: "1A" },
];

export type CommodityReturnRow = {
  name: string;
  ticker: string;
  /** "Energia" | "Metais" | "Agrícola" | "Softs" | "Pecuária" (strings do pipeline). */
  sector: string;
  exchange?: string;
  return_pct_usd: number | null;
  return_pct_brl: number | null;
  /** Compatibilidade: igual a return_pct_usd. */
  return_pct?: number | null;
  first_close?: number | null;
  last_close?: number | null;
};

export type CommoditiesReturnsPayload = {
  status?: string;
  generated_at?: string;
  by_period?: Partial<Record<PanoramaPeriodKey, { period?: string; data?: CommodityReturnRow[] }>>;
};

export type WorldIndexReturnRow = {
  ticker: string;
  name: string;
  /** "developed" | "emerging" (strings do pipeline). */
  group?: string;
  return_pct: number | null;
  start_date?: string;
  end_date?: string;
  start_price?: number | null;
  end_price?: number | null;
};

export type WorldIndicesReturnsPayload = {
  status?: string;
  generated_at?: string;
  by_period?: Partial<Record<PanoramaPeriodKey, { period?: string; data?: WorldIndexReturnRow[] }>>;
};

/** Chaves de período do fx_top_movers (formato próprio: day/week/...). */
export type FxMoversPeriodKey = "day" | "week" | "month" | "quarter" | "year";

/** Mapa 1d→day etc. p/ reusar as pílulas 1D/1S/1M/3M/1A nas duas fontes. */
export const FX_PERIOD_BY_PANORAMA: Record<PanoramaPeriodKey, FxMoversPeriodKey> = {
  "1d": "day",
  "1wk": "week",
  "1mo": "month",
  "3mo": "quarter",
  "1y": "year",
};

export type FxMoverRow = {
  /** "BRL / USD", "EUR / USD"... e "DXY" (índice, não é par). */
  ticker: string;
  last_date?: string;
  last_close?: number | null;
  prev_date?: string;
  prev_close?: number | null;
  /** Variação % da MOEDA contra o USD (positivo = moeda apreciou). */
  change_pct: number;
};

export type FxTopMoversPayload = {
  status?: string;
  generated_at?: string;
  source?: string;
  top?: Partial<Record<FxMoversPeriodKey, { asof?: string; up?: FxMoverRow[]; down?: FxMoverRow[] }>>;
};

// ---------------------------------------------------------------------------
// Utilidades de data
// ---------------------------------------------------------------------------

/**
 * Data de HOJE em Brasília como ISO "YYYY-MM-DD" (en-CA formata exatamente
 * assim). Usada p/ honestidade da manchete dos índices globais: se o
 * fechamento mais recente for anterior a hoje, a prosa diz "no último
 * fechamento". Com ISR de 1h o desvio máximo é de uma hora — aceitável.
 */
export function hojeIsoBrasilia(agora: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(agora);
}

// ---------------------------------------------------------------------------
// Fetchers
// ---------------------------------------------------------------------------

async function fetchPanoramaJson<T extends { status?: string }>(path: string): Promise<T | null> {
  const url = painelBlobUrl(path);
  if (!url) return null;
  try {
    const res = await fetch(url, { next: { revalidate: PANORAMA_FETCH_REVALIDATE_SECONDS } });
    if (!res.ok) return null;
    const json = (await res.json()) as T;
    if (json && json.status && json.status !== "ok") return null;
    return json;
  } catch {
    return null;
  }
}

export async function getCommoditiesReturnsPanorama(): Promise<CommoditiesReturnsPayload | null> {
  return fetchPanoramaJson<CommoditiesReturnsPayload>("data/commodities_returns_panorama.json");
}

export async function getWorldIndicesReturnsPanorama(): Promise<WorldIndicesReturnsPayload | null> {
  return fetchPanoramaJson<WorldIndicesReturnsPayload>("data/world_indices_returns_panorama.json");
}

export async function getFxTopMovers(): Promise<FxTopMoversPayload | null> {
  return fetchPanoramaJson<FxTopMoversPayload>("data/fx_top_movers.json");
}

// ---------------------------------------------------------------------------
// Valuation EUA (data/global_valuation.json — market-data.yml, diário útil)
// ---------------------------------------------------------------------------

/** Estatísticas média ± 1σ de uma série de valuation (mesmo formato do pl_stats do Ibov). */
export type GlobalValuationStats = {
  mean: number;
  sd: number;
  minus1: number;
  plus1: number;
  current_z: number | null;
  n_points: number;
};

export type BuffettBlock = {
  current?: { date: string; ratio_pct: number } | null;
  stats?: GlobalValuationStats | null;
  /** [["YYYY-MM-DD", % do PIB], ...] — trimestral (Z.1 do Fed). */
  series?: Array<[string, number]>;
  numerator_series?: string;
  denominator_series?: string;
  frequency?: string;
  /** true = build mais recente falhou e o bloco preserva o último dado bom. */
  stale?: boolean;
  source?: string;
  note?: string;
};

export type CapeBlock = {
  current?: { date: string; value: number } | null;
  stats?: GlobalValuationStats | null;
  /** [["YYYY-MM-01", CAPE], ...] — mensal desde ~1881 (Shiller/Yale). */
  series?: Array<[string, number]>;
  stale?: boolean;
  source?: string;
};

export type SpyValuationPoint = {
  date: string;
  trailing_pe: number | null;
  forward_pe: number | null;
  /** Em % (0,98 = 0,98% a.a.). */
  dy_pct: number | null;
};

export type SpyBlock = {
  current?: {
    date: string;
    trailing_pe: number | null;
    forward_pe: number | null;
    dividend_yield_pct: number | null;
  } | null;
  /** Série acumulada de snapshots diários (cresce 1 ponto por dia útil). */
  series?: SpyValuationPoint[];
  stale?: boolean;
  source?: string;
};

export type GlobalValuationPayload = {
  status?: string;
  generated_at?: string;
  schema_version?: number;
  buffett?: BuffettBlock | null;
  cape?: CapeBlock | null;
  spy?: SpyBlock | null;
};

/**
 * Valuation EUA (indicador Buffett, CAPE Shiller e múltiplos do SPY).
 * null enquanto o pipeline não publicar o blob (ou em falha de fetch) —
 * a página degrada com PipelinePendingCard.
 */
export async function getGlobalValuation(): Promise<GlobalValuationPayload | null> {
  return fetchPanoramaJson<GlobalValuationPayload>("data/global_valuation.json");
}

// ---------------------------------------------------------------------------
// Recorte do histórico de 5 anos (market_history_full.json)
// ---------------------------------------------------------------------------

/** Série diária enxuta de um ticker — `data` é compatível com AzSeriesPoint. */
export type HistorySeriesSlim = {
  ticker: string;
  /** Rótulo exibido na legenda (default: nome do catálogo). */
  label: string;
  currency: "BRL" | "USD";
  data: Array<[string, number]>;
};

export type HistorySlice = {
  /** Quando o pipeline gravou o JSON (DataStamp "Giro"). null = indisponível. */
  generatedAt: string | null;
  /** Observação mais recente entre as séries extraídas (DataStamp "Dado"). */
  lastDataDate: string | null;
  series: HistorySeriesSlim[];
};

export const EMPTY_HISTORY_SLICE: HistorySlice = { generatedAt: null, lastDataDate: null, series: [] };

/**
 * Extrai do market_history_full.json APENAS os tickers pedidos, já com
 * rótulo de exibição. Tickers ausentes são pulados em silêncio (o chamador
 * decide se a ausência é fatal). Pontos não finitos são descartados.
 */
export async function getHistorySlice(
  wanted: Array<{ ticker: string; label?: string }>,
): Promise<HistorySlice> {
  const full = await getMarketHistoryFull();
  if (!full || full.status !== "ok" || !full.tickers) return EMPTY_HISTORY_SLICE;

  const series: HistorySeriesSlim[] = [];
  let lastDataDate: string | null = null;

  for (const w of wanted) {
    const t = full.tickers[w.ticker];
    if (!t || !Array.isArray(t.series_daily)) continue;
    const data: Array<[string, number]> = [];
    for (const point of t.series_daily) {
      if (!Array.isArray(point) || typeof point[0] !== "string" || !Number.isFinite(point[1])) continue;
      data.push([point[0], point[1]]);
    }
    if (data.length === 0) continue;
    const lastIso = data[data.length - 1][0];
    if (!lastDataDate || lastIso > lastDataDate) lastDataDate = lastIso;
    series.push({ ticker: w.ticker, label: w.label ?? t.name, currency: t.currency, data });
  }

  return { generatedAt: full.generated_at ?? null, lastDataDate, series };
}

// ---------------------------------------------------------------------------
// Universo de moedas (/mercado/global/moedas)
// ---------------------------------------------------------------------------

/**
 * CONVENÇÃO DE SINAL (crítica — vale p/ toda a página de moedas):
 * todo retorno exibido é o retorno DA MOEDA contra o dólar — positivo = a
 * moeda se VALORIZOU frente ao USD. Quando o par Yahoo tem o USD na base
 * (USD/JPY, USD/BRL...; `usdBase: true`), o retorno do PAR é invertido
 * geometricamente (preço_inicial/preço_final − 1) antes de exibir.
 * É a mesma convenção do fx_top_movers.json (change_pct = moeda vs USD).
 */
export type FxGroup = "majors" | "emergentes";

export type FxPairDef = {
  /** Símbolo Yahoo no market_history_full ("JPY=X" = USD/JPY; "EURUSD=X" = EUR/USD). */
  ticker: string;
  /** Par na convenção de mercado, p/ exibir a cotação ("USD/JPY"). */
  pair: string;
  /** Código ISO da moeda (lado não-USD). */
  code: string;
  /** Nome pt-BR da moeda. */
  name: string;
  group: FxGroup;
  /** true = USD é a BASE do par (alta do par = moeda local mais fraca). */
  usdBase: boolean;
};

/** Moedas acompanhadas contra o USD (majors G10 + nórdicas, emergentes incl. BRL). */
export const FX_PAIRS: FxPairDef[] = [
  // Majors (G10 + nórdicas)
  { ticker: "EURUSD=X", pair: "EUR/USD", code: "EUR", name: "Euro", group: "majors", usdBase: false },
  { ticker: "JPY=X", pair: "USD/JPY", code: "JPY", name: "Iene japonês", group: "majors", usdBase: true },
  { ticker: "GBPUSD=X", pair: "GBP/USD", code: "GBP", name: "Libra esterlina", group: "majors", usdBase: false },
  { ticker: "CHF=X", pair: "USD/CHF", code: "CHF", name: "Franco suíço", group: "majors", usdBase: true },
  { ticker: "AUDUSD=X", pair: "AUD/USD", code: "AUD", name: "Dólar australiano", group: "majors", usdBase: false },
  { ticker: "CAD=X", pair: "USD/CAD", code: "CAD", name: "Dólar canadense", group: "majors", usdBase: true },
  { ticker: "NZDUSD=X", pair: "NZD/USD", code: "NZD", name: "Dólar neozelandês", group: "majors", usdBase: false },
  { ticker: "SEK=X", pair: "USD/SEK", code: "SEK", name: "Coroa sueca", group: "majors", usdBase: true },
  { ticker: "NOK=X", pair: "USD/NOK", code: "NOK", name: "Coroa norueguesa", group: "majors", usdBase: true },
  // Emergentes (o real entra aqui — é o seu peer group)
  { ticker: "BRL=X", pair: "USD/BRL", code: "BRL", name: "Real brasileiro", group: "emergentes", usdBase: true },
  { ticker: "MXN=X", pair: "USD/MXN", code: "MXN", name: "Peso mexicano", group: "emergentes", usdBase: true },
  { ticker: "ARS=X", pair: "USD/ARS", code: "ARS", name: "Peso argentino", group: "emergentes", usdBase: true },
  { ticker: "CLP=X", pair: "USD/CLP", code: "CLP", name: "Peso chileno", group: "emergentes", usdBase: true },
  { ticker: "COP=X", pair: "USD/COP", code: "COP", name: "Peso colombiano", group: "emergentes", usdBase: true },
  { ticker: "ZAR=X", pair: "USD/ZAR", code: "ZAR", name: "Rand sul-africano", group: "emergentes", usdBase: true },
  { ticker: "TRY=X", pair: "USD/TRY", code: "TRY", name: "Lira turca", group: "emergentes", usdBase: true },
  { ticker: "INR=X", pair: "USD/INR", code: "INR", name: "Rupia indiana", group: "emergentes", usdBase: true },
  { ticker: "CNY=X", pair: "USD/CNY", code: "CNY", name: "Yuan chinês", group: "emergentes", usdBase: true },
  { ticker: "PLN=X", pair: "USD/PLN", code: "PLN", name: "Zloty polonês", group: "emergentes", usdBase: true },
  { ticker: "HUF=X", pair: "USD/HUF", code: "HUF", name: "Florim húngaro", group: "emergentes", usdBase: true },
  { ticker: "IDR=X", pair: "USD/IDR", code: "IDR", name: "Rupia indonésia", group: "emergentes", usdBase: true },
  { ticker: "KRW=X", pair: "USD/KRW", code: "KRW", name: "Won sul-coreano", group: "emergentes", usdBase: true },
];

/**
 * Janela → nº de pregões (mesmos shifts do build_fx_top_movers.py:
 * 1/5/21/63/252) — retornos daqui e do fx_top_movers ficam comparáveis.
 */
export const FX_SHIFT_BY_PERIOD: Record<PanoramaPeriodKey, number> = {
  "1d": 1,
  "1wk": 5,
  "1mo": 21,
  "3mo": 63,
  "1y": 252,
};

/**
 * Retorno % DA MOEDA contra o USD em uma janela de `shift` pregões, a partir
 * da série diária do PAR. Aplica a convenção de sinal: par com USD na base é
 * invertido (1/preço) antes do retorno. null se a série não alcança a janela.
 */
export function fxCurrencyReturnPct(
  data: ReadonlyArray<readonly [string, number]> | undefined,
  shift: number,
  usdBase: boolean,
): number | null {
  if (!data || data.length <= shift) return null;
  const last = data[data.length - 1][1];
  const prev = data[data.length - 1 - shift][1];
  if (!Number.isFinite(last) || !Number.isFinite(prev) || last <= 0 || prev <= 0) return null;
  // usdBase: retorno da moeda = (1/last)/(1/prev) − 1 = prev/last − 1.
  return (usdBase ? prev / last - 1 : last / prev - 1) * 100;
}
