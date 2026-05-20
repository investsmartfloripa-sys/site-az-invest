/**
 * Loader dos JSONs da rota /painel-economico/economia/brasil/inflacao/igp-m.
 *
 * JSON gerado por `data-pipeline/python/build_igpm.py` (cron diário 9h BRT em
 * `.github/workflows/ipca-pipeline.yml`). Upload em `data/igpm.json` no Vercel Blob.
 *
 * Códigos SGS confirmados:
 *  189   IGP-M variação mensal
 *  192   IGP-M acumulado 12 meses
 *  7450  IPA-M cheio (60%)
 *  7456  IPC-M cheio (30%)
 *  7465  INCC-M cheio (10%)
 *  433   IPCA mensal (referência)
 *  13522 IPCA 12m (referência)
 */
import { painelBlobUrl } from "@/lib/painel-blob";

export const IGPM_REVALIDATE_SECONDS = 3600;

export type SerieIgpmOverview = Record<string, number | null | string> & { mes: string };

export type OverviewBlock = {
  serie: SerieIgpmOverview[];
  componentes: string[];
  mes_recente: string;
  ultimo_mensal: number | null;
  ultimo_12m: number | null;
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
  sazonalidade: Record<string, SazonalidadeMes>;
  maiores_altas: RankingPonto[];
  maiores_quedas: RankingPonto[];
  ultimo_mes: string;
  ultimo_mensal: number | null;
  ultimo_12m: number | null;
  ultimo_ano: number | null;
};

export type IgpmData = {
  gerado_em: string;
  mes_recente: string;
  fontes: Record<string, number>;
  pesos: Record<string, number>;
  overview: OverviewBlock;
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
