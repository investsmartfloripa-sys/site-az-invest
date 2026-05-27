import type { Metadata } from "next";

import { VisaoGeralDashboard } from "@/components/painel/visao-geral/VisaoGeralDashboard";
import { loadVisaoGeralPayload } from "@/lib/painel-visao-geral";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Visão Geral — Termômetro do Ciclo Brasileiro | AZ Invest",
  description:
    "Síntese prospectiva da atividade econômica brasileira: 5 modelos de probabilidade de recessão (MS-DFM, probit, gap HP, diffusion, Bry-Boschan), indicadores antecedentes (OECD CLI, ICF), hard data físico (ANFAVEA, ANP, EPE) e cronologia oficial CODACE.",
};

export default async function VisaoGeralPage() {
  const payload = await loadVisaoGeralPayload();
  return <VisaoGeralDashboard payload={payload} />;
}
