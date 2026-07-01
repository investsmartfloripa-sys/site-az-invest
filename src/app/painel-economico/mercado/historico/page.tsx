import Link from "next/link";

import { HistoricoChart } from "@/components/painel/market/HistoricoChart";
import { getMarketCatalog, getMarketHistoryFull } from "@/lib/painel-market-data";

export const metadata = {
  title: "Histórico comparativo — Ativos de mercado",
  description:
    "Compare a evolução de ações, ETFs, índices, FX, commodities e cripto em janelas de 1 mês a 5 anos com rebase 100.",
};

// ISR: dados vêm do Blob com loaders guardados (degradam para null); ver plano AVALIACAO-GERAL §6.
export const revalidate = 3600;

export default async function HistoricoPage() {
  const [catalog, full] = await Promise.all([getMarketCatalog(), getMarketHistoryFull()]);

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#027DFC]">
          Ativos de mercado · Ferramentas
        </p>
        <h2 className="text-2xl font-semibold text-[#132960]">Histórico comparativo</h2>
        <p className="max-w-3xl text-sm text-zinc-600">
          Compare a performance de até 8 ativos lado a lado em janelas temporais de 1 mês a 5 anos.
          Use o rebase 100 para comparar séries de escalas muito diferentes (ex.: Ibovespa vs dólar
          vs ouro). Presets editoriais cobrem combinações comuns —{" "}
          <Link href="/painel-economico/mercado/fundamentos" className="underline hover:text-[#027DFC]">
            ver tela de Fundamentos
          </Link>
          .
        </p>
      </header>

      {/* Sem <Suspense>: HistoricoChart usa useAzPeriodQueryState, que agora lê a
          URL via useDeferredSearchParams (sem useSearchParams/CSR bailout). Um
          boundary aqui quebraria a hidratação do gráfico neste build (Next 16.2.4). */}
      <HistoricoChart full={full} catalog={catalog?.assets ?? []} />
    </div>
  );
}
