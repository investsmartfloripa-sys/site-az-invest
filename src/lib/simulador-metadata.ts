import type { Metadata } from "next";

import { CATEGORIAS, simuladores } from "@/data/simuladores";

/**
 * Metadata por simulador, derivada da fonte única em src/data/simuladores.ts.
 * Como as pages dos simuladores são client components, cada rota ganha um
 * layout.tsx fino que exporta `metadata = metadataSimulador("<slug>")`.
 * metadataBase já vem do root layout — URLs relativas resolvem sozinhas.
 */
export function metadataSimulador(slug: string): Metadata {
  const sim = simuladores.find((s) => s.slug === slug);
  if (!sim) {
    return { title: "Simuladores" };
  }
  const cat = CATEGORIAS[sim.categoria];
  const title = `${sim.title} — Simulador`;
  return {
    title,
    description: sim.description,
    alternates: { canonical: `/simuladores/${sim.slug}` },
    openGraph: {
      title,
      description: sim.pergunta,
      url: `/simuladores/${sim.slug}`,
      siteName: "AZ Invest",
      type: "website",
      locale: "pt_BR",
    },
    other: { "az:categoria": cat.nome },
  };
}
