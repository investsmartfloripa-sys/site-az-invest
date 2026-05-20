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
};

export type NucleosBlock = { serie: Array<Record<string, number | null | string> & { mes: string }> };
export type DifusaoBlock = { serie: Array<{ mes: string; difusao: number | null }> };
export type CategoriasBlock = { serie: Array<Record<string, number | null | string> & { mes: string }> };

export type Influencia = { subitem: string; var: number; peso: number; contrib_pp: number };

export type FocusPonto = {
  data: string;
  mediana: number | null;
  media: number | null;
  dp: number | null;
  min: number | null;
  max: number | null;
};

export type IpcaData = {
  gerado_em: string;
  mes_recente: string;
  ipca_cheio: IpcaIndice;
  ipca_15: IpcaIndice;
  nucleos: NucleosBlock;
  difusao: DifusaoBlock;
  categorias?: CategoriasBlock;
  focus?: Record<string, FocusPonto[]>;
  maiores_influencias: {
    mes: string;
    top_altas: Influencia[];
    top_quedas: Influencia[];
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
