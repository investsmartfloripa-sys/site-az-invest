"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Pill bar de navegação entre abas irmãs de uma seção do painel — generalização
 * do FiscalTabs (fiscal/v2/FiscalTabs.tsx) para ser configurada por seção:
 * `base` é a rota-mãe e cada aba tem um `slug` (vazio = a própria base, ex.:
 * "Visão geral"). Ativa via usePathname: slug vazio exige match exato da base;
 * os demais ativam por prefixo. 1º elemento de todo painel cockpit (§10).
 */
export type SectionTab = { slug: string; label: string };

export function SectionTabs({
  base,
  abas,
  ariaLabel,
}: {
  base: string;
  abas: readonly SectionTab[];
  ariaLabel: string;
}) {
  const pathname = (usePathname() ?? "").replace(/\/$/, "");
  const baseLimpa = base.replace(/\/$/, "");
  return (
    <nav
      aria-label={ariaLabel}
      className="flex w-fit max-w-full flex-wrap items-center gap-1 rounded-xl border border-[#132960]/10 bg-white p-1 shadow-sm"
    >
      {abas.map((a) => {
        const href = a.slug ? `${baseLimpa}/${a.slug}` : baseLimpa;
        const ativa = a.slug ? pathname === href || pathname.startsWith(`${href}/`) : pathname === baseLimpa;
        return (
          <Link
            key={a.slug || "__base"}
            href={href}
            aria-current={ativa ? "page" : undefined}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              ativa ? "bg-[#132960] text-white shadow-sm" : "text-zinc-600 hover:bg-zinc-100 hover:text-[#132960]"
            }`}
          >
            {a.label}
          </Link>
        );
      })}
    </nav>
  );
}
