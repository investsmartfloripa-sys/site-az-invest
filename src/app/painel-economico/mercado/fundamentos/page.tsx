import Link from "next/link";

import { FundamentalsTable } from "@/components/painel/market/FundamentalsTable";
import { SectorHeatmap } from "@/components/painel/market/SectorHeatmap";
import { getMarketFundamentals } from "@/lib/painel-market-data";

export const metadata = {
  title: "Fundamentos e múltiplos — Mercado",
  description:
    "Screener de fundamentos e mediana setorial: P/L, P/VP, EV/EBITDA, ROE, dividend yield. Compare ações BR e EUA.",
};

// ISR: dados vêm do Blob com loaders guardados (degradam para null); ver plano AVALIACAO-GERAL §6.
export const revalidate = 3600;

export default async function FundamentosPage() {
  const data = await getMarketFundamentals();

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#027DFC]">
          Mercado · Ferramentas
        </p>
        <h1 className="text-2xl font-semibold text-[#132960]">Fundamentos e múltiplos</h1>
        <p className="max-w-3xl text-sm text-zinc-600">
          Múltiplos atuais (últimos 12 meses) de ações brasileiras e americanas e de ETFs. Use o mapa
          setorial para ver setores baratos ou caros pela mediana, e o screener para filtrar
          candidatos —{" "}
          <Link href="/painel-economico/mercado/historico" className="underline hover:text-[#027DFC]">
            voltar ao histórico comparativo
          </Link>
          .
        </p>
      </header>

      <SectorHeatmap data={data} />
      <FundamentalsTable data={data} />
    </div>
  );
}
