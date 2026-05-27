import type { Metadata } from "next";

import { FamiliasDashboard } from "@/components/painel/familias/FamiliasDashboard";
import { loadFamilias } from "@/lib/painel-familias";

export const metadata: Metadata = {
  title: "Famílias — AZ Invest",
  description:
    "Renda, endividamento e saúde financeira das famílias brasileiras. Dados BCB SGS, IBGE PNAD e Ipeadata, com atualização automática diária.",
};

export const dynamic = "force-dynamic";
export const revalidate = 3600;

export default async function PainelFamiliasPage() {
  const data = await loadFamilias();

  if (!data.renda && !data.endividamento) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-800">
        Não foi possível carregar os dados do painel Famílias agora. Tente recarregar em alguns minutos.
      </div>
    );
  }

  return <FamiliasDashboard data={data} />;
}
