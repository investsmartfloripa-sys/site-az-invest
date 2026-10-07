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
import { fetchPainelBlob } from "@/lib/painel-blob";
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
  // ---- schema_version 2 (out/2026): LPA reportado por data de anúncio ----
  schema_version?: number;
  last_data_date?: string | null;
  /** P/L do último dia útil de cada mês desde 2011 (Y do modelo P/L × juros). */
  pl_mensal?: Array<{
    date: string;
    pl: number;
    excl: number;
    excl_teto: number;
    excl_prejuizo: number;
    excl_sem_dado: number;
  }>;
  excl_hoje?: { sem_dado: number | null; prejuizo: number | null; teto: number | null } | null;
  /** Correções mecânicas do LPA (moeda/unidade), papel → motivo. */
  lpa_ajustes?: Record<string, string>;
  lpa_irma?: Record<string, string>;
  cortes_descontinuidade?: Record<string, string>;
};

// ---------------------------------------------------------------------------
// Modelo P/L × juros reais (build_ibov_pl_modelo.py → data/ibov_pl_modelo.json)
// ---------------------------------------------------------------------------

export type IbovPlModeloVarKey =
  | "real_selic"
  | "real_5a"
  | "real_30a"
  | "dselic_e"
  | "us10_real"
  | "fed_real"
  | "cupom_real_e"
  | "t_us10";

/** Uma linha por mês: P/L observado, linhas justificadas e as explicativas (média mensal). */
export type IbovPlModeloRow = {
  date: string; // último dia útil com dado no mês (no mês corrente: a data mais recente)
  mes: string; // YYYY-MM
  parcial: boolean;
  na_amostra: boolean;
  pl: number | null;
  fit_juros: number | null;
  fit_completo: number | null;
  excl: number | null;
  excl_teto: number | null;
  excl_prejuizo: number | null;
  excl_sem_dado: number | null;
} & Record<IbovPlModeloVarKey, number | null>;

export type IbovPlModeloVariavel = {
  key: IbovPlModeloVarKey;
  nome: string;
  unidade: string; // "%" | "p.p."
  tipo: "nível" | "direção";
  formula: string;
  coef: number | null;
  ep: number | null;
  t: number | null;
  p: number | null;
  vif: number | null;
  hoje: number | null;
  media: number | null;
  min: number | null;
  max: number | null;
  coef_so_juros: number | null;
  /** Efeito de +1 (p.p.) na variável sobre o P/L justificado de hoje, com as outras paradas. */
  efeito_1pp?: number | null;
  /** Idem para +0,1 p.p. (legendas). */
  efeito_01pp?: number | null;
};

export type IbovPlModeloResumo = {
  r2: number | null;
  r2_aj: number | null;
  aic: number | null;
  sigma: number | null;
  n: number;
  const: number | null;
  adf_residuo_p: number | null;
  vars: IbovPlModeloVarKey[];
  ecm_gamma?: number | null;
  ecm_gamma_p?: number | null;
  meia_vida_meses?: number | null;
};

export type IbovPlModeloDecomp = {
  media_pl: number | null;
  justificado: number | null;
  /** Lucro sobre preço médio da amostra (%), ponto de partida (schema 2). */
  media_ey?: number | null;
  blocos: Array<{
    bloco: string;
    nome: string;
    efeito: number | null;
    efeito_ey?: number | null;
    itens: Array<{ key: IbovPlModeloVarKey; nome: string; efeito: number | null; efeito_ey?: number | null }>;
  }>;
};

/** Projeção pelas implícitas do dia (schema 4): Selic e Fed Funds seguem as trajetórias do Panorama,
 *  as demais variáveis ficam paradas; o 1º ponto é o justificado de hoje. */
export type IbovPlModeloProjecao = {
  inicio: string;
  fim: string;
  pontos: Array<{
    mes: string;
    date: string;
    selic: number | null;
    fed: number | null;
    juros: number | null;
    completo: number | null;
  }>;
  selic: { origem: string; ref: string; gerado_em?: string | null; vol_mult?: number | null };
  fed: { origem: string; ref: string } | null;
  premissas: string;
};

export type IbovPlModeloData = {
  schema_version: number;
  status: "ok" | "error";
  generated_at: string;
  last_data_date: string;
  /** Último mês completo da amostra de estimação (YYYY-MM). */
  estimado_ate: string;
  min_start_date: string;
  amostra: { inicio: string; fim: string; n: number; buracos: Array<[string, string]> };
  hoje: {
    data: string;
    mes: string;
    parcial: boolean;
    pl: number;
    z: number | null;
    justificado_juros: number;
    ic_juros: [number | null, number | null];
    justificado_completo: number;
    ic_completo: [number | null, number | null];
    desvio_juros_pct: number | null;
    desvio_completo_pct: number | null;
    excl: { total: number | null; teto: number | null; prejuizo: number | null; sem_dado: number | null };
  };
  pl_stats: {
    mean: number;
    sd: number;
    minus2: number;
    minus1: number;
    plus1: number;
    plus2: number;
    n: number;
    inicio: string;
    z_hoje: number | null;
  };
  serie: IbovPlModeloRow[];
  variaveis: IbovPlModeloVariavel[];
  modelos: {
    juros: IbovPlModeloResumo;
    completo: IbovPlModeloResumo & { reset_p?: number | null };
    /** "ey" (schema 2): estimado no lucro sobre preço, justificado = 1/EY. */
    forma?: string;
  };
  testes_f: Array<{ bloco: string; nome: string; F: number | null; p: number }>;
  /** +1 p.p. nas três taxas reais brasileiras ao mesmo tempo, em x de P/L (schema 3). */
  efeito_juros_juntos?: number | null;
  efeito_juros_juntos_01?: number | null;
  /** Juro real dos EUA +1 p.p. em 12 meses, em x de P/L (schema 2). */
  efeito_eua?: {
    total: number | null; // nível + tendência + repasse típico aos juros brasileiros
    so_eua: number | null; // nível + tendência com os juros brasileiros parados
    nivel_parado: number | null;
    total_01?: number | null;
    repasse: Record<string, number | null>;
  };
  dispersao: Array<{
    key: IbovPlModeloVarKey;
    nome: string;
    /** "%" ou "p.p." (blobs antigos não trazem). */
    unidade?: string;
    /** "juros" (as 3 taxas) ou "outras" (demais variáveis do completo). */
    grupo?: "juros" | "outras";
    /** "bruto" = P/L observado; "parcial" = com as outras variáveis na média (schema 2+). */
    tipo?: "bruto" | "parcial";
    /** "ey" (schema 3): pontos/curva/hoje em lucro sobre preço (%); sem o campo, em P/L. */
    eixo?: "ey" | "pl";
    /** [x, P/L, "YYYY-MM"] de cada mês da amostra (schema 2). */
    pontos?: Array<[number, number, string]>;
    /** Curva da relação, já em P/L (schema 2). */
    curva?: Array<[number, number]>;
    hoje?: [number, number] | null;
    a: number | null;
    b: number | null;
    t: number | null;
    r2: number | null;
    x0: number | null;
    y0?: number | null;
    x1: number | null;
    y1?: number | null;
  }>;
  decomposicao: { completo: IbovPlModeloDecomp; juros: IbovPlModeloDecomp };
  coef_history?: Array<{
    mes: string;
    n: number;
    r2: number | null;
    r2_juros: number | null;
    coefs: Record<string, number | null>;
  }>;
  avisos: string[];
  projecao?: IbovPlModeloProjecao | null;
  fontes_ultima_data?: Record<string, string | null>;
  fontes?: Record<string, string>;
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
  try {
    // Cache tag `blob:<path>` — POST /api/revalidate purga assim que o pipeline escreve.
    const res = await fetchPainelBlob(path, ACOES_REVALIDATE_SECONDS);
    if (!res?.ok) return null;
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

/** Modelo P/L × juros reais. Null (→ card legado) se o blob faltar ou vier sem série. */
export async function getIbovPlModelo(): Promise<IbovPlModeloData | null> {
  const d = await fetchBlobJson<IbovPlModeloData>("data/ibov_pl_modelo.json");
  return d && d.status === "ok" && Array.isArray(d.serie) && d.serie.length > 1 ? d : null;
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
