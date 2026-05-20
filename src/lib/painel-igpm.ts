/**
 * Loader server-side dos dados do Painel IGP-M.
 *
 * Mesmo padrão do painel-ipca: Blob (ISR 1h) → snapshot local → filesystem.
 */
import { painelBlobUrl } from "./painel-blob";

export type SerieIgpm = Record<string, number | null | string> & { mes: string };

export type IgpmBlock = {
  serie: SerieIgpm[];
  pesos: Record<string, number>;
  mes_recente: string;
  componentes: string[];
};

export type IgpmData = {
  gerado_em: string;
  mes_recente: string;
  igpm: IgpmBlock;
};

const REVALIDATE_SECS = 3600;

async function tryFetch(url: string): Promise<IgpmData | null> {
  try {
    const r = await fetch(url, { next: { revalidate: REVALIDATE_SECS } });
    if (!r.ok) return null;
    return (await r.json()) as IgpmData;
  } catch {
    return null;
  }
}

export async function loadIgpmData(): Promise<IgpmData | null> {
  const blobUrl = painelBlobUrl("data/igpm.json");

  if (blobUrl) {
    const fromBlob = await tryFetch(blobUrl);
    if (fromBlob) return fromBlob;
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
  if (baseUrl) {
    const fromLocal = await tryFetch(`${baseUrl}/data/igpm.json`);
    if (fromLocal) return fromLocal;
  }

  try {
    const fs = await import("fs/promises");
    const path = await import("path");
    const filePath = path.join(process.cwd(), "public", "data", "igpm.json");
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw) as IgpmData;
  } catch {
    return null;
  }
}
