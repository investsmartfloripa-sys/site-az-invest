"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Tab bar persistente da seção fiscal — a navegação entre as três abas irmãs
 * que a revisão de 13/08 apontou como o maior atrito da seção (o único caminho
 * era voltar ao hub). Renderizada como primeiro elemento dos três painéis.
 */
const ABAS = [
  { slug: "divida", label: "Dívida" },
  { slug: "receita-e-gastos", label: "Receita e gastos" },
  { slug: "indicadores-de-risco-fiscal", label: "Indicadores de risco" },
] as const;

const BASE = "/painel-economico/economia/brasil/fiscal";

export function FiscalTabs() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Abas da seção fiscal"
      className="flex w-fit flex-wrap items-center gap-1 rounded-xl border border-[#132960]/10 bg-white p-1 shadow-sm"
    >
      {ABAS.map((a) => {
        const href = `${BASE}/${a.slug}`;
        const ativa = pathname?.startsWith(href) ?? false;
        return (
          <Link
            key={a.slug}
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
