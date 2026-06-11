import type { Metadata } from "next";
import { Suspense } from "react";

import { IpcaDashboardV2 } from "@/components/painel/inflacao/IpcaDashboardV2";
import { loadIpcaData } from "@/lib/painel-ipca";

export const metadata: Metadata = {
  title: "Inflação — IPCA — AZ Invest",
  description:
    "IPCA esmiuçado: contribuição por grupo encadeada no 12m oficial, núcleos do BC, difusão com régua histórica, sazonalidade, expectativas Focus e tabela completa de influências. Atualizado via IBGE/SIDRA e BCB.",
};

// ISR puro: o dado é mensal; force-dynamic anularia o revalidate (plano de economia, P2).
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

  return (
    // Suspense exigido pelo useSearchParams (AzPeriodSelector) em rota prerenderizada
    <Suspense fallback={<div className="h-[60vh] animate-pulse rounded-2xl bg-zinc-100" />}>
      <IpcaDashboardV2 data={data} />
    </Suspense>
  );
}
