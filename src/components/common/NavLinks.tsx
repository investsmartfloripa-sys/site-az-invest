"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { navItems } from "@/data/home";
import { SITE_MAIN_MAX_WIDTH_CLASS } from "@/lib/site-layout";

const MOBILE_MENU_ID = "menu-principal";

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Desktop (lg+): links inline na barra do header, sublinhado azure no item ativo. */
export function DesktopNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navegação principal"
      className="hidden items-center gap-6 text-xs font-semibold uppercase tracking-wider lg:flex"
    >
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
    </nav>
  );
}

/**
 * Mobile (< lg): hambúrguer ao lado do Login + painel que se sobrepõe ao
 * conteúdo (absoluto, logo abaixo do header) em vez de empurrá-lo. Por ficar
 * fora do fluxo, o painel não entra na altura que o HeaderMeasure publica.
 */
export function MobileMenu() {
  const pathname = usePathname();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  // Fecha ao trocar de rota (ajuste de estado durante o render, sem effect):
  // guardar "a rota em que abriu" reabriria o painel ao voltar com o Back.
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    setOpen(false);
  }

  // Esc fecha o painel e devolve o foco ao botão.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <div className="lg:hidden">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={MOBILE_MENU_ID}
        onClick={() => setOpen((value) => !value)}
        className="-mr-2 inline-flex h-10 w-10 items-center justify-center rounded-md text-white/85 transition-colors hover:text-white"
      >
        <span className="sr-only">{open ? "Fechar menu" : "Abrir menu"}</span>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          className="h-6 w-6"
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

      {/* Painel: ancorado no <header> (sticky é posicionado); max-h cobre paisagem */}
      <nav
        id={MOBILE_MENU_ID}
        aria-label="Navegação principal"
        className={`${open ? "block" : "hidden"} absolute left-0 right-0 top-full max-h-[calc(100dvh_-_var(--az-header-h,80px))] overflow-y-auto border-t border-white/10 bg-[#132960] shadow-[0_12px_24px_rgba(19,41,96,0.35)]`}
      >
        <ul
          className={`mx-auto flex w-full ${SITE_MAIN_MAX_WIDTH_CLASS} flex-col gap-1 px-4 py-3 text-sm font-semibold uppercase tracking-wider md:px-8`}
        >
          {navItems.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  onClick={() => setOpen(false)}
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
      </nav>
    </div>
  );
}
