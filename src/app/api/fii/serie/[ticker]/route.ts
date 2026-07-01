import { NextResponse } from "next/server";

import { getFiiTotalReturn, toFiiTotalReturnKey } from "@/lib/painel-fii";

/**
 * Série de RETORNO TOTAL (preço + proventos reinvestidos) de um FII, para o
 * comparador do hero do IFIX e o simulador de carteira — mesmo contrato da
 * rota /api/acoes/serie/[ticker].
 *
 * Resposta: { ticker, series: [[date, adj_close], ...] } (vazia se sem dado).
 */
export const revalidate = 60;

export async function GET(_req: Request, ctx: { params: Promise<{ ticker: string }> }) {
  const { ticker } = await ctx.params;
  const bare = decodeURIComponent(ticker).trim().toUpperCase().replace(/\.SA$/i, "");
  const key = toFiiTotalReturnKey(bare);

  const data = await getFiiTotalReturn();
  const node = data?.tickers?.[key];
  if (!node || !node.series?.length) {
    return NextResponse.json({ ticker: bare, series: [] as Array<[string, number]> });
  }
  const series = node.series.map(([d, , adj]) => [d, adj] as [string, number]);
  return NextResponse.json({ ticker: bare, series });
}
