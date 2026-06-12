
import { notFound } from "next/navigation";

import { PainelTrailLanding } from "@/components/painel/PainelTaxonomyPage";
import { getTrail } from "@/lib/painel-taxonomy";

export default function EconomiaLandingPage() {
  const trail = getTrail("economia");
  if (!trail) notFound();
  return <PainelTrailLanding trail={trail} />;
}
