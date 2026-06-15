/**
 * Loaders dos JSONs da rota /painel-economico/mercado/brasil/renda-fixa.
 *
 * Os JSONs sao gerados pelos scripts:
 *  - build_anbima_tpf.py        -> data/treasury_history.json
 *  - build_anbima_debentures.py -> data/credit_spreads_history.json
 */

import { painelBlobUrl } from "@/lib/painel-blob";

/** Cache ISR de 1 hora. */
export const RENDA_FIXA_REVALIDATE_SECONDS = 3600;

export type TreasuryCategory = {
  label: string;
  vencimentos: string[];
  series: Record<string, Array<[string, number]>>;
};

export type TreasuryHistory = {
  status: "ok" | "error";
  generated_at: string;
  source: string;
  lookback_business_days: number;
  days_loaded: number;
  days_failed: number;
  last_data_date: string;
  categories: {
    PRE?: TreasuryCategory;
    IPCA?: TreasuryCategory;
  };
};

export type CreditSeries = {
  median: Array<[string, number]>;
  p25: Array<[string, number]>;
  p75: Array<[string, number]>;
  n: Array<[string, number]>;
  pct_neg?: Array<[string, number]>;
  pct_mid?: Array<[string, number]>;
  pct_high?: Array<[string, number]>;
  mean_weighted?: Array<[string, number]>;
};

export type CreditClass = {
  label: string;
  series: CreditSeries;
};

export type CreditSpreadsHistory = {
  status: "ok" | "error";
  generated_at: string;
  source: string;
  note: string;
  lookback_business_days: number;
  days_loaded: number;
  days_failed: number;
  last_data_date: string;
  classes: {
    DI?: CreditClass;
    IPCA?: CreditClass;
    PRE?: CreditClass;
  };
};

async function fetchBlobJson<T>(path: string): Promise<T | null> {
  const url = painelBlobUrl(path);
  if (!url) return null;
  try {
    const res = await fetch(url, { next: { revalidate: RENDA_FIXA_REVALIDATE_SECONDS } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/**
 * Máximo de pontos por série enviado ao cliente. O JSON bruto tem ~2,3 MB
 * (histórico diário longo por vencimento, incluindo backfill desde 2010).
 * Passar isso INTEIRO como prop de Server→Client estoura o payload RSC (Flight)
 * embutido no HTML e QUEBRA a hidratação do gráfico (o componente renderiza no
 * SSR mas nunca hidrata no cliente). ~520 pontos ≈ 2 anos de pregões — cobre a
 * janela útil do gráfico com folga e derruba o payload para centenas de KB.
 */
const TREASURY_MAX_POINTS_PER_SERIES = 520;

export async function getTreasuryHistory(): Promise<TreasuryHistory | null> {
  const data = await fetchBlobJson<TreasuryHistory>("data/treasury_history.json");
  if (!data) return null;
  for (const cat of Object.values(data.categories)) {
    if (!cat) continue;
    for (const venc of Object.keys(cat.series)) {
      const serie = cat.series[venc];
      if (serie.length > TREASURY_MAX_POINTS_PER_SERIES) {
        cat.series[venc] = serie.slice(-TREASURY_MAX_POINTS_PER_SERIES);
      }
    }
  }
  return data;
}

export async function getCreditSpreadsHistory(): Promise<CreditSpreadsHistory | null> {
  return fetchBlobJson<CreditSpreadsHistory>("data/credit_spreads_history.json");
}

export async function getRendaFixaData() {
  const [treasury, credit] = await Promise.all([
    getTreasuryHistory(),
    getCreditSpreadsHistory(),
  ]);
  return { treasury, credit };
}
