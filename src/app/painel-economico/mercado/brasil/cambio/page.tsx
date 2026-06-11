import type { Metadata } from "next";
import { Suspense } from "react";

import { CambioDashboard } from "@/components/painel/cambio/CambioDashboard";
import { PipelinePendingCard } from "@/components/painel/PipelinePendingCard";
import {
  EMPTY_HISTORY_SLICE,
  getFxTopMovers,
  getHistorySlice,
} from "@/lib/painel-mercado-global";

export const metadata: Metadata = {
  title: "Câmbio — Ativos de mercado | AZ Invest",
  description:
    "Dólar (USD/BRL) com histórico de 5 anos, cruzes do real (EUR/BRL e GBP/BRL), índice DXY e o desempenho das principais moedas contra o dólar.",
};

export const revalidate = 3600;

/** Séries de 5 anos usadas nos cards (hero, cruzes e DXY). */
const HISTORY_TICKERS = [
  { ticker: "BRL=X", label: "USD/BRL" },
  { ticker: "EURBRL=X", label: "EUR/BRL" },
  { ticker: "GBPBRL=X", label: "GBP/BRL" },
  { ticker: "DX-Y.NYB", label: "DXY" },
];

export default async function CambioPage() {
  const [movers, history] = await Promise.all([
    getFxTopMovers(),
    getHistorySlice(HISTORY_TICKERS).catch(() => EMPTY_HISTORY_SLICE),
  ]);

  const nothingLoaded = !movers && history.series.length === 0;

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#027DFC]">
          Ativos de mercado · Brasil · Câmbio
        </p>
        <h2 className="text-2xl font-semibold text-[#132960]">Dólar, cruzes do real e moedas globais</h2>
        <p className="max-w-3xl text-sm text-zinc-600">
          O USD/BRL é o preço-síntese do risco Brasil; as cruzes (EUR/BRL, GBP/BRL) mostram se o
          movimento é fraqueza do real ou força do dólar — e o <strong>DXY</strong> arbitra essa
          dúvida medindo o dólar contra as moedas desenvolvidas. O painel de moedas contra o USD
          coloca o real no contexto dos pares emergentes.
        </p>
      </header>

      {nothingLoaded ? (
        <PipelinePendingCard
          blobPaths={["data/fx_top_movers.json", "data/market_history_full.json"]}
          workflow="data-pipeline.yml / market-data.yml"
        />
      ) : (
        <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-white/60" />}>
          <CambioDashboard movers={movers} history={history} />
        </Suspense>
      )}

      <section className="rounded-2xl border border-[#132960]/10 bg-zinc-50/50 p-4 text-xs text-zinc-600">
        <p className="font-semibold uppercase tracking-wide text-zinc-500">Notas metodológicas</p>
        <ul className="mt-2 list-disc space-y-1 pl-4">
          <li>
            <strong>Séries de 5 anos</strong>: fechamento diário do Yahoo Finance (<code>BRL=X</code>,{" "}
            <code>EURBRL=X</code>, <code>GBPBRL=X</code>, <code>DX-Y.NYB</code>), atualizado 1x/dia
            útil — não é a PTAX do BCB, que fecha em horário próprio.
          </li>
          <li>
            <strong>Moedas contra o dólar</strong>: variação do valor da moeda em USD em cada janela
            (positivo = a moeda se valorizou frente ao dólar). Fonte intradiária com giro a cada 15
            minutos.
          </li>
          <li>
            <strong>DXY</strong>: índice ICE do dólar contra EUR, JPY, GBP, CAD, SEK e CHF — não
            inclui moedas emergentes.
          </li>
        </ul>
      </section>
    </div>
  );
}
