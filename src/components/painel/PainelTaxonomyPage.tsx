import Link from "next/link";

import type { CategoryDef, EscopoSlug, TrailDef } from "@/lib/painel-taxonomy";

type SectionPageProps = {
  trail: TrailDef;
};

type ScopePageProps = {
  trail: TrailDef;
  scopeSlug: EscopoSlug;
};

type CategoryPageProps = {
  trail: TrailDef;
  scopeSlug: EscopoSlug;
  category: CategoryDef;
};

const frequencyLabel: Record<CategoryDef["frequency"], string> = {
  "tempo-real": "Tempo real",
  diario: "Diario",
  semanal: "Semanal",
  mensal: "Mensal",
};

export function PainelTrailLanding({ trail }: SectionPageProps) {
  return (
    <section className="space-y-4">
      <header className="space-y-2">
        <h2 className="text-2xl font-semibold text-[#027DFC]">{trail.label}</h2>
        <p className="max-w-3xl text-sm text-zinc-600">{trail.description}</p>
      </header>
      <div className="grid gap-4 md:grid-cols-2">
        {trail.scopes.map((scope) => (
          <article key={scope.slug} className="rounded-2xl border border-[#132960]/15 bg-white p-5">
            <h3 className="text-lg font-semibold text-[#132960]">{scope.label}</h3>
            <p className="mt-1 text-sm text-zinc-600">{scope.categories.length} categorias principais</p>
            <ul className="mt-3 space-y-1 text-sm text-zinc-700">
              {scope.categories.map((category) => (
                <li key={category.slug}>- {category.label}</li>
              ))}
            </ul>
            <Link
              href={`/painel-economico/${trail.slug}/${scope.slug}`}
              className="mt-4 inline-flex rounded-full bg-[#132960] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#0f214e]"
            >
              Abrir {scope.label}
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}

export function PainelScopeLanding({ trail, scopeSlug }: ScopePageProps) {
  const scope = trail.scopes.find((item) => item.slug === scopeSlug);
  if (!scope) return null;

  return (
    <section className="space-y-4">
      <header className="space-y-2">
        <h2 className="text-2xl font-semibold text-[#027DFC]">
          {trail.label} | {scope.label}
        </h2>
        <p className="max-w-3xl text-sm text-zinc-600">
          Selecione uma categoria para aprofundar com o padrao KPI, grafico, tabela e contexto.
        </p>
      </header>
      <div className="grid gap-4 md:grid-cols-2">
        {scope.categories.map((category) => (
          <article key={category.slug} className="rounded-2xl border border-[#132960]/15 bg-white p-4">
            <h3 className="text-base font-semibold text-[#132960]">{category.label}</h3>
            <p className="mt-1 text-sm text-zinc-600">{category.description}</p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-[#ebf4ff] px-2 py-1 text-[#027DFC]">
                Frequencia: {frequencyLabel[category.frequency]}
              </span>
              <span className="rounded-full bg-zinc-100 px-2 py-1 text-zinc-600">Fonte: {category.sourceHint}</span>
            </div>
            <Link
              href={`/painel-economico/${trail.slug}/${scope.slug}/${category.slug}`}
              className="mt-4 inline-flex rounded-full border border-[#132960]/20 px-3 py-1.5 text-xs font-semibold text-[#132960] hover:border-[#027DFC] hover:text-[#027DFC]"
            >
              Ver categoria
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}

export function PainelCategoryPlaceholder({ trail, scopeSlug, category }: CategoryPageProps) {
  const scope = trail.scopes.find((item) => item.slug === scopeSlug);

  return (
    <section className="space-y-4">
      <header className="rounded-2xl border border-[#132960]/15 bg-white p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#027DFC]">
          {trail.label} | {scope?.label ?? "Escopo"}
        </p>
        <h2 className="mt-1 text-2xl font-semibold text-[#132960]">{category.label}</h2>
        <p className="mt-2 max-w-3xl text-sm text-zinc-600">{category.description}</p>
      </header>
      <div className="grid gap-4 lg:grid-cols-3">
        <article className="rounded-2xl border border-[#132960]/15 bg-white p-4">
          <h3 className="text-sm font-semibold text-[#132960]">Headline KPI</h3>
          <p className="mt-2 text-sm text-zinc-600">Espaco para o indicador principal da categoria.</p>
        </article>
        <article className="rounded-2xl border border-[#132960]/15 bg-white p-4 lg:col-span-2">
          <h3 className="text-sm font-semibold text-[#132960]">Grafico principal</h3>
          <p className="mt-2 text-sm text-zinc-600">Estrutura pronta para integrar dados via Blob.</p>
        </article>
        <article className="rounded-2xl border border-[#132960]/15 bg-white p-4 lg:col-span-2">
          <h3 className="text-sm font-semibold text-[#132960]">Tabela resumida</h3>
          <p className="mt-2 text-sm text-zinc-600">Layout base para serie, variacao e data de atualizacao.</p>
        </article>
        <article className="rounded-2xl border border-[#132960]/15 bg-white p-4">
          <h3 className="text-sm font-semibold text-[#132960]">Contexto curto</h3>
          <p className="mt-2 text-sm text-zinc-600">Bloco editorial para explicacao objetiva do sinal.</p>
        </article>
      </div>
    </section>
  );
}
