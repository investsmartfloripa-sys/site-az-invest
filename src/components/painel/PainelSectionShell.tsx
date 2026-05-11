"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";

import { getCategory, getScope, getTrail, painelTrails } from "@/lib/painel-taxonomy";

type Props = {
  children: ReactNode;
};

type NavItem = { href: string; label: string };

const primaryNav: NavItem[] = [
  { href: "/painel-economico/panorama", label: "Panorama" },
  { href: "/painel-economico/mercado", label: "Ativos de mercado" },
  { href: "/painel-economico/economia", label: "Indicadores macroeconômicos" },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/painel-economico/panorama") {
    return pathname === "/painel-economico" || pathname === "/painel-economico/panorama";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function buildBreadcrumb(pathname: string): NavItem[] {
  const cleanPath = pathname === "/painel-economico" ? "/painel-economico/panorama" : pathname;
  const segments = cleanPath.split("/").filter(Boolean).slice(1);

  const breadcrumbs: NavItem[] = [{ href: "/painel-economico/panorama", label: "Panorama" }];
  if (segments.length === 0 || segments[0] === "panorama") return breadcrumbs;

  const [trailSlug, scopeSlug, categorySlug] = segments;
  const trail = getTrail(trailSlug);
  if (trail) breadcrumbs.push({ href: `/painel-economico/${trailSlug}`, label: trail.label });

  if (trail && scopeSlug) {
    const scope = getScope(trailSlug, scopeSlug);
    if (scope) breadcrumbs.push({ href: `/painel-economico/${trailSlug}/${scopeSlug}`, label: scope.label });
  }

  if (trail && scopeSlug && categorySlug) {
    const category = getCategory(trailSlug, scopeSlug, categorySlug);
    if (category) {
      breadcrumbs.push({ href: `/painel-economico/${trailSlug}/${scopeSlug}/${categorySlug}`, label: category.label });
    }
  }

  return breadcrumbs;
}

export function PainelSectionShell({ children }: Props) {
  const pathname = usePathname();
  const breadcrumbs = buildBreadcrumb(pathname);
  const segments = useMemo(() => {
    const cleanPath = pathname === "/painel-economico" ? "/painel-economico/panorama" : pathname;
    return cleanPath.split("/").filter(Boolean).slice(1);
  }, [pathname]);

  const activeTrail = segments[0] ?? null;
  const activeScope = segments[1] ?? null;
  const activeCategory = segments[2] ?? null;

  const [openTrails, setOpenTrails] = useState<Record<string, boolean>>({});
  const [openScopes, setOpenScopes] = useState<Record<string, boolean>>({});

  function toggleTrail(slug: string) {
    setOpenTrails((prev) => ({ ...prev, [slug]: !prev[slug] }));
  }

  function toggleScope(trailSlug: string, scopeSlug: string) {
    const key = `${trailSlug}/${scopeSlug}`;
    setOpenScopes((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  return (
    <div className="mx-auto flex w-full max-w-[90rem] flex-col gap-8 px-4 py-8 md:px-8">
      <section className="rounded-2xl border border-[#132960]/15 bg-gradient-to-r from-white to-[#f2f7ff] p-5 md:p-6">
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#027DFC]">Painel econômico</p>
          <h1 className="text-3xl font-semibold text-[#132960] md:text-4xl">Panorama e dados para decisão</h1>
          <p className="max-w-3xl text-sm text-zinc-600">
            Explore em duas trilhas paralelas: <strong>Ativos de mercado</strong> e{" "}
            <strong>indicadores macroeconômicos</strong>, com recorte Brasil e global.
          </p>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <article className="rounded-2xl border border-[#132960]/15 bg-white p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">Explorador</p>
            <div className="space-y-2">
              {primaryNav
                .filter((item) => item.href === "/painel-economico/panorama")
                .map((item) => {
                  const active = isActive(pathname, item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`block rounded-xl px-3 py-2 text-sm font-semibold transition ${
                        active ? "bg-[#027DFC] text-white" : "bg-zinc-50 text-[#132960] hover:bg-[#eaf2ff]"
                      }`}
                    >
                      {item.label}
                    </Link>
                  );
                })}

              {painelTrails.map((trail) => (
                <div key={trail.slug} className="rounded-xl border border-[#132960]/10 bg-zinc-50/70 p-2">
                  <button
                    type="button"
                    onClick={() => toggleTrail(trail.slug)}
                    className={`flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-sm font-semibold ${
                      activeTrail === trail.slug ? "text-[#027DFC]" : "text-[#132960]"
                    }`}
                  >
                    <span>{trail.label}</span>
                    <span className="text-xs">{openTrails[trail.slug] ? "-" : "+"}</span>
                  </button>

                  <div
                    className={`${
                      (openTrails[trail.slug] ?? activeTrail === trail.slug) ? "mt-2 block" : "hidden"
                    }`}
                  >
                    <Link
                      href={`/painel-economico/${trail.slug}`}
                      className={`mb-2 block rounded-lg px-2 py-1.5 text-xs font-medium ${
                        isActive(pathname, `/painel-economico/${trail.slug}`)
                          ? "bg-[#ebf4ff] text-[#027DFC]"
                          : "text-zinc-600 hover:bg-white"
                      }`}
                    >
                      Visao geral
                    </Link>

                    <div className="space-y-2">
                      {trail.scopes.map((scope) => {
                        const scopeKey = `${trail.slug}/${scope.slug}`;
                        const scopeActive = activeTrail === trail.slug && activeScope === scope.slug;
                        return (
                          <div key={scopeKey} className="rounded-lg border border-[#132960]/10 bg-white/80 p-1.5">
                            <button
                              type="button"
                              onClick={() => toggleScope(trail.slug, scope.slug)}
                              className={`flex w-full items-center justify-between rounded-md px-2 py-1 text-xs font-semibold ${
                                scopeActive ? "text-[#027DFC]" : "text-[#132960]"
                              }`}
                            >
                              <span>{scope.label}</span>
                              <span>{openScopes[scopeKey] ? "-" : "+"}</span>
                            </button>

                            <div
                              className={`${
                                openScopes[scopeKey] ?? (activeTrail === trail.slug && activeScope === scope.slug)
                                  ? "mt-1 block"
                                  : "hidden"
                              } space-y-1`}
                            >
                              <Link
                                href={`/painel-economico/${trail.slug}/${scope.slug}`}
                                className={`block rounded-md px-2 py-1 text-xs ${
                                  isActive(pathname, `/painel-economico/${trail.slug}/${scope.slug}`)
                                    ? "bg-[#ebf4ff] text-[#027DFC]"
                                    : "text-zinc-600 hover:bg-zinc-100"
                                }`}
                              >
                                Resumo {scope.label}
                              </Link>
                              {scope.categories.map((category) => {
                                const href = `/painel-economico/${trail.slug}/${scope.slug}/${category.slug}`;
                                const active =
                                  activeTrail === trail.slug && activeScope === scope.slug && activeCategory === category.slug;
                                return (
                                  <Link
                                    key={href}
                                    href={href}
                                    className={`block rounded-md px-2 py-1 text-xs ${
                                      active ? "bg-[#ebf4ff] text-[#027DFC]" : "text-zinc-600 hover:bg-zinc-100"
                                    }`}
                                  >
                                    {category.label}
                                  </Link>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </article>
        </aside>

        <div className="min-w-0 space-y-4">
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[#132960]/10 bg-white px-3 py-2 text-xs text-zinc-600">
            <span className="font-medium text-zinc-500">Caminho:</span>
            {breadcrumbs.map((crumb, idx) => (
              <div key={crumb.href} className="flex items-center gap-2">
                {idx > 0 ? <span className="text-zinc-400">/</span> : null}
                <Link href={crumb.href} className="hover:text-[#027DFC]">
                  {crumb.label}
                </Link>
              </div>
            ))}
          </div>

          {children}
        </div>
      </section>
    </div>
  );
}
