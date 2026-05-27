import Link from "next/link";

import { FundamentalsTable } from "@/components/painel/market/FundamentalsTable";
import { SectorHeatmap } from "@/components/painel/market/SectorHeatmap";
import { getMarketFundamentals } from "@/lib/painel-market-data";

export const metadata = {
  title: "Fundamentos e múltiplos — Ativos de mercado | AZ Invest",
  description:
    "Screener de fundamentos e mediana setorial: P/L, P/VP, EV/EBITDA, ROE, dividend yield. Compare ações BR e EUA.",
};

export const dynamic = "force-dynamic";

export default async function FundamentosPage() {
  const data = await getMarketFundamentals();

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#027DFC]">
          Ativos de mercado · Ferramentas
        </p>
        <h2 className="text-2xl font-semibold text-[#132960]">Fundamentos e múltiplos</h2>
        <p className="max-w-3xl text-sm text-zinc-600">
          Screener com múltiplos atuais (trailing) de ações brasileiras e americanas, ETFs e principais
          instrumentos. Use o heatmap setorial para identificar setores baratos ou caros vs mediana, e a
          tabela para filtrar candidatos —{" "}
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
