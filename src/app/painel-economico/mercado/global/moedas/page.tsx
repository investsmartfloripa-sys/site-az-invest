import type { Metadata } from "next";

import { MoedasDashboard } from "@/components/painel/moedas/MoedasDashboard";
import { PipelinePendingCard } from "@/components/painel/PipelinePendingCard";
import {
  EMPTY_HISTORY_SLICE,
  FX_PAIRS,
  getFxTopMovers,
  getHistorySlice,
} from "@/lib/painel-mercado-global";

export const metadata: Metadata = {
  title: "Moedas — Ativos de mercado",
  description:
    "Moedas do mundo contra o dólar: ranking de majors e emergentes por janela, índice DXY, e o bloco do real (USD/BRL em 5 anos, cruzes EUR/BRL e GBP/BRL e o real entre os emergentes).",
};

export const revalidate = 3600;

/**
 * Séries de 5 anos: todo o universo vs USD (FX_PAIRS) + cruzes do real + DXY.
 * Tickers recém-adicionados ao catálogo só aparecem no JSON após o próximo
 * run do market-data — getHistorySlice pula ausentes e o dashboard degrada
 * com "histórico em construção".
 */
const HISTORY_TICKERS = [
  ...FX_PAIRS.map((p) => ({ ticker: p.ticker, label: p.pair })),
  { ticker: "EURBRL=X", label: "EUR/BRL" },
  { ticker: "GBPBRL=X", label: "GBP/BRL" },
  { ticker: "DX-Y.NYB", label: "DXY" },
];

export default async function MoedasPage() {
  const [movers, history] = await Promise.all([
    getFxTopMovers(),
    getHistorySlice(HISTORY_TICKERS).catch(() => EMPTY_HISTORY_SLICE),
  ]);

  const nothingLoaded = !movers && history.series.length === 0;

  return (
    <div className="space-y-6">
      <p className="text-xs font-semibold uppercase tracking-wide text-[#027DFC]">
        Ativos de mercado · Global · Moedas
      </p>

      {nothingLoaded ? (
        <PipelinePendingCard
          blobPaths={["data/fx_top_movers.json", "data/market_history_full.json"]}
          workflow="data-pipeline.yml / market-data.yml"
        />
      ) : (
        // Sem <Suspense>: AzPeriodSelector não usa mais useSearchParams (sem CSR
        // bailout) e um boundary aqui quebraria a hidratação no Next 16.2.4.
        <MoedasDashboard movers={movers} history={history} />
      )}
    </div>
  );
}
