import type { Metadata } from "next";

import { CagedDashboard } from "@/components/painel/emprego/CagedDashboard";
import { loadCagedFull } from "@/lib/painel-emprego";

export const metadata: Metadata = {
  title: "Emprego — CAGED — AZ Invest",
  description:
    "Escrutínio dos dados do Novo CAGED (MTE): saldo mensal de admissões e demissões, quebra por faixa salarial e setor IBGE, salário médio de admissão e demissão. Atualizado mensalmente.",
};

export const revalidate = 21600; // 6h

export default async function PainelCagedPage() {
  const { total, quebras } = await loadCagedFull();

  if (!total) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-800">
        Não foi possível carregar os dados do CAGED agora. Tente recarregar em alguns minutos.
      </div>
    );
  }

  return <CagedDashboard total={total} quebras={quebras} />;
}
