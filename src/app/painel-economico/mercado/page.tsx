import { notFound } from "next/navigation";

import { PainelTrailLanding } from "@/components/painel/PainelTaxonomyPage";
import { getTrail } from "@/lib/painel-taxonomy";

export default function MercadoLandingPage() {
  const trail = getTrail("mercado");
  if (!trail) notFound();
  return <PainelTrailLanding trail={trail} />;
}
