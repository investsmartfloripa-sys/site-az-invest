import { NextResponse } from "next/server";

import { getAcoesTotalReturn, toTotalReturnKey } from "@/lib/painel-acoes";

/**
 * Série de RETORNO TOTAL (preço + dividendos reinvestidos) de um papel, para o
 * comparador do hero do Ibovespa: o usuário seleciona ações no screener e elas
 * entram no gráfico principal em base 100 vs Ibovespa. Usamos o adj_close
 * (retorno total) — a comparação com o Ibov (índice de retorno total) fica justa.
 *
 * Resposta: { ticker, series: [[date, adj_close], ...] } (vazia se sem dado).
 */
export const revalidate = 60;

export async function GET(_req: Request, ctx: { params: Promise<{ ticker: string }> }) {
  const { ticker } = await ctx.params;
  const bare = decodeURIComponent(ticker).trim().toUpperCase().replace(/\.SA$/i, "");
  const key = toTotalReturnKey(bare);

  const data = await getAcoesTotalReturn();
  const node = data?.tickers?.[key];
  if (!node || !node.series?.length) {
    return NextResponse.json({ ticker: bare, series: [] as Array<[string, number]> });
  }
  const series = node.series.map(([d, , adj]) => [d, adj] as [string, number]);
  return NextResponse.json({ ticker: bare, series });
}
