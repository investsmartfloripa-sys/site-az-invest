import type { Metadata } from "next";

import { FiscalDashboard } from "@/components/painel/fiscal/FiscalDashboard";
import { loadFiscalClassicos } from "@/lib/painel-fiscal";

export const metadata: Metadata = {
  title: "Fiscal — Brasil — AZ Invest",
  description:
    "Diagnóstico fiscal brasileiro: DBGG, DLSP, resultado primário, juros nominais, NFSP, Selic real, REER e reservas. Atualizado diariamente via BCB SGS, Focus e IBGE.",
};

export const revalidate = 3600;

export default async function PainelFiscalPage() {
  const data = await loadFiscalClassicos();

  if (!data) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-[#132960]">Fiscal — Brasil</h1>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
          <p className="font-semibold">Dados em preparação</p>
          <p className="mt-2">
            O pipeline diário está sendo executado pela primeira vez. Os dados ficarão disponíveis em alguns
            minutos. Tente recarregar a página em breve.
          </p>
          <p className="mt-3 text-xs">
            Enquanto isso, acesse o{" "}
            <a className="text-[#027DFC] hover:underline" href="/painel-economico/economia/brasil/fiscal/termometro-fiscal">
              Termômetro Fiscal
            </a>
            .
          </p>
        </div>
      </div>
    );
  }

  return <FiscalDashboard data={data} />;
}
