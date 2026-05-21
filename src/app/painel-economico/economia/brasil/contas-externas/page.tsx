import type { Metadata } from "next";

import { ContasExternasDashboard } from "@/components/painel/contas-externas/ContasExternasDashboard";
import { loadContasExternas } from "@/lib/painel-contas-externas";

export const metadata: Metadata = {
  title: "Contas Externas — AZ Invest",
  description:
    "Balanço de pagamentos, investimento direto e reservas internacionais do Brasil. Dados BCB (BPM6) com atualização automática diária.",
};

export const revalidate = 3600;

export default async function PainelContasExternasPage() {
  const data = await loadContasExternas();

  if (!data) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-800">
        Não foi possível carregar os dados de Contas Externas agora. Tente recarregar em alguns minutos.
      </div>
    );
  }

  return <ContasExternasDashboard data={data} />;
}
