import type { Metadata } from "next";

import { PmcDashboard } from "@/components/painel/atividade/PmcDashboard";
import { loadAtividadePmc } from "@/lib/painel-atividade";

export const metadata: Metadata = {
  title: "PMC — Atividade — AZ Invest",
  description:
    "Pesquisa Mensal do Comércio. Volume de vendas no varejo restrito (9 atividades) e ampliado (inclui veículos e materiais de construção), comparação lado a lado.",
};

export const revalidate = 86400;

export default async function PainelAtividadePmcPage() {
  const data = await loadAtividadePmc();

  if (!data) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-800">
        Não foi possível carregar os dados da PMC agora. Tente recarregar em alguns minutos.
      </div>
    );
  }

  return <PmcDashboard data={data} />;
}
