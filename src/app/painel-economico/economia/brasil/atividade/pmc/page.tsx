import type { Metadata } from "next";

import { PmcDashboard } from "@/components/painel/atividade/PmcDashboard";
import { PmcDashboardV2 } from "@/components/painel/atividade/v2/pmc/PmcDashboardV2";
import { loadAtividadeCodace, loadAtividadePmc } from "@/lib/painel-atividade";

export const metadata: Metadata = {
  title: "PMC — Atividade — AZ Invest",
  description:
    "Pesquisa Mensal de Comércio: o varejo restrito e ampliado contra o nível pré-pandemia, a inflação embutida nas vendas (deflator implícito), o momentum na margem e a abertura por atividade.",
};

export const dynamic = "force-dynamic";
export const revalidate = 86400;

export default async function PainelAtividadePmcPage() {
  const [data, codace] = await Promise.all([loadAtividadePmc(), loadAtividadeCodace()]);

  if (!data) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-800">
        Não foi possível carregar os dados da PMC agora. Tente recarregar em alguns minutos.
      </div>
    );
  }

  // Gate v2: blob ainda no schema antigo (sem deflator/atividades v2) → dashboard atual.
  if (!data.schema_version || data.schema_version < 2) {
    return <PmcDashboard data={data} />;
  }

  return <PmcDashboardV2 pmc={data} codace={codace} />;
}
