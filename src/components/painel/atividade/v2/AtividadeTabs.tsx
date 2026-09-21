"use client";

import { SectionTabs } from "@/components/painel/core/SectionTabs";

/** Abas irmãs da seção Atividade — 1º elemento de todas as páginas da área. */
const ABAS = [
  { slug: "", label: "Visão geral" },
  { slug: "pib", label: "PIB" },
  { slug: "pim", label: "PIM-PF" },
  { slug: "pmc", label: "PMC" },
  { slug: "pms", label: "PMS" },
] as const;

export const ATIVIDADE_BASE = "/painel-economico/economia/brasil/atividade";

export function AtividadeTabs() {
  return <SectionTabs base={ATIVIDADE_BASE} abas={ABAS} ariaLabel="Abas da seção Atividade" />;
}
