
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PainelTrailLanding } from "@/components/painel/PainelTaxonomyPage";
import { getTrail } from "@/lib/painel-taxonomy";

export const metadata: Metadata = {
  title: "Economia — Painel econômico",
  description: "Atividade, inflação, emprego, fiscal, contas externas e famílias: os indicadores da economia brasileira.",
  alternates: { canonical: "/painel-economico/economia" },
};

export default function EconomiaLandingPage() {
  const trail = getTrail("economia");
  if (!trail) notFound();
  return <PainelTrailLanding trail={trail} />;
}
