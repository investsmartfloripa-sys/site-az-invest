import { CommunityCallout } from "@/components/home/CommunityCallout";
import { SimuladoresExplorer } from "@/components/simuladores/SimuladoresExplorer";
import { SITE_MAIN_MAX_WIDTH_CLASS } from "@/lib/site-layout";

export const metadata = {
  title: "Simuladores",
  description:
    "Simuladores de juros compostos, aposentadoria, PGBL, financiamento, consórcio, compromissadas e proteção patrimonial. Números honestos, premissas à vista.",
};

export default function SimuladoresPage() {
  return (
    <main
      className={`mx-auto flex w-full ${SITE_MAIN_MAX_WIDTH_CLASS} flex-col gap-12 px-4 py-8 md:px-8`}
    >
      <SimuladoresExplorer />
      <CommunityCallout />
    </main>
  );
}
