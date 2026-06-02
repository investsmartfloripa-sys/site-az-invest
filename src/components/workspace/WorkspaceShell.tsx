"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

export type WorkspaceNavItem = { href: string; label: string };

export function WorkspaceShell({
  nav,
  roleLabel,
  email,
  children,
  logoutAction,
}: {
  nav: WorkspaceNavItem[];
  roleLabel: string;
  email: string;
  children: React.ReactNode;
  logoutAction: () => Promise<void>;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  const navLinks = (
    <nav className="mt-6 flex flex-1 flex-col gap-1">
      {nav.map((item) => {
        const active = isActive(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setMobileOpen(false)}
            className={`rounded-md px-3 py-2 text-sm font-medium transition ${
              active
                ? "bg-[#027DFC] text-white"
                : "text-white/75 hover:bg-white/10 hover:text-white"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen bg-[#F3F5FB] text-[#132960]">
      <div className="mx-auto flex w-full max-w-[1500px]">
        <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col bg-[#132960] px-3 py-5 md:flex">
          <Link href="/area-restrita/dashboard" className="block px-2">
            <Image
              src="/logo-az-branco.png"
              alt="AZ Invest"
              width={951}
              height={310}
              priority
              className="h-9 w-auto"
            />
          </Link>
          <p className="mt-3 px-2 text-[11px] font-semibold uppercase tracking-wider text-[#027DFC]">
            Workspace · {roleLabel}
          </p>
          {navLinks}
          <div className="border-t border-white/10 pt-4">
            <p className="truncate px-2 text-xs text-white/50">{email}</p>
            <form action={logoutAction} className="mt-2">
              <button
                type="submit"
                className="w-full rounded-md px-3 py-2 text-left text-sm text-white/70 hover:bg-white/10 hover:text-white"
              >
                Sair
              </button>
            </form>
          </div>
        </aside>

        <div className="flex min-h-screen w-full flex-1 flex-col">
          <header className="sticky top-0 z-20 flex items-center justify-between border-b border-[#132960]/10 bg-[#132960] px-4 py-3 md:hidden">
            <Link href="/area-restrita/dashboard">
              <Image
                src="/logo-az-branco.png"
                alt="AZ Invest"
                width={951}
                height={310}
                className="h-7 w-auto"
              />
            </Link>
            <button
              type="button"
              onClick={() => setMobileOpen((v) => !v)}
              className="rounded-md border border-white/20 px-3 py-1.5 text-sm text-white"
            >
              Menu
            </button>
          </header>

          {mobileOpen ? (
            <div className="border-b border-[#132960]/10 bg-[#0e1f49] px-3 py-3 md:hidden">
              {navLinks}
              <form action={logoutAction} className="mt-2">
                <button
                  type="submit"
                  className="w-full rounded-md px-3 py-2 text-left text-sm text-white/70 hover:bg-white/10"
                >
                  Sair
                </button>
              </form>
            </div>
          ) : null}

          <main className="flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
