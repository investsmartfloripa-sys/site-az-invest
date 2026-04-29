import { notFound } from "next/navigation";

import { PainelCategoryPlaceholder } from "@/components/painel/PainelTaxonomyPage";
import { getCategory, getScope, getTrail } from "@/lib/painel-taxonomy";

type Props = {
  params: Promise<{ trilha: string; escopo: string; categoria: string }>;
};

export default async function PainelCategoryPage({ params }: Props) {
  const { trilha, escopo, categoria } = await params;
  const trail = getTrail(trilha);
  const scope = getScope(trilha, escopo);
  const category = getCategory(trilha, escopo, categoria);

  if (!trail || !scope || !category) notFound();

  return <PainelCategoryPlaceholder trail={trail} scopeSlug={scope.slug} category={category} />;
}
