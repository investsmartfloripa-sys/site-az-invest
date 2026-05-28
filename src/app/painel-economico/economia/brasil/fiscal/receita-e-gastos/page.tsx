import type { Metadata } from "next";

import { ReceitaGastosDashboard } from "@/components/painel/fiscal/ReceitaGastosDashboard";
import { loadFiscalClassicos } from "@/lib/painel-fiscal";

export const metadata: Metadata = {
  title: "Receita e gastos — Fiscal — AZ Invest",
  description:
    "Receita liquida do Tesouro, despesa primaria, juros nominais e resultado primario do governo central brasileiro. Fonte: STN/RTN + BCB.",
};

export const dynamic = "force-dynamic";
export const revalidate = 300;

export default async function PainelReceitaGastosPage() {
  const data = await loadFiscalClassicos();
  if (!data) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
        Dados em preparacao. Tente recarregar em alguns minutos.
      </div>
    );
  }
  return <ReceitaGastosDashboard data={data} />;
}
