/**
 * Loader server-side dos dados do Painel IPCA.
 *
 * Lê o JSON do Vercel Blob (`data/ipca.json`) com revalidação ISR de 1 hora.
 * Em build sem `NEXT_PUBLIC_BLOB_BASE_URL` ou fora do ar, faz fallback pro
 * snapshot local em `/public/data/ipca.json` (servido pelo próprio Next).
 *
 * O snapshot local é commitado no repo como segurança — pipeline diário (cron 9h BRT)
 * atualiza o Blob; deploy novo qualquer hora atualiza o snapshot do repo.
 */
import { painelBlobUrl } from "./painel-blob";

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

const REVALIDATE_SECS = 3600; // 1h

async function tryFetch(url: string): Promise<IpcaData | null> {
  try {
    const r = await fetch(url, { next: { revalidate: REVALIDATE_SECS } });
    if (!r.ok) return null;
    return (await r.json()) as IpcaData;
  } catch {
    return null;
  }
}

/** Carrega os dados do painel IPCA via Blob (com fallback no snapshot local). */
export async function loadIpcaData(): Promise<IpcaData | null> {
  const blobUrl = painelBlobUrl("data/ipca.json");

  // 1) tenta o Blob (fonte ativa, atualizada pelo cron)
  if (blobUrl) {
    const fromBlob = await tryFetch(blobUrl);
    if (fromBlob) return fromBlob;
  }

  // 2) fallback no snapshot local — URL absoluta (em server component fetch precisa absolute)
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
  if (baseUrl) {
    const fromLocal = await tryFetch(`${baseUrl}/data/ipca.json`);
    if (fromLocal) return fromLocal;
  }

  // 3) último recurso: ler o arquivo do filesystem (server-only)
  try {
    const fs = await import("fs/promises");
    const path = await import("path");
    const filePath = path.join(process.cwd(), "public", "data", "ipca.json");
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw) as IpcaData;
  } catch {
    return null;
  }
}
