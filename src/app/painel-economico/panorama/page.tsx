// ISR: dados vêm do Blob com loaders guardados (degradam para null); ver plano AVALIACAO-GERAL §6.
export const revalidate = 300;

import type { Metadata } from "next";

import { PainelPanoramaPage } from "@/components/painel/PainelPanoramaPage";

export const metadata: Metadata = {
  title: "Panorama — Painel econômico",
  description: "Mercados, juros, setores e indicadores da economia brasileira e global em uma tela.",
  alternates: { canonical: "/painel-economico/panorama" },
};

export default async function PainelPanoramaRoutePage() {
  return <PainelPanoramaPage />;
}
