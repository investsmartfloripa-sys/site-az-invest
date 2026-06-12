import type { Metadata } from "next";

import { PimDashboard } from "@/components/painel/atividade/PimDashboard";
import { PimDashboardV2 } from "@/components/painel/atividade/v2/pim/PimDashboardV2";
import { loadAtividadeCodace, loadAtividadePib, loadAtividadePim } from "@/lib/painel-atividade";

export const metadata: Metadata = {
  title: "PIM-PF — Atividade — AZ Invest",
  description:
    "Pesquisa Industrial Mensal — Produção Física do IBGE: nível da produção contra o pico histórico, ciclo por categoria de uso, extrativa × transformação, insumos da construção como sinal antecedente do PIB, difusão por atividades e recessões CODACE sombreadas.",
};

export const dynamic = "force-dynamic";
export const revalidate = 86400;

export default async function PainelAtividadePimPage() {
  const [data, pib, codace] = await Promise.all([loadAtividadePim(), loadAtividadePib(), loadAtividadeCodace()]);

  if (!data) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-800">
        Não foi possível carregar os dados da PIM-PF agora. Tente recarregar em alguns minutos.
      </div>
    );
  }

  // Fallback: enquanto o Blob não tiver o schema v2 (difusão + picos), serve o dashboard antigo.
  if (!data.schema_version || data.schema_version < 2 || !data.difusao?.serie?.length) {
    return <PimDashboard data={data} />;
  }

  return <PimDashboardV2 pim={data} pib={pib} codace={codace} />;
}
