"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { navItems } from "@/data/home";
import { SITE_MAIN_MAX_WIDTH_CLASS } from "@/lib/site-layout";

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function NavLinks() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Fecha o painel mobile ao navegar para outra rota.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <nav aria-label="Navegação principal" className="border-t border-white/10 bg-[#0e1f49]/85">
      <div className={`mx-auto w-full ${SITE_MAIN_MAX_WIDTH_CLASS} px-4 md:px-8`}>
        {/* Mobile: barra com hambúrguer */}
        <div className="flex items-center justify-between py-2 md:hidden">
          <span className="text-xs font-semibold uppercase tracking-wider text-white/60">
            Menu
          </span>
          <button
            type="button"
            aria-expanded={open}
            aria-controls="menu-principal"
            onClick={() => setOpen((value) => !value)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-white/85 transition-colors hover:text-white"
          >
            <span className="sr-only">{open ? "Fechar menu" : "Abrir menu"}</span>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              className="h-5 w-5"
              aria-hidden="true"
            >
              {open ? (
                <>
                  <path d="M6 6l12 12" />
                  <path d="M18 6L6 18" />
                </>
              ) : (
                <>
                  <path d="M4 7h16" />
                  <path d="M4 12h16" />
                  <path d="M4 17h16" />
                </>
              )}
            </svg>
          </button>
        </div>

        {/* Mobile: painel colapsável */}
        <div id="menu-principal" className={`${open ? "block" : "hidden"} pb-3 md:hidden`}>
          <ul className="flex flex-col gap-1 text-sm font-semibold uppercase tracking-wider">
            {navItems.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`block rounded-md px-3 py-2.5 transition-colors ${
                      active
                        ? "bg-white/10 text-white shadow-[inset_2px_0_0_#027DFC]"
                        : "text-white/80 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Desktop: links inline com sublinhado azure no item ativo */}
        <div className="hidden items-center gap-6 py-3 text-xs font-semibold uppercase tracking-wider md:flex">
          {navItems.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`relative whitespace-nowrap pb-1 transition-colors after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:rounded-full after:bg-[#027DFC] after:transition-opacity ${
                  active
                    ? "text-white after:opacity-100"
                    : "text-white/80 after:opacity-0 hover:text-[#027DFC]"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
