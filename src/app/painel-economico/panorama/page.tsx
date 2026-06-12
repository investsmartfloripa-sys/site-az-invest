// ISR: dados vêm do Blob com loaders guardados (degradam para null); ver plano AVALIACAO-GERAL §6.
export const revalidate = 300;

import { PainelPanoramaPage } from "@/components/painel/PainelPanoramaPage";

export default async function PainelPanoramaRoutePage() {
  return <PainelPanoramaPage />;
}
