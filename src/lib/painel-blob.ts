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
  // Fallback hardcoded como ultima linha de defesa quando env vars vazias
  const HARDCODED = "https://8ytqvgmik75vk1it.public.blob.vercel-storage.com";
  return (fallback || primary || HARDCODED).replace(/\/$/, "");
}

export function painelBlobUrl(path: string): string {
  const base = painelBlobBase();
  if (!base) return "";
  const p = path.replace(/^\//, "");
  return `${base}/${p}`;
}

/**
 * Prefixo das cache tags do Data Cache atreladas a um objeto do Blob.
 * A tag é o PRÓPRIO caminho do Blob (`blob:data/ipca.json`), então o pipeline
 * que escreve o arquivo sabe exatamente qual tag purgar — sem tabela paralela.
 */
export const BLOB_TAG_PREFIX = "blob:";

/** Cache tag do Data Cache p/ um caminho do Blob. Ver POST /api/revalidate. */
export function blobCacheTag(path: string): string {
  return `${BLOB_TAG_PREFIX}${path.replace(/^\//, "")}`;
}

/**
 * Leitura padrão de um JSON/SVG do Blob pelo servidor: mantém o TTL que o
 * loader já usava e anexa a cache tag que o POST /api/revalidate purga.
 *
 * NÃO ENCURTE O TTL AQUI. Tentativa descartada em 11/08/2026: limitar o fetch
 * a 60s para "desempilhar" os dois caches (Data Cache do fetch + ISR da
 * página). No App Router o `revalidate` EFETIVO de uma rota é o MENOR valor
 * entre o `export const revalidate` da página e o de qualquer fetch dentro
 * dela — o teto rebaixou as 28 rotas do painel para ISR de 1 minuto de uma vez
 * (confirmado na tabela do `next build`), incluindo páginas de dado mensal com
 * ISR de 24h como PIB e PIM. O TTL do fetch não é um botão independente.
 *
 * O que garante o dado fresco na divulgação é a PURGA POR TAG, não o TTL: o
 * pipeline chama /api/revalidate assim que escreve no Blob. O TTL de cada
 * loader é só a rede de segurança para o caso de a purga falhar — e esse caso
 * fica vermelho no GitHub Actions, não silencioso como no incidente do IPCA.
 *
 * Devolve `null` quando não há base de Blob configurada (mesma semântica que
 * os loaders já tinham ao checar `if (!url) return null`).
 */
export async function fetchPainelBlob(
  path: string,
  revalidateSeconds: number,
  init?: RequestInit,
): Promise<Response | null> {
  const url = painelBlobUrl(path);
  if (!url) return null;
  return fetch(url, {
    ...init,
    next: { revalidate: revalidateSeconds, tags: [blobCacheTag(path)] },
  });
}
