"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  ChartColumn,
  ChevronDown,
  ChevronRight,
  Database,
  FileText,
  History,
  Inbox,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Shield,
  SquareCheckBig,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { SubmitButton } from "@/components/workspace/SubmitButton";

const NAV_ICONS = {
  dashboard: LayoutDashboard,
  conteudo: FileText,
  comentarios: MessageSquare,
  revisao: SquareCheckBig,
  perfil: UserRound,
  autores: Users,
  leads: Inbox,
  metricas: ChartColumn,
  atividade: History,
  dados: Database,
  usuarios: Shield,
} as const;

export type WorkspaceNavIcon = keyof typeof NAV_ICONS;

export type WorkspaceNavItem = {
  href: string;
  label: string;
  icon: WorkspaceNavIcon;
  /** Contador exibido como badge (ex.: textos aguardando revisão). */
  badge?: number;
};

/** Cookie lido no server (layout) para o estado inicial não piscar. */
export const SIDEBAR_COOKIE_NAME = "az_ws_sidebar";

const SEGMENT_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  conteudo: "Conteúdo",
  comentarios: "Comentários",
  novo: "Novo texto",
  revisao: "Revisão",
  autores: "Autores",
  leads: "Leads",
  metricas: "Métricas",
  atividade: "Atividade",
  dados: "Saúde dos dados",
  usuarios: "Usuários",
  perfil: "Meu perfil",
};

type Crumb = { label: string; href: string };

function buildBreadcrumb(pathname: string): Crumb[] {
  const segments = pathname
    .replace(/^\/area-restrita\/?/, "")
    .split("/")
    .filter(Boolean);

  const crumbs: Crumb[] = [];
  let href = "/area-restrita";
  for (const segment of segments) {
    href += `/${segment}`;
    const label = SEGMENT_LABELS[segment] ?? (/^\d+$/.test(segment) ? "Editar" : segment);
    crumbs.push({ label, href });
  }
  return crumbs;
}

function initialsOf(name: string | null, email: string) {
  const source = (name || "").trim() || email;
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

function badgeText(count: number) {
  return count > 9 ? "9+" : String(count);
}

export function WorkspaceShell({
  nav,
  roleLabel,
  email,
  name,
  profileHref,
  defaultCollapsed,
  children,
  logoutAction,
}: {
  nav: WorkspaceNavItem[];
  roleLabel: string;
  email: string;
  name: string | null;
  /** Link "Meu perfil" no menu do usuário (null quando o papel não tem perfil). */
  profileHref: string | null;
  /** Estado inicial vindo do cookie, lido no server para não piscar. */
  defaultCollapsed: boolean;
  children: React.ReactNode;
  logoutAction: () => Promise<void>;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [lastPathname, setLastPathname] = useState(pathname);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Fecha drawer e menu do usuário ao navegar (ajuste de estado durante o
  // render, padrão recomendado pelo React para reagir a mudança de prop).
  if (lastPathname !== pathname) {
    setLastPathname(pathname);
    setMobileOpen(false);
    setUserMenuOpen(false);
  }

  const crumbs = buildBreadcrumb(pathname);
  const initials = initialsOf(name, email);

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    document.cookie = `${SIDEBAR_COOKIE_NAME}=${next ? "1" : "0"}; path=/; max-age=${
      60 * 60 * 24 * 365
    }; samesite=lax`;
  }

  // Esc fecha drawer mobile e menu do usuário.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setMobileOpen(false);
        setUserMenuOpen(false);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  // Clique fora fecha o menu do usuário.
  useEffect(() => {
    if (!userMenuOpen) return;
    function onPointerDown(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [userMenuOpen]);

  // Trava o scroll do body enquanto o drawer mobile está aberto.
  useEffect(() => {
    if (!mobileOpen) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  function renderNavItems(isCollapsed: boolean, onNavigate?: () => void) {
    return nav.map((item) => {
      const active = isActive(item.href);
      const Icon = NAV_ICONS[item.icon];
      const badge = item.badge && item.badge > 0 ? item.badge : null;

      return (
        <Link
          key={item.href}
          href={item.href}
          onClick={onNavigate}
          aria-current={active ? "page" : undefined}
          title={isCollapsed ? item.label : undefined}
          className={`relative flex items-center rounded-md text-sm font-medium transition ${
            isCollapsed ? "h-10 justify-center" : "gap-3 px-3 py-2"
          } ${
            active
              ? "bg-white/10 text-white"
              : "text-white/70 hover:bg-white/10 hover:text-white"
          }`}
        >
          {active ? (
            <span
              aria-hidden
              className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-[#027DFC]"
            />
          ) : null}
          <span className="relative shrink-0">
            <Icon
              aria-hidden
              className={`h-[18px] w-[18px] ${active ? "text-[#4DA3FD]" : ""}`}
            />
            {isCollapsed && badge ? (
              <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#FF5713] px-1 text-[9px] font-bold leading-none text-white">
                {badgeText(badge)}
              </span>
            ) : null}
          </span>
          {!isCollapsed ? (
            <>
              <span className="truncate">{item.label}</span>
              {badge ? (
                <span className="ml-auto rounded-full bg-[#FF5713] px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                  {badgeText(badge)}
                </span>
              ) : null}
            </>
          ) : null}
        </Link>
      );
    });
  }

  return (
    <div className="min-h-screen bg-[#F3F5FB] text-[#132960]">
      <div className="flex w-full">
        {/* Sidebar desktop: expandida (240px) ou rail só-ícones (56px) */}
        <aside
          className={`sticky top-0 hidden h-screen shrink-0 flex-col bg-[#132960] transition-[width] duration-200 md:flex ${
            collapsed ? "w-14" : "w-60"
          }`}
        >
          <div
            className={`flex h-16 shrink-0 items-center border-b border-white/10 ${
              collapsed ? "justify-center" : "px-4"
            }`}
          >
            {collapsed ? (
              <Link
                href="/area-restrita/dashboard"
                title="AZ Invest — Dashboard"
                className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-xs font-bold tracking-wide text-white"
              >
                AZ
              </Link>
            ) : (
              <Link href="/area-restrita/dashboard" className="block">
                <Image
                  src="/logo-az-branco.png"
                  alt="AZ Invest"
                  width={951}
                  height={310}
                  priority
                  className="h-8 w-auto"
                />
              </Link>
            )}
          </div>

          {!collapsed ? (
            <p className="px-5 pt-4 text-[11px] font-semibold uppercase tracking-wider text-[#027DFC]">
              Workspace · {roleLabel}
            </p>
          ) : null}

          <nav
            aria-label="Navegação do workspace"
            className={`flex flex-1 flex-col gap-1 overflow-y-auto px-2 ${
              collapsed ? "py-4" : "py-3"
            }`}
          >
            {renderNavItems(collapsed)}
          </nav>

          <div className="border-t border-white/10 p-2">
            <button
              type="button"
              onClick={toggleCollapsed}
              aria-pressed={collapsed}
              title={collapsed ? "Expandir menu" : "Recolher menu"}
              className={`flex w-full items-center rounded-md text-sm text-white/60 transition hover:bg-white/10 hover:text-white ${
                collapsed ? "h-10 justify-center" : "gap-3 px-3 py-2"
              }`}
            >
              {collapsed ? (
                <PanelLeftOpen aria-hidden className="h-[18px] w-[18px]" />
              ) : (
                <>
                  <PanelLeftClose aria-hidden className="h-[18px] w-[18px]" />
                  <span>Recolher menu</span>
                </>
              )}
            </button>
          </div>
        </aside>

        <div className="flex min-h-screen min-w-0 flex-1 flex-col">
          {/* Topbar branca: hambúrguer (mobile), breadcrumb e menu do usuário */}
          <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-[#132960]/10 bg-white px-4 md:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileOpen(true)}
                aria-label="Abrir menu de navegação"
                className="rounded-md p-2 text-[#132960]/70 transition hover:bg-[#132960]/5 hover:text-[#132960] md:hidden"
              >
                <Menu aria-hidden className="h-5 w-5" />
              </button>

              <nav aria-label="Trilha de navegação" className="min-w-0">
                <ol className="flex items-center gap-1.5 text-sm">
                  <li className="hidden items-center gap-1.5 sm:flex">
                    <Link
                      href="/area-restrita/dashboard"
                      className="text-[#132960]/50 transition hover:text-[#132960]"
                    >
                      Workspace
                    </Link>
                  </li>
                  {crumbs.map((crumb, index) => {
                    const isLast = index === crumbs.length - 1;
                    return (
                      <li
                        key={crumb.href}
                        className={`items-center gap-1.5 ${
                          isLast ? "flex min-w-0" : "hidden sm:flex"
                        }`}
                      >
                        <ChevronRight
                          aria-hidden
                          className="hidden h-3.5 w-3.5 shrink-0 text-[#132960]/30 sm:block"
                        />
                        {isLast ? (
                          <span
                            aria-current="page"
                            className="truncate font-semibold text-[#132960]"
                          >
                            {crumb.label}
                          </span>
                        ) : (
                          <Link
                            href={crumb.href}
                            className="text-[#132960]/50 transition hover:text-[#132960]"
                          >
                            {crumb.label}
                          </Link>
                        )}
                      </li>
                    );
                  })}
                </ol>
              </nav>
            </div>

            <div ref={userMenuRef} className="relative shrink-0">
              <button
                type="button"
                onClick={() => setUserMenuOpen((v) => !v)}
                aria-expanded={userMenuOpen}
                aria-haspopup="menu"
                className="flex items-center gap-2 rounded-full p-1 pr-2 transition hover:bg-[#132960]/5"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#132960] text-xs font-bold text-white">
                  {initials}
                </span>
                <span className="hidden text-left sm:block">
                  <span className="block max-w-[150px] truncate text-sm font-medium text-[#132960]">
                    {name || email}
                  </span>
                  <span className="block text-[11px] text-[#132960]/55">{roleLabel}</span>
                </span>
                <ChevronDown
                  aria-hidden
                  className={`h-4 w-4 text-[#132960]/50 transition-transform ${
                    userMenuOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {userMenuOpen ? (
                <div
                  role="menu"
                  className="absolute right-0 top-[calc(100%+8px)] w-64 rounded-2xl border border-[#132960]/10 bg-white p-2 shadow-xl"
                >
                  <div className="border-b border-[#132960]/10 px-3 pb-3 pt-2">
                    <p className="truncate text-sm font-semibold text-[#132960]">
                      {name || email}
                    </p>
                    <p className="truncate text-xs text-[#132960]/55">{email}</p>
                    <span className="mt-2 inline-block rounded-full bg-[#027DFC]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#027DFC]">
                      {roleLabel}
                    </span>
                  </div>
                  {profileHref ? (
                    <Link
                      role="menuitem"
                      href={profileHref}
                      onClick={() => setUserMenuOpen(false)}
                      className="mt-1 flex items-center gap-2 rounded-md px-3 py-2 text-sm text-[#132960]/80 transition hover:bg-[#132960]/5 hover:text-[#132960]"
                    >
                      <UserRound aria-hidden className="h-4 w-4" />
                      Meu perfil
                    </Link>
                  ) : null}
                  <form action={logoutAction} className="mt-1">
                    <SubmitButton className="w-full rounded-md px-3 py-2 text-sm text-[#9C2B24] transition hover:bg-[#9C2B24]/5">
                      <LogOut aria-hidden className="h-4 w-4" />
                      Sair
                    </SubmitButton>
                  </form>
                </div>
              ) : null}
            </div>
          </header>

          <main className="flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
        </div>
      </div>

      {/* Drawer mobile com overlay (não empurra o conteúdo) */}
      <div
        aria-hidden
        onClick={() => setMobileOpen(false)}
        className={`fixed inset-0 z-40 bg-[#0b1c3f]/60 transition-opacity duration-200 md:hidden ${
          mobileOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />
      <aside
        aria-label="Menu do workspace"
        className={`fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col bg-[#132960] transition-transform duration-200 md:hidden ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-white/10 px-4">
          <Link href="/area-restrita/dashboard" onClick={() => setMobileOpen(false)}>
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
            onClick={() => setMobileOpen(false)}
            aria-label="Fechar menu"
            className="rounded-md p-2 text-white/70 transition hover:bg-white/10 hover:text-white"
          >
            <X aria-hidden className="h-5 w-5" />
          </button>
        </div>

        <p className="px-5 pt-4 text-[11px] font-semibold uppercase tracking-wider text-[#027DFC]">
          Workspace · {roleLabel}
        </p>

        <nav
          aria-label="Navegação do workspace"
          className="flex flex-1 flex-col gap-1 overflow-y-auto px-2 py-3"
        >
          {renderNavItems(false, () => setMobileOpen(false))}
        </nav>

        <div className="border-t border-white/10 p-3">
          <p className="truncate px-2 text-xs text-white/50">{email}</p>
          <form action={logoutAction} className="mt-2">
            <SubmitButton className="w-full rounded-md px-3 py-2 text-sm text-white/70 transition hover:bg-white/10 hover:text-white">
              <LogOut aria-hidden className="h-4 w-4" />
              Sair
            </SubmitButton>
          </form>
        </div>
      </aside>
    </div>
  );
}
