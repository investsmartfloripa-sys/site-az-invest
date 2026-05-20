/**
 * Loader dos JSONs da rota /painel-economico/economia/brasil/fiscal.
 *
 * JSONs gerados pelos scripts `data-pipeline/python/build_fiscal.py` e
 * `build_fiscal_termometro.py` (cron diário 9h BRT em `.github/workflows/fiscal-pipeline.yml`),
 * upload pro Vercel Blob em `data/fiscal-classicos.json` e `data/fiscal-termometro.json`.
 */

import { painelBlobUrl } from "@/lib/painel-blob";

/** Cache ISR de 1 hora. */
export const FISCAL_REVALIDATE_SECONDS = 3600;

// === Tipos base ===
export type PontoMensal = { data: string; valor: number | null };
export type PontoMensalPct = { data: string; valor_pct: number | null };
export type PontoDiario = { data: string; valor: number | null };

export type SelicRealPonto = {
  data: string;
  selic_nominal_pct: number | null;
  ipca_12m_pct: number | null;
  selic_real_pct: number | null;
};

export type FocusPonto = {
  data: string;
  mediana: number | null;
  media: number | null;
  dp: number | null;
  min: number | null;
  max: number | null;
};

export type DestaqueRecente = {
  data: string;
  valor?: number | null;
  valor_pct?: number | null;
  selic_real_pct?: number | null;
} | null;

// === fiscal-classicos.json ===
export type FiscalClassicosData = {
  gerado_em: string;
  mes_recente: string | null;
  pib_nominal_12m_brl_milhoes: number | null;
  divida: {
    dbgg_pct: PontoMensal[];
    dlsp_total_pct: PontoMensal[];
    dlsp_gov_central_pct: PontoMensal[];
  };
  resultado_fiscal: {
    primario_sp_12m_pct_pib: PontoMensalPct[];
    primario_central_12m_pct_pib: PontoMensalPct[];
    juros_nominais_sp_12m_pct_pib: PontoMensal[];
    juros_nominais_central_12m_pct_pib?: PontoMensal[];
    nfsp_sp_12m_pct_pib: PontoMensal[];
    nfsp_central_12m_pct_pib?: PontoMensal[];
    nominal_sp_12m_pct_pib: PontoMensalPct[];
  };
  stress: {
    reer_index: PontoMensal[];
    reservas_usd_mm_mensal: PontoMensal[];
  };
  monetaria: {
    selic_diaria_pct: PontoDiario[];
    ipca_12m_pct: PontoMensal[];
    selic_real_ex_post_pct: SelicRealPonto[];
  };
  pib: {
    acumulado_12m_brl_milhoes_mensal: PontoMensal[];
  };
  expectativas_focus: {
    selic_anuais: Record<string, FocusPonto[]>;
    ipca_anuais: Record<string, FocusPonto[]>;
    pib_anuais: Record<string, FocusPonto[]>;
    cambio_anuais: Record<string, FocusPonto[]>;
  };
  destaques: {
    dbgg_pct_recente: DestaqueRecente;
    dlsp_pct_recente: DestaqueRecente;
    primario_sp_12m_pct_recente: DestaqueRecente;
    primario_central_12m_pct_recente: DestaqueRecente;
    juros_nominais_sp_12m_pct_recente: DestaqueRecente;
    nfsp_sp_12m_pct_recente: DestaqueRecente;
    nominal_sp_12m_pct_recente: DestaqueRecente;
    reer_recente: DestaqueRecente;
    reservas_usd_recente: DestaqueRecente;
    selic_real_recente: DestaqueRecente;
  };
};

// === fiscal-termometro.json (18 indicadores Dalio) ===
export type Direcao = "maior_pior" | "maior_melhor";
export type Nivel = "verde" | "amarelo" | "vermelho" | "break" | "sem_dado";

export type IndicadorDalio = {
  titulo: string;
  fonte: string;
  categoria: string;
  verde: number;
  amarelo: number;
  vermelho: number;
  break: number;
  direcao: Direcao;
  marcos: string;
  narrativa: string;
  valor: number | null;
  nivel: Nivel;
  distancia_break: number | null;
};

export type ScoreGeral = {
  score_medio: number | null;
  nivel_geral: Nivel;
  n_indicadores: number;
};

export type FiscalTermometroData = {
  gerado_em: string;
  score: ScoreGeral;
  indicadores: Record<string, IndicadorDalio>;
  fonte_base: string | null;
  extras: {
    divida_externa_serie: PontoMensal[];
    spread_soberano_serie: PontoMensal[];
  };
  metodologia: string;
};

async function fetchBlobJson<T>(path: string): Promise<T | null> {
  const url = painelBlobUrl(path);
  if (!url) return null;
  try {
    const res = await fetch(url, { next: { revalidate: FISCAL_REVALIDATE_SECONDS } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function loadFiscalClassicos(): Promise<FiscalClassicosData | null> {
  return fetchBlobJson<FiscalClassicosData>("data/fiscal-classicos.json");
}

export async function loadFiscalTermometro(): Promise<FiscalTermometroData | null> {
  return fetchBlobJson<FiscalTermometroData>("data/fiscal-termometro.json");
}
