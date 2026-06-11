import type { Metadata } from "next";

import { CambioMacroDashboard } from "@/components/painel/contas-externas/cambio/CambioMacroDashboard";
import { loadCambioMacro } from "@/lib/painel-contas-externas";

export const metadata: Metadata = {
  title: "Câmbio Econômico — Contas Externas — AZ Invest",
  description:
    "Câmbio real (REER do BCB e bilateral USD/BRL deflacionado), paridade de juros Selic−Fed Funds e o scorecard da UIP na prática. Dados BCB/SGS e FRED, atualização automática diária.",
};

export const dynamic = "force-dynamic";
export const revalidate = 3600;

export default async function PainelCambioEconomicoPage() {
  const data = await loadCambioMacro();

  if (!data) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-800">
        Não foi possível carregar os dados de Câmbio Econômico agora. Tente recarregar em alguns minutos.
      </div>
    );
  }

  return <CambioMacroDashboard data={data} />;
}
