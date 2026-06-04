"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { getCategory, getScope, getTrail, painelTrails } from "@/lib/painel-taxonomy";

type Props = {
  children: ReactNode;
};

type NavItem = { href: string; label: string };

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
      breadcrumbs.push({
        href: `/painel-economico/${trailSlug}/${scopeSlug}/${categorySlug}`,
        label: category.label,
      });
    }
  }

  return breadcrumbs;
}

/**
 * Shell do painel economico: topbar navy sticky com menus por trilha
 * (gerados da taxonomia) + breadcrumb fino. Conteudo em largura total.
 */
export function PainelSectionShell({ children }: Props) {
  const pathname = usePathname();
  const breadcrumbs = buildBreadcrumb(pathname);

  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const navRef = useRef<HTMLDivElement | null>(null);

  // Fecha dropdown em clique fora / Esc / troca de rota.
  useEffect(() => {
    setOpenMenu(null);
  }, [pathname]);

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (navRef.current && !navRef.current.contains(e.target as Node)) setOpenMenu(null);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpenMenu(null);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const panoramaActive = pathname === "/painel-economico" || pathname.startsWith("/painel-economico/panorama");

  return (
    <div className="min-h-screen bg-[#f5f7fb]">
      <div ref={navRef} className="sticky top-0 z-40 border-b border-white/10 bg-[#132960] shadow-md">
        <div className="mx-auto flex w-full max-w-[96rem] items-center gap-1 px-4 md:px-8">
          <Link
            href="/painel-economico/panorama"
            className="mr-2 hidden py-3 text-[11px] font-bold uppercase tracking-[0.18em] text-white/60 transition hover:text-white sm:block"
          >
            Painel econômico
          </Link>

          <Link
            href="/painel-economico/panorama"
            className={`border-b-2 px-3 py-3 text-sm font-semibold transition ${
              panoramaActive
                ? "border-[#4DA3FF] text-white"
                : "border-transparent text-[#9db8e8] hover:text-white"
            }`}
          >
            Panorama
          </Link>

          {painelTrails.map((trail) => {
            const trailActive = pathname.startsWith(`/painel-economico/${trail.slug}`);
            const isOpen = openMenu === trail.slug;
            return (
              <div key={trail.slug} className="relative">
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => setOpenMenu(isOpen ? null : trail.slug)}
                  className={`flex items-center gap-1.5 border-b-2 px-3 py-3 text-sm font-semibold transition ${
                    trailActive
                      ? "border-[#4DA3FF] text-white"
                      : "border-transparent text-[#9db8e8] hover:text-white"
                  }`}
                >
                  {trail.slug === "mercado" ? "Mercado" : "Economia"}
                  <svg
                    viewBox="0 0 10 6"
                    aria-hidden
                    className={`h-1.5 w-2.5 fill-current transition-transform ${isOpen ? "rotate-180" : ""}`}
                  >
                    <path d="M0 0h10L5 6z" />
                  </svg>
                </button>

                {isOpen ? (
                  <div className="absolute left-0 top-full z-50 mt-0 w-[560px] max-w-[88vw] rounded-b-xl border border-[#132960]/10 bg-white p-4 shadow-xl">
                    <div className="grid gap-4 sm:grid-cols-2">
                      {trail.scopes.map((scope) => (
                        <div key={scope.slug}>
                          <Link
                            href={`/painel-economico/${trail.slug}/${scope.slug}`}
                            className="mb-2 block text-xs font-bold uppercase tracking-wider text-[#027DFC] hover:underline"
                          >
                            {scope.label}
                          </Link>
                          <ul className="space-y-0.5">
                            {scope.categories.map((category) => {
                              const href = `/painel-economico/${trail.slug}/${scope.slug}/${category.slug}`;
                              const active = pathname.startsWith(href);
                              return (
                                <li key={href}>
                                  <Link
                                    href={href}
                                    className={`block rounded-md px-2 py-1.5 text-sm transition ${
                                      active
                                        ? "bg-[#ebf4ff] font-semibold text-[#027DFC]"
                                        : "text-[#132960] hover:bg-zinc-50 hover:text-[#027DFC]"
                                    }`}
                                  >
                                    {category.label}
                                  </Link>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      <div className="mx-auto w-full max-w-[96rem] px-4 py-6 md:px-8">
        {breadcrumbs.length > 1 ? (
          <nav aria-label="Caminho" className="mb-4 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
            {breadcrumbs.map((crumb, idx) => (
              <span key={crumb.href} className="flex items-center gap-2">
                {idx > 0 ? <span className="text-zinc-300">/</span> : null}
                {idx === breadcrumbs.length - 1 ? (
                  <span className="font-semibold text-[#132960]">{crumb.label}</span>
                ) : (
                  <Link href={crumb.href} className="text-zinc-500 hover:text-[#027DFC]">
                    {crumb.label}
                  </Link>
                )}
              </span>
            ))}
          </nav>
        ) : null}

        {children}
      </div>
    </div>
  );
}
