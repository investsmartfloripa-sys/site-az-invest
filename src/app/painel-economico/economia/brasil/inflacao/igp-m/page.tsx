import type { Metadata } from "next";

import { IgpmDashboard } from "@/components/painel/inflacao/IgpmDashboard";
import { loadIgpmData } from "@/lib/painel-igpm";

export const metadata: Metadata = {
  title: "Inflação — IGP-M — AZ Invest",
  description:
    "Painel IGP-M: contribuição dos componentes IPA-M, IPC-M e INCC-M, variação mensal e acumulado em 12 meses. Atualizado mensalmente via BCB SGS.",
};

export const revalidate = 3600;

export default async function PainelIgpmPage() {
  const data = await loadIgpmData();

  if (!data) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-800">
        Não foi possível carregar os dados do IGP-M agora. Tente recarregar em alguns minutos.
      </div>
    );
  }

  return <IgpmDashboard data={data} />;
}
