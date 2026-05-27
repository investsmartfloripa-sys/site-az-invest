import type { Metadata } from "next";

import { ContasExternasDashboard } from "@/components/painel/contas-externas/ContasExternasDashboard";
import { loadContasExternas, loadContasExternasComex } from "@/lib/painel-contas-externas";

export const metadata: Metadata = {
  title: "Contas Externas — AZ Invest",
  description:
    "Balanço de pagamentos, investimento direto, reservas internacionais e comércio exterior por produto e destino. Dados BCB (BPM6) e SECEX/MDIC (Comex Stat), atualização automática diária.",
};

export const dynamic = "force-dynamic";
export const revalidate = 3600;

export default async function PainelContasExternasPage() {
  const [data, comex] = await Promise.all([loadContasExternas(), loadContasExternasComex()]);

  if (!data) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-800">
        Não foi possível carregar os dados de Contas Externas agora. Tente recarregar em alguns minutos.
      </div>
    );
  }

  return <ContasExternasDashboard data={data} comex={comex} />;
}
