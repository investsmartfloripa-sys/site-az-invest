"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/**
 * Beacon first-party de pageviews — montado no layout raiz.
 *
 * Dispara um POST para /api/analytics/collect a cada navegação, INCLUSIVE
 * navegação SPA: o efeito depende de `usePathname()` (next/navigation), não
 * apenas do mount. Regras:
 *
 * - Ignora a área logada (/area-restrita, /admin) — não polui as métricas.
 * - Dedupe: nunca dispara duas vezes para o MESMO pathname consecutivo
 *   (cobre StrictMode em dev e re-renders com a mesma rota).
 * - `document.referrer` só é enviado no PRIMEIRO hit da sessão de navegação:
 *   em navegação SPA ele continua apontando para o referrer externo original
 *   e inflaria a contagem de origens.
 */
export function AnalyticsBeacon() {
  const pathname = usePathname();
  const lastPathRef = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname) return;
    // Dedupe de pathname consecutivo (StrictMode dispara o efeito 2x em dev).
    if (lastPathRef.current === pathname) return;

    const isFirstHit = lastPathRef.current === null;
    lastPathRef.current = pathname;

    if (pathname.startsWith("/area-restrita") || pathname.startsWith("/admin")) {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const payload = {
      type: "page_view",
      path: pathname,
      referrer: isFirstHit ? document.referrer || undefined : undefined,
      utm_source: params.get("utm_source") || undefined,
      utm_medium: params.get("utm_medium") || undefined,
      utm_campaign: params.get("utm_campaign") || undefined,
    };

    fetch("/api/analytics/collect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {});
  }, [pathname]);

  return null;
}
