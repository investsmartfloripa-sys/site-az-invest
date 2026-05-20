import type { Metadata } from "next";

import { TermometroFiscalDashboard } from "@/components/painel/fiscal/TermometroFiscalDashboard";
import { loadFiscalTermometro } from "@/lib/painel-fiscal";

export const metadata: Metadata = {
  title: "Termômetro Fiscal — Brasil — AZ Invest",
  description:
    "Os 18 indicadores do Big Debt Cycle (Ray Dalio, 'How Countries Go Broke') adaptados ao Brasil. Cada indicador tem faixas verde / amarelo / vermelho / break baseadas em casos históricos. Atualizado diariamente.",
};

export const revalidate = 3600;

export default async function PainelTermometroFiscalPage() {
  const data = await loadFiscalTermometro();

  if (!data) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-[#132960]">Termômetro Fiscal</h1>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
          <p className="font-semibold">Dados em preparação</p>
          <p className="mt-2">
            O Termômetro Fiscal está sendo gerado pelo pipeline diário. Tente recarregar em alguns minutos.
          </p>
        </div>
      </div>
    );
  }

  return <TermometroFiscalDashboard data={data} />;
}
