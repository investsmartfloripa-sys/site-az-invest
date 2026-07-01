import type { Metadata } from "next";

import { PnadDashboard } from "@/components/painel/emprego/PnadDashboard";
import { PnadDashboardV2 } from "@/components/painel/emprego/v2/pnad/PnadDashboardV2";
import { loadAtividadeCodace } from "@/lib/painel-atividade";
import { loadPnadData } from "@/lib/painel-emprego";

export const metadata: Metadata = {
  title: "Emprego — PNAD",
  description:
    "Mercado de trabalho amplo (IBGE/PNAD Contínua): desocupação com leitura dessazonalizada, participação e nível de ocupação, subutilização e informalidade, qualidade do vínculo (com/sem carteira), setores que criam ocupação e massa real de rendimentos. Atualizado trimestralmente.",
};

export const revalidate = 21600; // 6h

export default async function PainelPnadPage() {
  const [data, codace] = await Promise.all([loadPnadData(), loadAtividadeCodace()]);

  if (!data) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-800">
        Não foi possível carregar os dados da PNAD agora. Tente recarregar em alguns minutos.
      </div>
    );
  }

  // Fallback: enquanto o Blob não tiver o schema v2 (massa de rendimento), serve o dashboard antigo.
  if (!data.schema_version || data.schema_version < 2 || !data.massa_rendimento?.serie?.length) {
    return <PnadDashboard data={data} />;
  }

  return <PnadDashboardV2 data={data} codace={codace} />;
}
