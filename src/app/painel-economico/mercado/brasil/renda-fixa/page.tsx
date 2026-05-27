import Link from "next/link";

import { TreasuryTimeSeries } from "@/components/painel/market/TreasuryTimeSeries";
import { CreditSpreadsHistory } from "@/components/painel/market/CreditSpreadsHistory";
import { getRendaFixaData } from "@/lib/painel-renda-fixa-data";

export const metadata = {
  title: "Renda Fixa — Ativos de mercado | AZ Invest",
  description:
    "Curvas históricas de juros dos títulos públicos (Pré e IPCA+) por data de vencimento, e spreads de crédito privado via ANBIMA.",
};

export const dynamic = "force-dynamic";

export default async function RendaFixaPage() {
  const { treasury, credit } = await getRendaFixaData();

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#027DFC]">
          Ativos de mercado · Brasil · Renda fixa
        </p>
        <h2 className="text-2xl font-semibold text-[#132960]">Curva histórica e crédito privado</h2>
        <p className="max-w-3xl text-sm text-zinc-600">
          Acompanhe a evolução da taxa indicativa de cada vencimento dos títulos públicos federais
          (Prefixados e IPCA+) e o spread médio de crédito privado nas debêntures. Fonte:
          <strong> ANBIMA mercado secundário</strong>, atualizada após o fechamento de cada pregão
          (D-1). Ver também a{" "}
          <Link href="/painel-economico/economia/brasil/politica-monetaria" className="underline hover:text-[#027DFC]">
            trilha de política monetária
          </Link>
          .
        </p>
      </header>

      <TreasuryTimeSeries data={treasury} />
      <CreditSpreadsHistory data={credit} />

      <section className="rounded-2xl border border-[#132960]/10 bg-zinc-50/50 p-4 text-xs text-zinc-600">
        <p className="font-semibold uppercase tracking-wide text-zinc-500">Notas metodológicas</p>
        <ul className="mt-2 space-y-1 list-disc pl-4">
          <li>
            <strong>Títulos públicos (Pré e IPCA+)</strong>: taxa indicativa publicada pela ANBIMA no
            arquivo <code>ms{`{YYMMDD}`}.txt</code>. Categoria Prefixado consolida LTN e NTN-F; IPCA+ usa NTN-B.
          </li>
          <li>
            <strong>Crédito privado</strong>: mediana, P25 e P75 da taxa indicativa publicada pela
            ANBIMA no arquivo <code>db{`{YYMMDD}`}.txt</code>, agregada por indexador.
          </li>
          <li>
            O histórico online da ANBIMA é tipicamente de ~3 meses. A partir do deploy, o pipeline
            diário vai acumulando dias até atingir séries mais longas.
          </li>
        </ul>
      </section>
    </div>
  );
}
