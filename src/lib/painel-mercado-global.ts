/**
 * Loaders das páginas de mercado "global + câmbio" do Painel Econômico:
 *  - /painel-economico/mercado/global/commodities
 *  - /painel-economico/mercado/brasil/cambio
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
