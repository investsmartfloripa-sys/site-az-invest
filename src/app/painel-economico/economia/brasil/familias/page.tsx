import type { Metadata } from "next";

import { FamiliasDashboard } from "@/components/painel/familias/FamiliasDashboard";
import { FamiliasDashboardV2 } from "@/components/painel/familias/v2/FamiliasDashboardV2";
import { loadFamilias } from "@/lib/painel-familias";
import { loadPnadData } from "@/lib/painel-emprego";
import { loadAtividadeCodace } from "@/lib/painel-atividade";

export const metadata: Metadata = {
  title: "Famílias — AZ Invest",
  description:
    "Renda real do trabalho, massa de salários, endividamento e juros, poder de compra e estrutura social das famílias brasileiras — leitura narrativa com dados BCB SGS, IBGE PNAD Contínua e Ipeadata, atualizados automaticamente todos os dias.",
};

export const dynamic = "force-dynamic";
export const revalidate = 3600;

export default async function PainelFamiliasPage() {
  const [data, massaPnad, codace] = await Promise.all([loadFamilias(), loadPnadData(), loadAtividadeCodace()]);

  if (!data.renda && !data.endividamento) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-800">
        Não foi possível carregar os dados do painel Famílias agora. Tente recarregar em alguns minutos.
      </div>
    );
  }

  // Gate v2: o template narrativo exige o schema v2 do builder (bloco_juros,
  // séries deflacionadas etc.). JSON antigo no Blob → dashboard v1 intacto.
  if (!data.endividamento?.schema_version || data.endividamento.schema_version < 2) {
    return <FamiliasDashboard data={data} />;
  }

  return <FamiliasDashboardV2 data={data} massaPnad={massaPnad} codace={codace} />;
}
