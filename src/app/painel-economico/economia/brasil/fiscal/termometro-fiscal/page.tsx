import type { Metadata } from "next";

import { TermometroFiscalDashboard } from "@/components/painel/fiscal/TermometroFiscalDashboard";
import { loadFiscalTermometro } from "@/lib/painel-fiscal";

export const metadata: Metadata = {
  title: "Termometro Fiscal — AZ Invest",
  description:
    "Aplicacao das formulas de How Countries Go Broke (Ray Dalio, 2025) ao Brasil. Projecao de Debt/Income em 10 anos, matrizes de sensibilidade e os 4 levers para estabilizar a divida.",
};

export const revalidate = 3600;

export default async function PainelTermometroFiscalPage() {
  const data = await loadFiscalTermometro();
  if (!data) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
        Termometro em preparacao. Tente recarregar em alguns minutos.
      </div>
    );
  }
  return <TermometroFiscalDashboard data={data} />;
}
