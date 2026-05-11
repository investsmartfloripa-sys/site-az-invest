/**
 * Base public URL do Vercel Blob (sem barra final). Ex.: https://xxx.public.blob.vercel-storage.com
 *
 * Producao (Vercel):
 * - `NEXT_PUBLIC_BLOB_BASE_URL` e injetada no **build**; sem ela no ambiente Production ao correr
 *   `vercel build`, o painel no deploy pode ficar vazio embora funcione em localhost com `.env`.
 *   Depois de configurar, fazer **Redeploy**.
 * - `PAINEL_BLOB_PUBLIC_FALLBACK` e lida em **runtime** no servidor (SSR); use a mesma URL do
 *   store se precisar do painel sem rebuild, ou em conjunto com NEXT_PUBLIC.
 */
export function painelBlobBase(): string {
  const primary = process.env.NEXT_PUBLIC_BLOB_BASE_URL?.trim() ?? "";
  const fallback = process.env.PAINEL_BLOB_PUBLIC_FALLBACK?.trim() ?? "";
  return (fallback || primary).replace(/\/$/, "");
}

export function painelBlobUrl(path: string): string {
  const base = painelBlobBase();
  if (!base) return "";
  const p = path.replace(/^\//, "");
  return `${base}/${p}`;
}
