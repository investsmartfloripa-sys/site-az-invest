import { NextResponse } from "next/server";

import { getPolicyRates } from "@/lib/policy-rates-server";

/**
 * Taxas básicas de juros de 16 países (BIS WS_CBPOL; Zona do Euro pela taxa de
 * depósito do BCE), comprimidas em pontos de mudança desde 2000. Alimenta o
 * gráfico "Taxas básicas de juros pelo mundo" da página Juros Globais. Cada
 * fetch fica 6 h no Data Cache; a CDN segura a resposta 1 h.
 */
export async function GET() {
  const payload = await getPolicyRates();
  const status = payload.series.length === 0 ? 503 : 200;
  return NextResponse.json(payload, {
    status,
    headers:
      status === 200
        ? { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" }
        : { "Cache-Control": "no-store" },
  });
}
