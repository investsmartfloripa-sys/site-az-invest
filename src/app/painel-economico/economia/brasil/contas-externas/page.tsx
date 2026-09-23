import type { Metadata } from "next";

import { ContasExternasDashboard } from "@/components/painel/contas-externas/ContasExternasDashboard";
import { ContasExternasDashboardV2 } from "@/components/painel/contas-externas/v2/ContasExternasDashboardV2";
import { ContasExternasCockpit } from "@/components/painel/contas-externas/cockpit/ContasExternasCockpit";
import { loadCambioMacro, loadContasExternas, loadContasExternasComex } from "@/lib/painel-contas-externas";
import { loadAtividadeCodace } from "@/lib/painel-atividade";

export const metadata: Metadata = {
  title: "Contas Externas",
  description:
    "Cockpit do balanço de pagamentos do Brasil (BPM6): transações correntes em 12 meses e % do PIB, tabela mestra linha a linha, conta financeira e ingressos de não residentes, reservas e posição de investimento internacional, fluxo cambial diário, Focus, câmbio real, paridade do poder de compra e pauta de comércio. Dados BCB, SECEX, FUNCEX e Banco Mundial, atualização automática diária.",
};

export const revalidate = 3600;

export default async function PainelContasExternasPage() {
  const [data, comex, codace, cambio] = await Promise.all([
    loadContasExternas(),
    loadContasExternasComex(),
    loadAtividadeCodace(),
    loadCambioMacro(),
  ]);

  if (!data) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-800">
        Não foi possível carregar os dados de Contas Externas agora. Tente recarregar em alguns minutos.
      </div>
    );
  }

  // Gate v3: o cockpit exige a tabela mestra do builder v3. Sem ela (Blob antigo),
  // cai no dashboard v2 e, sem o v2, no v1 — nunca derruba a página.
  const v3Pronto = !!data.schema_version && data.schema_version >= 3 && !!data.bp_mestre?.acum_12m?.length;
  if (v3Pronto) {
    return <ContasExternasCockpit data={data} comex={comex} cambio={cambio} codace={codace} />;
  }

  const v2Pronto =
    !!data.schema_version && data.schema_version >= 2 && !!data.bloco_a.decomposicao_12m?.length;

  return v2Pronto ? (
    <ContasExternasDashboardV2 data={data} comex={comex} codace={codace} />
  ) : (
    <ContasExternasDashboard data={data} comex={comex} />
  );
}
