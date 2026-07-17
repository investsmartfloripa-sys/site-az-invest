import type { Metadata } from "next";

import { IpcaDashboardV3 } from "@/components/painel/inflacao/IpcaDashboardV3";
import { loadIpcaData } from "@/lib/painel-ipca";

export const metadata: Metadata = {
  title: "Inflação — IPCA",
  description:
    "IPCA em seis vistas de escrutínio: leitura da divulgação (realizado × Focus), tabela-síntese, composição hierárquica, núcleos e momentum dessazonalizado, tendência desde 1999 contra a meta e expectativas completas. IBGE/SIDRA e BCB.",
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

  // Sem <Suspense>: AzPeriodSelector não usa mais useSearchParams (sem CSR
  // bailout) e um boundary aqui quebraria a hidratação no Next 16.2.4.
  return <IpcaDashboardV3 data={data} />;
}
