import { notFound, redirect } from "next/navigation";

import { getCategory } from "@/lib/painel-taxonomy";

type Props = {
  params: Promise<{ trilha: string; escopo: string; categoria: string }>;
};

/**
 * Toda aba pronta tem página própria; esta rota só atende as abas marcadas como em construção
 * (fora do menu), mandando quem chega por link antigo para a página mais próxima.
 */
export default async function PainelCategoryPage({ params }: Props) {
  const { trilha, escopo, categoria } = await params;
  const category = getCategory(trilha, escopo, categoria);
  if (!category) notFound();
  if (category.emConstrucao) {
    redirect(category.slug === "politica-monetaria" ? "/painel-economico/panorama" : `/painel-economico/${trilha}`);
  }
  notFound();
}
