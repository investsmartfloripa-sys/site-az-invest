import type { Metadata } from "next";

import { PibDashboard } from "@/components/painel/atividade/PibDashboard";
import { loadAtividadeIbcBr, loadAtividadePib } from "@/lib/painel-atividade";

export const metadata: Metadata = {
  title: "PIB — Atividade — AZ Invest",
  description:
    "Produto Interno Bruto trimestral (IBGE Contas Nacionais) com decomposição por ótica da oferta e da demanda, expectativas Focus, e IBC-Br (BCB) como proxy mensal.",
};

export const dynamic = "force-dynamic";
export const revalidate = 86400;

export default async function PainelAtividadePibPage() {
  const [pib, ibcbr] = await Promise.all([loadAtividadePib(), loadAtividadeIbcBr()]);

  if (!pib) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-800">
        Não foi possível carregar os dados do PIB agora. Tente recarregar em alguns minutos.
      </div>
    );
  }

  return <PibDashboard pib={pib} ibcbr={ibcbr} />;
}
