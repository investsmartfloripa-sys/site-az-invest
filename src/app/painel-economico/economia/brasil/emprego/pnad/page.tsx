import type { Metadata } from "next";

import { PnadDashboard } from "@/components/painel/emprego/PnadDashboard";
import { loadPnadData } from "@/lib/painel-emprego";

export const metadata: Metadata = {
  title: "Emprego — PNAD — AZ Invest",
  description:
    "Escrutínio dos dados de mercado de trabalho do IBGE/PNAD Contínua: taxa de desocupação, participação, informalidade, composição da ocupação e setor de atividade. Atualizado trimestralmente.",
};

export const dynamic = "force-dynamic";
export const revalidate = 21600; // 6h

export default async function PainelPnadPage() {
  const data = await loadPnadData();

  if (!data) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-800">
        Não foi possível carregar os dados da PNAD agora. Tente recarregar em alguns minutos.
      </div>
    );
  }

  return <PnadDashboard data={data} />;
}
