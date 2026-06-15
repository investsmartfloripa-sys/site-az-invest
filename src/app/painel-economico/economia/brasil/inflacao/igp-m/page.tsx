import type { Metadata } from "next";

import { IgpmDashboard } from "@/components/painel/inflacao/IgpmDashboard";
import { IgpmDashboardV2 } from "@/components/painel/inflacao/IgpmDashboardV2";
import { loadIgpmData } from "@/lib/painel-igpm";

export const metadata: Metadata = {
  title: "Inflação — IGP-M — AZ Invest",
  description:
    "IGP-M esmiuçado: decomposição por componente com pesos efetivos, IGP-M × IPCA com defasagem, reajuste de aluguel na prática e série mensal completa. Atualizado via FGV/BCB-SGS.",
};

// ISR puro: o dado é mensal; force-dynamic anularia o revalidate (plano de economia, P2).
export const revalidate = 3600;

export default async function PainelIgpmPage() {
  const data = await loadIgpmData();

  if (!data) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-800">
        Não foi possível carregar os dados do IGP-M agora. Tente recarregar em alguns minutos.
      </div>
    );
  }

  // Fallback: enquanto o Blob ainda servir o JSON v1 (sem decomposição com
  // pesos efetivos), renderiza o dashboard antigo em vez de quebrar.
  if (!data.schema_version || data.schema_version < 2 || !data.decomposicao) {
    return <IgpmDashboard data={data} />;
  }

  // Sem <Suspense>: o AzPeriodSelector não usa mais useSearchParams (ver
  // useDeferredSearchParams), então a rota estática não faz CSR bailout e o
  // dashboard hidrata normalmente. Um boundary <Suspense> aqui, ao contrário,
  // QUEBRARIA a hidratação do conteúdo neste build (Next 16.2.4).
  return <IgpmDashboardV2 data={data} />;
}
