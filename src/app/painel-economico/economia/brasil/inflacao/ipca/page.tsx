import type { Metadata } from "next";

import { IpcaDashboard } from "@/components/painel/inflacao/IpcaDashboard";
import { loadIpcaData } from "@/lib/painel-ipca";

export const metadata: Metadata = {
  title: "Inflação — IPCA — AZ Invest",
  description:
    "Scrutínio dos dados do IPCA: contribuição por grupo, núcleos do BC, difusão, expectativas Focus e maiores influências do mês. Atualizado mensalmente via IBGE/SIDRA e BCB.",
};

export const dynamic = "force-dynamic";
export const revalidate = 3600;

export default async function PainelIpcaPage() {
  const data = await loadIpcaData();

  if (!data) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-800">
        Não foi possível carregar os dados do IPCA agora. Tente recarregar em alguns minutos.
      </div>
    );
  }

  return <IpcaDashboard data={data} />;
}
