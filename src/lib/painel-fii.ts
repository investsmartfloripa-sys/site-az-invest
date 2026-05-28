/**
 * Loaders e tipos do painel de Fundos Imobiliários.
 *
 * Pipelines (cron diário 22:35 UTC, workflow .github/workflows/fii-pipeline.yml):
 *  - build_fii_ifix.py       -> data/fii_ifix.json
 *      Série histórica do IFIX (proxy XFIX11.SA via yfinance, ~5a)
 *      + benchmarks (CDI BCB SGS 12, IBOV ^BVSP, IMAB11.SA, B5P211.SA)
 *      + métricas hero (valor atual, máx/mín 12m, variação 1d).
 *
 *  - build_fii_screener.py   -> data/fii_screener.json
 *      Universo: composição IFIX (B3 GetPortfolioDay) + dados curados.
 *      Por ticker: preço (yfinance), volume médio (liquidez),
 *      DY 12m calculado, P/VP (CVM informe mensal), PL absoluto.
 *
 * Toda função retorna null em caso de falha (mesmo padrão do painel-data.ts).
 */
import { painelBlobUrl } from "@/lib/painel-blob";
import { prisma } from "@/lib/prisma";

/** Cache ISR de 1 hora — dados atualizam 1x/dia. */
export const FII_REVALIDATE_SECONDS = 3600;

// ---------------------------------------------------------------------------
// IFIX (hero + chart histórico com comparação)
// ---------------------------------------------------------------------------

export type FiiBenchmarkKey = "IMAB" | "IMAB5P" | "CDI" | "IBOV";

export type FiiTimeSeriesPoint = {
  date: string; // YYYY-MM-DD
  ifix: number; // valor normalizado (base 100 no início da janela)
  IMAB?: number | null;
  IMAB5P?: number | null;
  CDI?: number | null;
  IBOV?: number | null;
};

export type FiiIfixHero = {
  /** Valor absoluto do IFIX (proxy XFIX11 reescalado para escala do índice). */
  last_value: number;
  last_date: string;
  /** Variação diária em % */
  change_pct_1d: number | null;
  /** Máx e mín das últimas 12 meses (na escala do índice) */
  max_12m: number;
  min_12m: number;
};

export type FiiIfixData = {
  status: "ok" | "error";
  generated_at: string;
  source_primary: string; // ex.: "B3 GetPortfolioDay (composição)"
  source_history: string; // ex.: "XFIX11.SA via yfinance (proxy)"
  benchmark_sources: Record<FiiBenchmarkKey, string>;
  hero: FiiIfixHero | null;
  /** Série diária completa (~5a). UI escolhe janela e renormaliza para base 100. */
  series_daily: FiiTimeSeriesPoint[];
};

// ---------------------------------------------------------------------------
// Screener
// ---------------------------------------------------------------------------

export type FiiSegment =
  | "Papel"
  | "Logística"
  | "Lajes"
  | "Shoppings"
  | "Híbrido"
  | "FoF"
  | "Renda urbana"
  | "Residencial"
  | "Hospitalar"
  | "Educacional"
  | "Hotelaria"
  | "Agro"
  | "Outros";

export type FiiScreenerRow = {
  ticker: string; // ex.: "HGLG11"
  cnpj: string | null;
  name: string; // nome curto (denominação social abreviada)
  segment: FiiSegment | string;
  /** "curated" = override interno; "cvm" = classificação CVM. */
  segment_source?: "curated" | "cvm";
  /** Preço fechamento mais recente (BRL). */
  price: number | null;
  price_date: string | null;
  /** Dividend Yield 12m: soma de dividendos / preço atual, em %. */
  dy_12m_pct: number | null;
  /** True quando DY > 18% — pode incluir amortização de capital. */
  dy_atypical?: boolean;
  /** Preço / Valor Patrimonial por cota. */
  pvp: number | null;
  pvp_ref_date: string | null; // data de referência CVM
  /** True quando P/VP < 0.7 — possível distress. */
  pvp_warning?: boolean;
  /** Patrimônio Líquido absoluto (BRL). */
  pl: number | null;
  pl_ref_date: string | null;
  /** Volume médio diário 21d (BRL). */
  liquidity_avg_21d: number | null;
  /** Participação no IFIX em % (se faz parte do índice). */
  ifix_weight_pct: number | null;
  in_ifix: boolean;
};

export type FiiScreenerData = {
  status: "ok" | "error";
  generated_at: string;
  total_in_ifix: number;
  total_rows: number;
  rows: FiiScreenerRow[];
  segments: string[]; // lista única ordenada para filtros
};

// ---------------------------------------------------------------------------
// Editorial (Posts) — vem do banco via Prisma, mas exposto via loader pra
// manter o page.tsx server component limpo.
// ---------------------------------------------------------------------------

export type FiiEditorialPost = {
  slug: string;
  title: string;
  excerpt: string | null;
  coverImage: string | null;
  authorName: string;
  createdAt: string;
};

// ---------------------------------------------------------------------------
// Fetchers
// ---------------------------------------------------------------------------

async function fetchBlobJson<T>(path: string): Promise<T | null> {
  const url = painelBlobUrl(path);
  if (!url) return null;
  try {
    const res = await fetch(url, { next: { revalidate: FII_REVALIDATE_SECONDS } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function getFiiIfix(): Promise<FiiIfixData | null> {
  return fetchBlobJson<FiiIfixData>("data/fii_ifix.json");
}

export async function getFiiScreener(): Promise<FiiScreenerData | null> {
  return fetchBlobJson<FiiScreenerData>("data/fii_screener.json");
}

// ---------------------------------------------------------------------------
// Página individual de cada FII (etapa 2)
// ---------------------------------------------------------------------------

export type FiiDividend = {
  /** Data com (data-ex), YYYY-MM-DD. */
  data_com: string;
  /** Data de pagamento (yfinance só tem data-ex; pagamento normalmente é ~15 do
   *  mês seguinte — backend pode estimar pra `data_com + ~15d` se não tiver). */
  pagamento: string | null;
  /** Valor pago por cota (BRL). */
  valor: number;
};

export type FiiDetailHero = {
  /** DY 12m em % (igual ao do screener). */
  dy_12m_pct: number | null;
  /** Último rendimento pago (R$/cota). */
  last_dividend_brl: number | null;
  last_dividend_date: string | null;
  /** Patrimônio Líquido (BRL). */
  pl: number | null;
  pl_ref_date: string | null;
  /** P/VP. */
  pvp: number | null;
  pvp_ref_date: string | null;
  /** Cotação atual. */
  price: number | null;
  price_date: string | null;
  /** Variação % do dia. */
  change_pct_1d: number | null;
  /** Máx/mín 12m da cotação. */
  max_12m: number | null;
  min_12m: number | null;
};

export type FiiDetailIndicators = {
  /** VP por cota (BRL). */
  vp_per_cota: number | null;
  /** P/VP (repete o do hero). */
  pvp: number | null;
  /** Número de cotistas. */
  num_cotistas: number | null;
  /** CAGR 3a do DY (taxa equivalente anualizada da soma anual de dividendos). */
  dy_cagr_3y_pct: number | null;
  /** CAGR 3a da cotação (price-only, sem reinvestimento). */
  valor_cagr_3y_pct: number | null;
  /** Participação no IFIX (%). */
  ifix_weight_pct: number | null;
};

export type FiiDetailFicha = {
  cnpj: string | null;
  full_name: string | null;
  admin_name: string | null;
  admin_cnpj: string | null;
  segment: string | null;
};

export type FiiDetailEntry = {
  ticker: string;
  name: string;
  hero: FiiDetailHero;
  indicators: FiiDetailIndicators;
  ficha: FiiDetailFicha;
  /** Série diária de fechamento (~5 anos). Frontend reutiliza TimeWindowToggle. */
  price_series_daily: Array<{ date: string; close: number }>;
  /** Histórico de dividendos (mais recente primeiro). */
  dividends: FiiDividend[];
  /** Flags herdadas do screener (úteis pra tooltip). */
  dy_atypical?: boolean;
  pvp_warning?: boolean;
};

export type FiiDetailsData = {
  status: "ok" | "error";
  generated_at: string;
  total: number;
  /** Indexado por ticker (HGLG11, KNCR11, ...) — facilita lookup O(1). */
  by_ticker: Record<string, FiiDetailEntry>;
};

export async function getFiiDetails(): Promise<FiiDetailsData | null> {
  // `cache: 'no-store'` — o JSON pesa ~4,6 MB e o cache ISR servia páginas
  // vazias intermitentemente quando o entry não estava na snapshot do build.
  // No-store força fetch fresh em todo render, o Vercel Blob (Cloudflare) é
  // rápido o suficiente pra não pesar.
  const url = painelBlobUrl("data/fii_details.json");
  if (!url) return null;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as FiiDetailsData;
  } catch {
    return null;
  }
}

export async function getFiiDetail(ticker: string): Promise<FiiDetailEntry | null> {
  const all = await getFiiDetails();
  if (!all || all.status !== "ok") return null;
  return all.by_ticker[ticker.toUpperCase()] ?? null;
}

export async function getFiiTickers(): Promise<string[]> {
  const all = await getFiiDetails();
  if (!all) return [];
  return Object.keys(all.by_ticker);
}

// ---------------------------------------------------------------------------
// Editorial (Prisma)
// ---------------------------------------------------------------------------

/**
 * Busca posts ligados ao tema FII no blog do site. Filtro é tolerante:
 * aceita category que contenha "fii", "imobili" ou "fundos-imobiliarios"
 * (case insensitive), permitindo curadoria editorial flexível sem
 * obrigar uma taxonomia rígida pré-existente.
 */
async function findFiiPosts(orderBy: "recent" | "oldest", take: number): Promise<FiiEditorialPost[]> {
  try {
    const posts = await prisma.post.findMany({
      where: {
        published: true,
        OR: [
          { category: { contains: "fii", mode: "insensitive" } },
          { category: { contains: "imobili", mode: "insensitive" } },
          { category: { contains: "fundos-imobiliarios", mode: "insensitive" } },
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

export async function getFiiUltimasNoticias(): Promise<FiiEditorialPost[]> {
  return findFiiPosts("recent", 4);
}

export async function getFiiArtigosMaisLidos(): Promise<FiiEditorialPost[]> {
  // Sem coluna `views` no modelo Post; usa os 5 mais antigos publicados como
  // "fundamentais / mais consolidados" enquanto a métrica de visualizações
  // não existir. Substituir por GA / Plausible no futuro.
  return findFiiPosts("oldest", 5);
}
