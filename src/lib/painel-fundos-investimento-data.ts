/**
 * Loader do JSON da rota /painel-economico/mercado/brasil/fundos-investimento.
 *
 * O JSON é gerado por:
 *  - data-pipeline/python/build_fundos_ranking.py -> data/fundos_ranking.json
 *    (fonte: Mais Retorno Data API, https://data.maisretorno.com/mr-data/v4/api)
 *
 * Convenção numérica (igual ao resto do painel): retornos, volatilidade e
 * drawdown vêm em PONTOS PERCENTUAIS (ex.: 6.22 = 6,22%) — direto p/ `fmtPct`.
 * Sharpe vem como razão pura (ex.: 0.27).
 */

import { painelBlobUrl } from "@/lib/painel-blob";

/** Cache ISR de 1 hora (o pipeline atualiza no máx. 1x/dia). */
export const FUNDOS_REVALIDATE_SECONDS = 3600;

/** Janelas de retorno disponíveis (limitadas pelo plano Mais Retorno). */
export type FundoJanela = "3m" | "6m" | "ytd" | "12m";

export type FundoRetornos = Partial<Record<FundoJanela, number | null>>;

export type FundoRow = {
  /** Identificador Mais Retorno no formato "<cnpj>:fi". */
  id: string;
  nome: string;
  gestora: string | null;
  cnpj: string | null;
  /** Retornos acumulados por janela, em pontos percentuais. */
  retornos: FundoRetornos;
  /** Volatilidade anualizada (12m), em pontos percentuais. */
  vol_12m: number | null;
  /** Índice de Sharpe (12m) vs CDI, razão pura. */
  sharpe_12m: number | null;
  /** Máximo drawdown na janela (12m), em pontos percentuais (negativo). */
  drawdown_12m: number | null;
};

export type FundoCategoria = {
  key: string;
  label: string;
  /** Métrica usada na ordenação inicial. */
  metric_default: "sharpe_12m" | FundoJanela;
  funds: FundoRow[];
};

export type FundosRanking = {
  status: "ok" | "error";
  generated_at: string;
  /** Data do dado mais recente (D-1). */
  data_date: string | null;
  /** Plano Mais Retorno usado na geração (define a profundidade do histórico). */
  plan: string;
  /** Rótulo do limite de histórico do plano (ex.: "12m" no free). */
  plan_history_limit: string;
  source: string;
  /** Retorno do CDI por janela (pontos percentuais) — benchmark livre de risco. */
  cdi?: FundoRetornos;
  categories: FundoCategoria[];
};

async function fetchBlobJson<T>(path: string): Promise<T | null> {
  const url = painelBlobUrl(path);
  if (!url) return null;
  try {
    const res = await fetch(url, { next: { revalidate: FUNDOS_REVALIDATE_SECONDS } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function getFundosRanking(): Promise<FundosRanking | null> {
  return fetchBlobJson<FundosRanking>("data/fundos_ranking.json");
}

// ── Séries de cota por fundo (gráfico da página de detalhe) ─────────────────

/** Ponto de série temporal no formato [ISO, valor] esperado pelos charts. */
export type QuoteSeries = ReadonlyArray<readonly [string, number]>;

export type FundoQuotes = {
  generated_at: string;
  data_date: string | null;
  /** Série diária do CDI (nível do índice) — benchmark do gráfico. */
  cdi: QuoteSeries;
  /** Série de cota por identificador "<cnpj>:fi". */
  funds: Record<string, { nome: string; series: QuoteSeries }>;
};

export async function getFundosQuotes(): Promise<FundoQuotes | null> {
  return fetchBlobJson<FundoQuotes>("data/fundos_quotes.json");
}

/** Slug da página de detalhe = CNPJ (só dígitos) do fundo. */
export function fundoSlug(fund: Pick<FundoRow, "id" | "cnpj">): string {
  return (fund.cnpj ?? fund.id.split(":")[0]).replace(/\D/g, "");
}

export type FundoDetail = {
  fund: FundoRow;
  categoria: FundoCategoria;
  series: QuoteSeries;
  cdiSeries: QuoteSeries;
  generatedAt: string;
  dataDate: string | null;
  /** CDI por janela (do ranking) — referência nas métricas. */
  cdi?: FundoRetornos;
};

/** Combina ranking (métricas) + cotas (série) para um fundo pelo slug (CNPJ). */
export async function getFundoDetail(slug: string): Promise<FundoDetail | null> {
  const key = slug.replace(/\D/g, "");
  const [ranking, quotes] = await Promise.all([getFundosRanking(), getFundosQuotes()]);
  if (!ranking) return null;
  for (const categoria of ranking.categories) {
    const fund = categoria.funds.find((f) => fundoSlug(f) === key);
    if (fund) {
      const q = quotes?.funds?.[fund.id];
      return {
        fund,
        categoria,
        series: q?.series ?? [],
        cdiSeries: quotes?.cdi ?? [],
        generatedAt: quotes?.generated_at ?? ranking.generated_at,
        dataDate: quotes?.data_date ?? ranking.data_date,
        cdi: ranking.cdi,
      };
    }
  }
  return null;
}
