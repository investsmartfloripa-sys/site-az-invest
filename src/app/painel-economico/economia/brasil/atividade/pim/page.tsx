import type { Metadata } from "next";

import { PimDashboard } from "@/components/painel/atividade/PimDashboard";
import { loadAtividadePim } from "@/lib/painel-atividade";

export const metadata: Metadata = {
  title: "PIM-PF — Atividade — AZ Invest",
  description:
    "Pesquisa Industrial Mensal — Produção Física do IBGE. Indústria geral, extrativa, transformação e decomposição por categoria econômica (bens de capital, intermediários, consumo).",
};

export const revalidate = 86400;

export default async function PainelAtividadePimPage() {
  const data = await loadAtividadePim();

  if (!data) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-800">
        Não foi possível carregar os dados da PIM-PF agora. Tente recarregar em alguns minutos.
      </div>
    );
  }

  return <PimDashboard data={data} />;
}
