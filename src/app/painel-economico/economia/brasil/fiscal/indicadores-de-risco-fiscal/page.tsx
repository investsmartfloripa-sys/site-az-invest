import type { Metadata } from "next";

import { PainelRiscoFiscalV2 } from "@/components/painel/fiscal/v2/risco/PainelRiscoFiscalV2";
import { loadFiscalTermometro } from "@/lib/painel-fiscal";

export const metadata: Metadata = {
  title: "Indicadores de Risco Fiscal",
  description:
    "Os 4 indicadores prioritarios de How Countries Go Broke (Ray Dalio, 2025) aplicados ao Brasil como series historicas com zonas de risco: divida vs renda, servico da divida, juro vs inflacao e crescimento, e divida vs poupanca — mais 20 indicadores semaforizados no tempo, EMBI e projecao da DBGG com Focus.",
};

export const revalidate = 300;

export default async function PainelIndicadoresRiscoFiscalPage() {
  const data = await loadFiscalTermometro();
  if (!data) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
        Indicadores em preparação. Tente recarregar em alguns minutos.
      </div>
    );
  }
  // Gate v3: a página nova exige o payload com as séries históricas (dalio4).
  // Blob antigo no ar → aviso curto em vez de página quebrada; o cron diário resolve.
  if (!data.dalio4) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
        Os Indicadores de Risco Fiscal estão sendo atualizados para o novo formato (séries históricas com zonas de
        risco). O pipeline publica em instantes — recarregue em alguns minutos.
      </div>
    );
  }
  return <PainelRiscoFiscalV2 data={data} />;
}
