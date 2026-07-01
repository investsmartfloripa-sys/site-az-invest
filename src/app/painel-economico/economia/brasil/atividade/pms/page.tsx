import type { Metadata } from "next";

import { PmsDashboard } from "@/components/painel/atividade/PmsDashboard";
import { PmsDashboardV2 } from "@/components/painel/atividade/v2/pms/PmsDashboardV2";
import { loadAtividadeCodace, loadAtividadePms } from "@/lib/painel-atividade";

export const metadata: Metadata = {
  title: "PMS — Atividade",
  description:
    "Pesquisa Mensal de Serviços do IBGE: volume e receita do maior setor da economia, nível vs pré-pandemia (fev/2020 = 100), turismo, transporte de cargas × passageiros e abertura por 20 segmentos e 29 atividades.",
};

export const revalidate = 86400;

export default async function PainelAtividadePmsPage() {
  const [data, codace] = await Promise.all([loadAtividadePms(), loadAtividadeCodace()]);

  if (!data) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-800">
        Não foi possível carregar os dados da PMS agora. Tente recarregar em alguns minutos.
      </div>
    );
  }

  // Fallback: enquanto o Blob não tiver o schema v2, serve o dashboard antigo.
  if (!data.schema_version || data.schema_version < 2) {
    return <PmsDashboard data={data} />;
  }

  return <PmsDashboardV2 pms={data} codace={codace} />;
}
