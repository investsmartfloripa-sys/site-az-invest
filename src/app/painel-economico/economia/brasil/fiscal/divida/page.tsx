import type { Metadata } from "next";

import { DividaDashboard } from "@/components/painel/fiscal/DividaDashboard";
import { PainelDividaV2 } from "@/components/painel/fiscal/v2/divida/PainelDividaV2";
import { loadFiscalClassicos, loadFiscalDbggFatores, loadFiscalDpfRmd } from "@/lib/painel-fiscal";
import { loadAtividadeCodace } from "@/lib/painel-atividade";

export const metadata: Metadata = {
  title: "Divida — Fiscal",
  description:
    "Trajetoria da divida bruta (DBGG) e liquida (DLSP), dinamica r-g, decomposicao anual e composicao da DPMFi por indexador. Fonte: BCB SGS + pipeline fiscal AZ.",
};

export const revalidate = 300;

export default async function PainelDividaPage() {
  // Blobs da Onda 3 (fatores DBGG + RMD) podem ainda não existir → null → cards não renderizam.
  const [data, codace, fatoresDbgg, dpfRmd] = await Promise.all([
    loadFiscalClassicos(),
    loadAtividadeCodace(),
    loadFiscalDbggFatores(),
    loadFiscalDpfRmd(),
  ]);
  if (!data) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
        Dados em preparacao. Tente recarregar em alguns minutos.
      </div>
    );
  }
  // Gate v2: o template narrativo exige o schema novo (sustentabilidade +
  // decomposicao do pipeline). JSON antigo no Blob → dashboard anterior.
  if (!data.schema_version || data.schema_version < 2 || !data.decomposicao_dlsp?.anos?.length) {
    return <DividaDashboard data={data} />;
  }
  return <PainelDividaV2 data={data} codace={codace} fatoresDbgg={fatoresDbgg} dpfRmd={dpfRmd} />;
}
