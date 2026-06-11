// Rate limit best-effort em memória (janela deslizante por chave).
//
// ATENÇÃO: em ambiente serverless (Vercel), cada instância tem a sua própria
// memória — o limite vale por instância e zera em cold start. Serve como
// proteção básica contra abuso/brute force, não como garantia absoluta.
// Sem dependências novas de propósito; se um dia precisar de limite global,
// trocar por um store compartilhado (ex.: Upstash/Redis).

const buckets = new Map<string, number[]>();

// Proteção simples contra crescimento sem limite da Map em instâncias longevas.
const MAX_KEYS = 5000;

/**
 * Registra uma tentativa para `key` e informa se ela está dentro do limite.
 *
 * @returns true se a requisição é permitida; false se excedeu `limit`
 *          dentro da janela `windowMs` (janela deslizante).
 */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const windowStart = now - windowMs;

  let bucket = buckets.get(key);
  if (!bucket) {
    if (buckets.size >= MAX_KEYS) buckets.clear();
    bucket = [];
    buckets.set(key, bucket);
  }

  // Descarta timestamps fora da janela.
  while (bucket.length > 0 && bucket[0] <= windowStart) bucket.shift();

  if (bucket.length >= limit) return false;
  bucket.push(now);
  return true;
}

// Aceita tanto Request#headers quanto o ReadonlyHeaders de next/headers.
type HeaderReader = { get(name: string): string | null };

export function getClientIp(headers: HeaderReader): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return headers.get("x-real-ip") || "unknown";
}
