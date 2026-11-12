import type { Metadata } from "next";

import { PainelPanoramaPage } from "@/components/painel/PainelPanoramaPage";

export const metadata: Metadata = {
  title: "Painel econômico",
  description: "Mercados, juros, setores e indicadores da economia brasileira e global em uma tela.",
  alternates: { canonical: "/painel-economico" },
};

/** Mantem alinhado a `PAINEL_REVALIDATE_SECONDS` em painel-data (cache do fetch ao Blob). */
export const revalidate = 300;

export default async function PainelEconomicoPage() {
  return <PainelPanoramaPage />;
}
