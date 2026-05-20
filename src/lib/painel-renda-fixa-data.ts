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

export async function getTreasuryHistory(): Promise<TreasuryHistory | null> {
  return fetchBlobJson<TreasuryHistory>("data/treasury_history.json");
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
