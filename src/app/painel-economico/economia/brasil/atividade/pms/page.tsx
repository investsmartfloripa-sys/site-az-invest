import type { Metadata } from "next";

import { PmsDashboard } from "@/components/painel/atividade/PmsDashboard";
import { loadAtividadePms } from "@/lib/painel-atividade";

export const metadata: Metadata = {
  title: "PMS — Atividade — AZ Invest",
  description:
    "Pesquisa Mensal de Serviços do IBGE. Volume agregado de serviços com ranking por segmento (alojamento, alimentação, transportes, profissionais, comunicação).",
};

export const revalidate = 86400;

export default async function PainelAtividadePmsPage() {
  const data = await loadAtividadePms();

  if (!data) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-800">
        Não foi possível carregar os dados da PMS agora. Tente recarregar em alguns minutos.
      </div>
    );
  }

  return <PmsDashboard data={data} />;
}
