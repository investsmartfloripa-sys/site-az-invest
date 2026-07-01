import type { Metadata } from "next";

import { PibDashboard } from "@/components/painel/atividade/PibDashboard";
import { PibDashboardV2 } from "@/components/painel/atividade/v2/pib/PibDashboardV2";
import { loadAtividadeCodace, loadAtividadeIbcBr, loadAtividadePib } from "@/lib/painel-atividade";

export const metadata: Metadata = {
  title: "PIB — Atividade",
  description:
    "Produto Interno Bruto trimestral (IBGE Contas Nacionais): contribuições ao crescimento por ótica da oferta e da demanda, carrego estatístico, IBC-Br como prévia mensal, expectativas Focus e PIB per capita.",
};

export const revalidate = 86400;

export default async function PainelAtividadePibPage() {
  const [pib, ibcbr, codace] = await Promise.all([loadAtividadePib(), loadAtividadeIbcBr(), loadAtividadeCodace()]);

  if (!pib) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-800">
        Não foi possível carregar os dados do PIB agora. Tente recarregar em alguns minutos.
      </div>
    );
  }

  // Fallback: enquanto o Blob não tiver o schema v2 (contribuições), serve o dashboard antigo.
  if (!pib.schema_version || pib.schema_version < 2 || !pib.contribuicoes?.serie?.length) {
    return <PibDashboard pib={pib} ibcbr={ibcbr} />;
  }

  return <PibDashboardV2 pib={pib} ibcbr={ibcbr} codace={codace} />;
}
