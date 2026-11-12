import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { PainelScopeLanding } from "@/components/painel/PainelTaxonomyPage";
import { escoposVisiveis, getScope, getTrail } from "@/lib/painel-taxonomy";

type Props = {
  params: Promise<{ trilha: string; escopo: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { trilha, escopo } = await params;
  const trail = getTrail(trilha);
  const scope = getScope(trilha, escopo);
  if (!trail || !scope) return {};
  return { title: `${trail.label} · ${scope.label} — Painel econômico` };
}

export default async function PainelScopePage({ params }: Props) {
  const { trilha, escopo } = await params;
  const trail = getTrail(trilha);
  const scope = getScope(trilha, escopo);
  if (!trail || !scope) notFound();
  // escopo sem nenhuma aba pronta (Economia global, por ora): volta ao índice da trilha
  if (!escoposVisiveis(trail).some((s) => s.slug === scope.slug)) redirect(`/painel-economico/${trail.slug}`);

  return <PainelScopeLanding trail={trail} scopeSlug={scope.slug} />;
}
