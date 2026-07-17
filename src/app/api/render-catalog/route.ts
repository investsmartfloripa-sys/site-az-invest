import { NextResponse } from "next/server";

import {
  CHART_CATALOG,
  DATA_BLOB_PATH,
  PAINEL_PATH,
  RELEASE_BLOB_PATH,
} from "@/lib/publisher/chart-catalog";

/**
 * Catálogo de gráficos do Publisher, legível por máquina.
 *
 * Consumidores: o motor de imagens (render_charts.mjs no GitHub Actions) e o
 * robô de publicação (scheduled task) — única fonte da verdade sobre QUAIS
 * gráficos existem, id a id. Público e cacheável: não expõe nada sensível.
 */
export async function GET() {
  return NextResponse.json(
    {
      version: 1,
      charts: CHART_CATALOG.map((c) => ({
        ...c,
        renderPath: `/render/${c.id}`,
        painelPath: PAINEL_PATH[c.indicador],
      })),
      releases: RELEASE_BLOB_PATH,
      data: DATA_BLOB_PATH,
    },
    { headers: { "Cache-Control": "public, max-age=300, s-maxage=300" } },
  );
}
