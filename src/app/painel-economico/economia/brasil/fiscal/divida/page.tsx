import type { Metadata } from "next";

import { DividaDashboard } from "@/components/painel/fiscal/DividaDashboard";
import { loadFiscalClassicos } from "@/lib/painel-fiscal";

export const metadata: Metadata = {
  title: "Divida — Fiscal — AZ Invest",
  description:
    "Trajetoria da divida bruta do governo geral (DBGG) e divida liquida do setor publico (DLSP) brasileiras. Fonte: BCB SGS.",
};

export const dynamic = "force-dynamic";
export const revalidate = 300;

export default async function PainelDividaPage() {
  const data = await loadFiscalClassicos();
  if (!data) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
        Dados em preparacao. Tente recarregar em alguns minutos.
      </div>
    );
  }
  return <DividaDashboard data={data} />;
}
