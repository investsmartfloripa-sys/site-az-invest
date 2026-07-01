/**
 * Loaders e tipos do painel de Renda Variável (Ações Brasil).
 *
 * Pipelines (workflow .github/workflows/acoes-pipeline.yml):
 *  - build_acoes_ibov.py       -> data/acoes_ibov.json
 *      Hero do Ibovespa (^BVSP via market_history_full no Blob) + benchmarks
 *      (CDI BCB SGS 12, S&P 500, USD/BRL) em base 100. Série diária ~5a.
 *
 *  - build_acoes_valuation.py  -> data/acoes_valuation.json
 *      P/L do Ibovespa (bottom-up, pesos B3) com média e bandas ±1σ/±2σ +
 *      prêmio de risco: earnings yield (1/PL) e dividend yield vs NTN-B real ~10a.
 *
 *  - build_acoes_screener.py   -> data/acoes_screener.json
 *      Universo IBOV (~85) + métricas por papel (P/L, P/VP, DY, ROE, market cap,
 *      setor, peso no índice, liquidez).
 *
 * Toda função retorna null em caso de falha (mesmo padrão de painel-fii.ts).
 */
import { painelBlobUrl } from "@/lib/painel-blob";
import { prisma } from "@/lib/prisma";

/** Cache ISR — JSONs re-gerados pós-pregão; 60s equilibra frescor e carga no Blob. */
export const ACOES_REVALIDATE_SECONDS = 60;

// ---------------------------------------------------------------------------
// Hero Ibovespa (card métrico + chart com benchmarks)
// ---------------------------------------------------------------------------

export type AcoesBenchmarkKey = "CDI" | "SP500" | "USDBRL";

export type AcoesIbovPoint = {
  date: string; // YYYY-MM-DD
  ibov: number; // pontos do índice
  CDI?: number | null;
  SP500?: number | null;
  USDBRL?: number | null;
};

export type AcoesIbovHero = {
  last_value: number; // pontos do Ibovespa
  last_date: string;
  change_pct_1d: number | null;
  max_12m: number;
  min_12m: number;
};

export type AcoesIbovData = {
  status: "ok" | "error";
  generated_at: string;
  source_primary: string;
  benchmark_sources: Record<AcoesBenchmarkKey, string>;
  hero: AcoesIbovHero | null;
  /** Série diária (~5a). UI escolhe janela; benchmarks renormalizam para base 100. */
  series_daily: AcoesIbovPoint[];
};

// ---------------------------------------------------------------------------
// Valuation (P/L com bandas + prêmio EY/DY vs NTN-B)
// ---------------------------------------------------------------------------

export type AcoesValuationPoint = {
  date: string; // YYYY-MM-DD
  pl: number;
  ey_pct: number; // earnings yield (1/PL) em %
  dy_pct: number | null; // dividend yield em %
  ntnb_pct: number | null; // NTN-B real ~10a em %
  prem_ey_pp: number | null; // EY% - NTNB% (pontos percentuais)
  prem_dy_pp: number | null; // DY% - NTNB% (pontos percentuais)
};

export type AcoesValuationStats = {
  mean: number;
  sd: number;
  minus2: number;
  minus1: number;
  plus1: number;
  plus2: number;
  current_z: number | null;
  n_points: number;
};

export type AcoesValuationData = {
  status: "ok" | "error";
  generated_at: string;
  current: AcoesValuationPoint | null;
  coverage_weight_pct: number | null;
  n_constituents: number;
  pl_stats: AcoesValuationStats;
  series: AcoesValuationPoint[];
  /** NTN-B real ~10a completa (pode cobrir janela maior que a série de P/L). */
  ntnb_full?: Array<[string, number]>;
  sources?: Record<string, string>;
  method?: string;
};

// ---------------------------------------------------------------------------
// Screener (universo Ibovespa)
// ---------------------------------------------------------------------------

export type AcoesScreenerRow = {
  ticker: string; // ex.: "PETR4"
  name: string;
  sector: string;
  /** Preço de fechamento mais recente (BRL). */
  price: number | null;
  price_date: string | null;
  change_pct_1d: number | null;
  /** P/L (preço/lucro), trailing. */
  pl: number | null;
  /** P/VP (preço/valor patrimonial). */
  pvp: number | null;
  /** Dividend yield 12m em %. */
  dy_12m_pct: number | null;
  /** ROE em %. */
  roe_pct: number | null;
  /** Valor de mercado (BRL). */
  market_cap: number | null;
  /** Participação na carteira do Ibovespa em %. */
  ibov_weight_pct: number | null;
  /** Volume financeiro médio diário (BRL) — liquidez. */
  liquidity_avg_pct?: number | null;
  liquidity_avg_brl?: number | null;
  /** Flags de sanidade (lucro negativo, múltiplo atípico). */
  pl_warning?: boolean;
  dy_atypical?: boolean;
};

export type AcoesScreenerData = {
  status: "ok" | "error";
  generated_at: string;
  total_rows: number;
  rows: AcoesScreenerRow[];
  sectors: string[]; // lista única ordenada para filtros
};

// ---------------------------------------------------------------------------
// Editorial (Posts via Prisma)
// ---------------------------------------------------------------------------

export type AcoesEditorialPost = {
  slug: string;
  title: string;
  excerpt: string | null;
  coverImage: string | null;
  authorName: string;
  createdAt: string;
};

// ---------------------------------------------------------------------------
// Fetchers (Blob)
// ---------------------------------------------------------------------------

async function fetchBlobJson<T>(path: string): Promise<T | null> {
  const url = painelBlobUrl(path);
  if (!url) return null;
  try {
    const res = await fetch(url, { next: { revalidate: ACOES_REVALIDATE_SECONDS } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function getAcoesIbov(): Promise<AcoesIbovData | null> {
  return fetchBlobJson<AcoesIbovData>("data/acoes_ibov.json");
}

export async function getAcoesValuation(): Promise<AcoesValuationData | null> {
  return fetchBlobJson<AcoesValuationData>("data/acoes_valuation.json");
}

export async function getAcoesScreener(): Promise<AcoesScreenerData | null> {
  return fetchBlobJson<AcoesScreenerData>("data/acoes_screener.json");
}

// ---------------------------------------------------------------------------
// Fluxo de investidores (B3 — saldo líquido por perfil, acumulado no ano)
// ---------------------------------------------------------------------------

/**
 * Série anual já reconstruída pelo pipeline (build_fluxo_investidores.py).
 * `series[rótulo]` é o acumulado no ano (R$ bi) alinhado a `dates` (as_of).
 */
export type FluxoInvestidoresYear = {
  dates: string[]; // YYYY-MM-DD (as_of, D-2)
  series: Record<string, number[]>; // rótulo canônico -> acumulado no ano (R$ bi)
  labels: string[]; // ordem de exibição das categorias
};

export type FluxoInvestidoresData = {
  status: "ok" | "error";
  generated_at: string;
  source: string;
  unit: string; // "R$ bi"
  lag_dias_uteis: number; // 2 (D-2)
  data_date: string | null; // as_of mais recente
  /** YTD por ano presente no arquivo permanente (a janela cresce a cada dia). */
  years: Record<string, FluxoInvestidoresYear>;
};

export async function getFluxoInvestidores(): Promise<FluxoInvestidoresData | null> {
  return fetchBlobJson<FluxoInvestidoresData>("data/fluxo_investidores.json");
}

// ---------------------------------------------------------------------------
// Logos das ações (mapa ticker "bare" -> URL SVG do TradingView)
// Pipeline: build_acoes_logos.py -> data/acoes_logos.json
// ---------------------------------------------------------------------------

export type AcoesLogosData = {
  status: "ok" | "error";
  generated_at: string;
  source: string;
  count: number;
  /** ticker sem ".SA" (ex.: "PETR4") -> URL do logo SVG. */
  tickers: Record<string, string>;
};

/** Mapa ticker(bare) -> logo URL. `{}` se indisponível (frontend cai no badge de iniciais). */
export async function getAcoesLogos(): Promise<Record<string, string>> {
  const d = await fetchBlobJson<AcoesLogosData>("data/acoes_logos.json");
  return d?.tickers ?? {};
}

// ---------------------------------------------------------------------------
// Preço x Retorno total (preço + dividendos) por papel
// Pipeline: build_acoes_total_return.py -> data/acoes_total_return.json
// series: [[date, close_split_adj, adj_close_total_return], ...]
// ---------------------------------------------------------------------------

/** [date, close (só valorização, ajustado por splits), adj_close (retorno total)]. */
export type AcoesTotalReturnPoint = readonly [date: string, close: number, adj: number];

export type AcoesTotalReturnData = {
  status: "ok" | "error";
  generated_at: string;
  source: string;
  /** ticker com ".SA" (ex.: "PETR4.SA") -> { series }. */
  tickers: Record<string, { series: AcoesTotalReturnPoint[] }>;
};

export async function getAcoesTotalReturn(): Promise<AcoesTotalReturnData | null> {
  return fetchBlobJson<AcoesTotalReturnData>("data/acoes_total_return.json");
}

/** Normaliza um ticker para a chave do JSON de total return ("PETR4" | "petr4.sa" -> "PETR4.SA"). */
export function toTotalReturnKey(ticker: string): string {
  return `${ticker.trim().toUpperCase().replace(/\.SA$/i, "")}.SA`;
}

// ---------------------------------------------------------------------------
// Editorial (Prisma) — filtro tolerante por categoria
// ---------------------------------------------------------------------------

async function findAcoesPosts(orderBy: "recent" | "oldest", take: number): Promise<AcoesEditorialPost[]> {
  try {
    const posts = await prisma.post.findMany({
      where: {
        status: "APPROVED",
        published: true,
        OR: [
          { category: { contains: "acoes", mode: "insensitive" } },
          { category: { contains: "ações", mode: "insensitive" } },
          { category: { contains: "ação", mode: "insensitive" } },
          { category: { contains: "renda-vari", mode: "insensitive" } },
          { category: { contains: "bolsa", mode: "insensitive" } },
          { category: { contains: "ibov", mode: "insensitive" } },
        ],
      },
      orderBy: { createdAt: orderBy === "recent" ? "desc" : "asc" },
      take,
      select: {
        slug: true,
        title: true,
        excerpt: true,
        coverImage: true,
        authorName: true,
        createdAt: true,
      },
    });
    return posts.map((p) => ({
      slug: p.slug,
      title: p.title,
      excerpt: p.excerpt,
      coverImage: p.coverImage,
      authorName: p.authorName,
      createdAt: p.createdAt.toISOString(),
    }));
  } catch {
    return [];
  }
}

export async function getAcoesUltimasNoticias(): Promise<AcoesEditorialPost[]> {
  return findAcoesPosts("recent", 4);
}

export async function getAcoesArtigosMaisLidos(): Promise<AcoesEditorialPost[]> {
  return findAcoesPosts("oldest", 5);
}
