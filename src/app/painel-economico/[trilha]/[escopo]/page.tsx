
import { notFound } from "next/navigation";

import { PainelScopeLanding } from "@/components/painel/PainelTaxonomyPage";
import { getScope, getTrail } from "@/lib/painel-taxonomy";

type Props = {
  params: Promise<{ trilha: string; escopo: string }>;
};

export default async function PainelScopePage({ params }: Props) {
  const { trilha, escopo } = await params;
  const trail = getTrail(trilha);
  const scope = getScope(trilha, escopo);
  if (!trail || !scope) notFound();

  return <PainelScopeLanding trail={trail} scopeSlug={scope.slug} />;
}
