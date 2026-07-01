import type { Metadata } from "next";

import { CagedDashboard } from "@/components/painel/emprego/CagedDashboard";
import { CagedDashboardV2 } from "@/components/painel/emprego/v2/caged/CagedDashboardV2";
import { loadAtividadeCodace } from "@/lib/painel-atividade";
import { loadCagedFull } from "@/lib/painel-emprego";

export const metadata: Metadata = {
  title: "Emprego — CAGED",
  description:
    "Leitura narrativa do Novo CAGED (MTE): saldo dessazonalizado e momentum do mercado formal, acumulado do ano, fluxos de admissões e desligamentos, salário real de admissão e abertura por setor e faixa salarial. Atualizado mensalmente.",
};

export const revalidate = 21600; // 6h

export default async function PainelCagedPage() {
  const [{ total, quebras, ipca }, codace] = await Promise.all([loadCagedFull(), loadAtividadeCodace()]);

  if (!total) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-800">
        Não foi possível carregar os dados do CAGED agora. Tente recarregar em alguns minutos.
      </div>
    );
  }

  // Gate v2: exige schema_version ≥ 2 E o campo saldo_sa (STL própria) na
  // observação mais recente — senão cai no dashboard antigo (que ainda usa o
  // IPCA client-side como deflator; no v2 o salário real vem do builder).
  const ultimo = total.serie[total.serie.length - 1];
  if (!total.schema_version || total.schema_version < 2 || ultimo?.saldo_sa === undefined) {
    return <CagedDashboard total={total} quebras={quebras} ipca={ipca} />;
  }

  return <CagedDashboardV2 total={total} quebras={quebras} codace={codace} />;
}
