import { PainelPanoramaPage } from "@/components/painel/PainelPanoramaPage";

/** Mantem alinhado a `PAINEL_REVALIDATE_SECONDS` em painel-data (cache do fetch ao Blob). */
export const dynamic = "force-dynamic";
export const revalidate = 300;

export default async function PainelEconomicoPage() {
  return <PainelPanoramaPage />;
}
