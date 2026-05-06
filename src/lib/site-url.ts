/**
 * Resolve a URL canonica do site para SEO (sitemap, robots, metadata).
 *
 * Ordem de preferencia:
 *   1. NEXT_PUBLIC_SITE_URL (definir manualmente quando houver dominio proprio)
 *   2. VERCEL_PROJECT_PRODUCTION_URL (subdominio fixo de producao na Vercel)
 *   3. VERCEL_URL (deploy de preview / fallback)
 *   4. Fallback hardcoded (so usado em dev local sem env)
 */
export function getSiteUrl(): string {
  const fromPublic = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (fromPublic) return normalize(fromPublic);

  const fromVercelProd = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (fromVercelProd) return normalize(`https://${fromVercelProd}`);

  const fromVercel = process.env.VERCEL_URL?.trim();
  if (fromVercel) return normalize(`https://${fromVercel}`);

  return "http://localhost:3000";
}

function normalize(url: string): string {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.host}`;
  } catch {
    return url.replace(/\/$/, "");
  }
}
