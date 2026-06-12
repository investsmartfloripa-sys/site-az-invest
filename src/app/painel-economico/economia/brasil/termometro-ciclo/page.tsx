import type { Metadata } from "next";

import { VisaoGeralDashboard } from "@/components/painel/visao-geral/VisaoGeralDashboard";
import { loadVisaoGeralPayload } from "@/lib/painel-visao-geral";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Termômetro de Ciclo — Brasil | AZ Invest",
  description:
    "Termômetro do ciclo econômico brasileiro: 5 modelos de probabilidade de recessão (MS-AR, probit, gap HP, diffusion, Bry-Boschan), indicadores antecedentes FGV, hard data físico (ANFAVEA, EPE, ANP, PIM-PF IBGE) e cronologia oficial CODACE.",
};


export default async function TermometroCicloPage() {
  const payload = await loadVisaoGeralPayload();
  return <VisaoGeralDashboard payload={payload} />;
}
