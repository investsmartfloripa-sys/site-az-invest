import type { Metadata } from "next";

import { ReceitaGastosDashboard } from "@/components/painel/fiscal/ReceitaGastosDashboard";
import { PainelReceitaGastosV2 } from "@/components/painel/fiscal/v2/receita-gastos/PainelReceitaGastosV2";
import { loadAtividadeCodace } from "@/lib/painel-atividade";
import { loadFiscalClassicos } from "@/lib/painel-fiscal";

export const metadata: Metadata = {
  title: "Receita e gastos — Fiscal",
  description:
    "Tesoura receita × despesa do governo central, primário vs meta LDO e estabilizador da dívida, famílias de receita, rubricas de despesa, arcabouço fiscal e resultado nominal decomposto. Fonte: STN/RTN + BCB.",
};

export const revalidate = 300;

export default async function PainelReceitaGastosPage() {
  const [data, codace] = await Promise.all([loadFiscalClassicos(), loadAtividadeCodace()]);
  if (!data) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
        Dados em preparacao. Tente recarregar em alguns minutos.
      </div>
    );
  }
  // Gate v2: enquanto o pipeline não publica o schema 2 (com o estabilizador
  // pronto), serve o dashboard antigo — sem quebrar a página.
  if (!data.schema_version || data.schema_version < 2 || !data.sustentabilidade?.serie?.length) {
    return <ReceitaGastosDashboard data={data} />;
  }
  return <PainelReceitaGastosV2 data={data} codace={codace} />;
}
