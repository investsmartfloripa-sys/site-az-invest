/** Base public URL do Vercel Blob (sem barra final). Ex.: https://xxx.public.blob.vercel-storage.com */

export function painelBlobBase(): string {
  return (process.env.NEXT_PUBLIC_BLOB_BASE_URL ?? "").replace(/\/$/, "");
}

export function painelBlobUrl(path: string): string {
  const base = painelBlobBase();
  if (!base) return "";
  const p = path.replace(/^\//, "");
  return `${base}/${p}`;
}
