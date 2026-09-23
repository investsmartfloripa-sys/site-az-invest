"use client";

import { SectionTabs } from "@/components/painel/core/SectionTabs";

/** Abas irmãs de Contas Externas — 1º elemento das duas páginas da área. */
const ABAS = [
  { slug: "", label: "Balanço de pagamentos" },
  { slug: "cambio", label: "Câmbio" },
] as const;

export const CONTAS_EXTERNAS_BASE = "/painel-economico/economia/brasil/contas-externas";

export function ContasExternasTabs() {
  return <SectionTabs base={CONTAS_EXTERNAS_BASE} abas={ABAS} ariaLabel="Abas de Contas Externas" />;
}
