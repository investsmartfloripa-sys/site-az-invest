import Link from "next/link";

import { categoriasVisiveis, escoposVisiveis, type CategoryDef, type EscopoSlug, type TrailDef } from "@/lib/painel-taxonomy";

type SectionPageProps = {
  trail: TrailDef;
};

type ScopePageProps = {
  trail: TrailDef;
  scopeSlug: EscopoSlug;
};

const frequencyLabel: Record<CategoryDef["frequency"], string> = {
  "tempo-real": "Tempo real",
  diario: "Diária",
  semanal: "Semanal",
  mensal: "Mensal",
};

/** Cartão de uma aba: o cartão inteiro é o link. */
function CategoriaCard({ href, category }: { href: string; category: CategoryDef }) {
  return (
    <Link
      href={href}
      className="group flex flex-col rounded-2xl border border-[#132960]/15 bg-white p-4 transition hover:border-[#027DFC] hover:shadow-sm"
    >
      <span className="flex items-center justify-between gap-3 text-base font-semibold text-[#132960] group-hover:text-[#027DFC]">
        {category.label}
        <span aria-hidden className="text-[#027DFC]">→</span>
      </span>
      <span className="mt-1 text-sm text-zinc-600">{category.description}</span>
      <span className="mt-3 flex flex-wrap gap-2 text-xs">
        <span className="rounded-full bg-[#ebf4ff] px-2 py-1 text-[#027DFC]">
          Frequência: {frequencyLabel[category.frequency]}
        </span>
        <span className="rounded-full bg-zinc-100 px-2 py-1 text-zinc-600">Fonte: {category.sourceHint}</span>
      </span>
    </Link>
  );
}

export function PainelTrailLanding({ trail }: SectionPageProps) {
  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-[#132960]">{trail.label}</h1>
        <p className="max-w-3xl text-sm text-zinc-600">{trail.description}</p>
      </header>
      {escoposVisiveis(trail).map((scope) => (
        <div key={scope.slug} className="space-y-3">
          <p className="text-xs font-bold uppercase tracking-wider text-[#027DFC]">{scope.label}</p>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {categoriasVisiveis(scope).map((category) => (
              <CategoriaCard
                key={category.slug}
                href={`/painel-economico/${trail.slug}/${scope.slug}/${category.slug}`}
                category={category}
              />
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}

export function PainelScopeLanding({ trail, scopeSlug }: ScopePageProps) {
  const scope = trail.scopes.find((item) => item.slug === scopeSlug);
  if (!scope) return null;

  return (
    <section className="space-y-4">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-[#132960]">
          {trail.label} · {scope.label}
        </h1>
        <p className="max-w-3xl text-sm text-zinc-600">Escolha uma aba para abrir os indicadores.</p>
      </header>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {categoriasVisiveis(scope).map((category) => (
          <CategoriaCard
            key={category.slug}
            href={`/painel-economico/${trail.slug}/${scope.slug}/${category.slug}`}
            category={category}
          />
        ))}
      </div>
    </section>
  );
}
