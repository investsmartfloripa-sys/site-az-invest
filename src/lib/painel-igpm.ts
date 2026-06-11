/**
 * Loader dos JSONs da rota /painel-economico/economia/brasil/inflacao/igp-m.
 *
 * JSON gerado por `data-pipeline/python/build_igpm.py` (cron diário 9h BRT em
 * `.github/workflows/ipca-pipeline.yml`). Upload em `data/igpm.json` no Vercel Blob.
 *
 * Códigos SGS:
 *  189   IGP-M variação mensal (o 12m é COMPOSTO no builder — o antigo
 *        SGS 192 NÃO era IGP-M 12m e foi aposentado no schema v2)
 *  7450  IPA-M cheio (peso de origem 60%)
 *  7456  IPC-M cheio (30%)
 *  7465  INCC-M cheio (10%)
 *  433   IPCA mensal (referência)
 *  13522 IPCA 12m (referência)
 *
 * schema_version 2 (2026-06): decomposição com pesos efetivos encadeados e
 * resíduo explícito (`decomposicao`), correlação IPA->IPCA (`antecipacao`),
 * reajustes de aluguel (`aluguel`), série completa p/ tabela/CSV (`analise`)
 * e estatísticas pós-1996 — tudo calculado no builder, nunca no front.
 */
import { painelBlobUrl } from "@/lib/painel-blob";

export const IGPM_REVALIDATE_SECONDS = 3600;

export type SerieIgpmOverview = Record<string, number | null | string> & { mes: string };

/** Estatísticas da variação mensal (janela declarada em `desde`). */
export type EstatisticasJanela = {
  n: number;
  desde?: string | null;
  media: number;
  mediana: number;
  std: number;
  min: number;
  max: number;
  positivos_pct: number;
  negativos_pct: number;
};

/** Régua do acumulado 12m: distribuição histórica pós-corte + percentil do valor atual. */
export type Estatisticas12m = {
  desde: string;
  n: number;
  media: number;
  mediana: number;
  negativos_pct: number;
  percentil_atual?: number;
};

export type OverviewBlock = {
  serie: SerieIgpmOverview[];
  componentes: string[];
  mes_recente: string;
  ultimo_mensal: number | null;
  /** schema v2: 12m COMPOSTO no builder (validado contra oficiais FGV). */
  ultimo_12m: number | null;
  /** schema v2: padrão do mês civil do IGP-M cheio (jan/1996+). */
  sazonalidade_pos96?: Record<string, SazonalidadeMes>;
  estatisticas_pos96?: EstatisticasJanela;
  estatisticas_12m?: Estatisticas12m;
};

/**
 * schema v2 — âncora: decomposição mensal com PESOS EFETIVOS encadeados
 * (w_c,t = w_c0·I_c,t−1 / Σ w_c0·I_c,t−1) e resíduo estrutural EXPLÍCITO.
 * Cada item da série traz "<comp> (contrib)", "<comp> (peso efetivo)",
 * "IGP-M", "IGP-M 12m" (p/ sombrear deflação) e "residuo_pp".
 */
export type DecomposicaoBlock = {
  metodo: string;
  base_encadeamento: string;
  componentes: string[];
  serie: SerieIgpmOverview[];
};

/** schema v2 — correlação cruzada IPA-M 12m × IPCA 12m (defasagens 0–6m). */
export type AntecipacaoLag = {
  lag: number;
  corr_pos96: number | null;
  n_pos96: number;
  corr_pos2016: number | null;
  n_pos2016: number;
};

export type AntecipacaoBlock = {
  janela_total: string;
  janela_recente: string;
  lags: AntecipacaoLag[];
  melhor_lag: number;
  melhor_corr_pos96: number | null;
  melhor_lag_pos2016: number | null;
  melhor_corr_pos2016: number | null;
  serie: Array<{ mes: string; ipa_12m: number | null; ipca_12m: number | null }>;
};

/** schema v2 — reajuste anual de contrato indexado ao IGP-M (cláusula de não-redução aplicada). */
export type AluguelReajuste = {
  ano: number;
  mes: string;
  igpm_12m: number;
  ipca_12m: number;
  aplicado_pct: number;
  clausula_nao_reducao: boolean;
};

export type AluguelBlock = {
  mes_referencia: string;
  reajustes: AluguelReajuste[];
};

/** schema v2 — série mensal completa (120m) p/ a tabela/CSV da análise. */
export type AnalisePonto = {
  mes: string;
  igpm: number | null;
  ipa: number | null;
  ipc: number | null;
  incc: number | null;
  igpm_12m: number | null;
  ipca_12m: number | null;
  spread_12m: number | null;
};

export type ComparativoPonto = {
  mes: string;
  igpm_12m: number | null;
  ipca_12m: number | null;
  spread: number | null;
};

export type SerieLongaPonto = {
  mes: string;
  mensal: number | null;
  acum_12m: number | null;
  acum_ano: number | null;
  ipca_mensal: number | null;
  ipca_12m: number | null;
  spread_12m: number | null;
};

export type EstatisticasComp = {
  n?: number;
  media?: number;
  mediana?: number;
  std?: number;
  min?: number;
  max?: number;
  positivos_pct?: number;
  negativos_pct?: number;
};

export type SazonalidadeMes = {
  media: number | null;
  /** schema v2: estatística central recomendada (robusta a outliers). */
  mediana?: number | null;
  std: number | null;
  n: number;
  min: number | null;
  max: number | null;
};

export type RankingPonto = { mes: string; valor: number };

export type SubPainelComponente = {
  peso_igpm: number;
  serie_longa: SerieLongaPonto[];
  estatisticas: EstatisticasComp;
  /** schema v2: régua do 12m (percentil do atual, média/mediana pós-96). */
  estatisticas_12m?: Estatisticas12m;
  sazonalidade: Record<string, SazonalidadeMes>;
  maiores_altas: RankingPonto[];
  maiores_quedas: RankingPonto[];
  ultimo_mes: string;
  ultimo_mensal: number | null;
  ultimo_12m: number | null;
  ultimo_ano: number | null;
};

export type IgpmData = {
  /** 2 = builder com 12m composto, pesos efetivos e blocos novos (jun/2026). */
  schema_version?: number;
  gerado_em: string;
  mes_recente: string;
  fontes: Record<string, number>;
  pesos: Record<string, number>;
  overview: OverviewBlock;
  decomposicao?: DecomposicaoBlock;
  antecipacao?: AntecipacaoBlock;
  aluguel?: AluguelBlock;
  analise?: { serie: AnalisePonto[] };
  comparativo_ipca: ComparativoPonto[];
  componentes: Record<string, SubPainelComponente>;
  igpm: OverviewBlock;
};

async function fetchBlobJson<T>(path: string): Promise<T | null> {
  const url = painelBlobUrl(path);
  if (!url) return null;
  try {
    const res = await fetch(url, { next: { revalidate: IGPM_REVALIDATE_SECONDS } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function loadIgpmData(): Promise<IgpmData | null> {
  return fetchBlobJson<IgpmData>("data/igpm.json");
}
