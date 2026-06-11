/**
 * Loader dos JSONs da rota /painel-economico/economia/brasil/inflacao/ipca.
 *
 * JSON gerado pelo script `data-pipeline/python/build_ipca.py` (cron diário 9h BRT
 * em `.github/workflows/ipca-pipeline.yml`), upload pro Vercel Blob em `data/ipca.json`.
 */

import { painelBlobUrl } from "@/lib/painel-blob";

/** Cache ISR de 1 hora. */
export const IPCA_REVALIDATE_SECONDS = 3600;

export type SerieGrupo = Record<string, number | null | string> & { mes: string };

export type IpcaIndice = {
  serie: SerieGrupo[];
  pesos_recentes: Record<string, number>;
  mes_recente: string;
  grupos: string[];
  /**
   * schema v2: contribuição de cada grupo ao acumulado 12m, ENCADEADA no
   * builder com resíduo realocado pró-rata — a pilha fecha exatamente com o
   * "IPCA 12m" oficial (v2265) presente em cada item. Nunca recalcular no front.
   */
  serie_contrib_12m?: SerieGrupo[];
};

export type NucleosBlock = {
  serie: Array<Record<string, number | null | string> & { mes: string }>;
  /** schema v2: 12m composto de cada núcleo + media_nucleos / nucleos_min / nucleos_max (5 núcleos do BC). */
  serie_12m?: Array<Record<string, number | null | string> & { mes: string }>;
  /** Núcleos que entram na média (EX0, EX3, MS, DP, P — sem MA). */
  conjunto_media?: string[];
};
export type DifusaoBlock = {
  serie: Array<{ mes: string; difusao: number | null; mm3?: number | null }>;
  /** schema v2: régua histórica calculada no builder (jan/2012+). */
  media_historica?: { desde: string; media: number | null; dp: number | null; n: number };
};
export type CategoriasBlock = {
  serie: Array<Record<string, number | null | string> & { mes: string }>;
  /** schema v2: 12m composto de Livres/Monitorados/Serviços/Comercializáveis. */
  serie_12m?: Array<Record<string, number | null | string> & { mes: string }>;
};

export type Influencia = { subitem: string; var: number; peso: number; contrib_pp: number };

export type FocusPonto = {
  data: string;
  mediana: number | null;
  media: number | null;
  dp: number | null;
  min: number | null;
  max: number | null;
};

/** Estatística da variação mensal de um mês civil (janela de 10 anos do builder). */
export type SazonalidadeStats = {
  mediana: number | null;
  media: number | null;
  min: number | null;
  max: number | null;
  n: number;
};

export type IpcaData = {
  /** 2 = builder com acumulados compostos/contribuições encadeadas (jun/2026). */
  schema_version?: number;
  gerado_em: string;
  mes_recente: string;
  ipca_cheio: IpcaIndice;
  ipca_15: IpcaIndice;
  nucleos: NucleosBlock;
  difusao: DifusaoBlock;
  categorias?: CategoriasBlock;
  /** schema v2: mediana/mín/máx da variação mensal por mês civil ("01".."12"). */
  sazonalidade?: { janela: string; por_mes: Record<string, SazonalidadeStats> };
  focus?: Record<string, FocusPonto[]>;
  maiores_influencias: {
    mes: string;
    top_altas: Influencia[];
    top_quedas: Influencia[];
    /** schema v2: lista completa de subitens do mês corrente (~440). */
    todos?: Influencia[];
  };
};

async function fetchBlobJson<T>(path: string): Promise<T | null> {
  const url = painelBlobUrl(path);
  if (!url) return null;
  try {
    const res = await fetch(url, { next: { revalidate: IPCA_REVALIDATE_SECONDS } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function loadIpcaData(): Promise<IpcaData | null> {
  return fetchBlobJson<IpcaData>("data/ipca.json");
}
