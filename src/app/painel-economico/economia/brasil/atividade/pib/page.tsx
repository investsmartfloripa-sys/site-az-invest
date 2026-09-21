import type { Metadata } from "next";

import { AtividadeTabs } from "@/components/painel/atividade/v2/AtividadeTabs";
import { PibCockpit } from "@/components/painel/atividade/v2/pib/cockpit/PibCockpit";
import { PipelinePendingCard } from "@/components/painel/PipelinePendingCard";
import { loadAtividadeCodace, loadAtividadeIbcBr, loadAtividadePib } from "@/lib/painel-atividade";

export const metadata: Metadata = {
  title: "PIB — Atividade",
  description:
    "Cockpit das Contas Nacionais Trimestrais do IBGE: ritmo (QoQ SA, YoY, acumulados, carrego vs Focus), prévia mensal pelo IBC-Br, contribuições por ótica, os 17 recortes da oferta e 6 da demanda em 9 lentes, tabelas mestras, poupança × investimento, conta financeira (B.9, IDP, instrumentos) e PIB per capita.",
};

export const revalidate = 86400;

export default async function PainelAtividadePibPage() {
  const [pib, ibcbr, codace] = await Promise.all([loadAtividadePib(), loadAtividadeIbcBr(), loadAtividadeCodace()]);

  // Gate honesto (padrão do cockpit fiscal): sem payload ou sem o schema v2
  // (contribuições), aviso âmbar — nunca página quebrada nem dashboard antigo.
  if (!pib || !pib.schema_version || pib.schema_version < 2 || !pib.contribuicoes?.serie?.length) {
    return (
      <div className="flex flex-col gap-4">
        <AtividadeTabs />
        <PipelinePendingCard blobPaths={["data/atividade_pib.json"]} workflow="atividade-pipeline.yml" />
      </div>
    );
  }

  return <PibCockpit pib={pib} ibcbr={ibcbr} codace={codace} />;
}
