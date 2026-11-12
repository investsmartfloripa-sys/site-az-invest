import Link from "next/link";

import { TreasuryTimeSeries } from "@/components/painel/market/TreasuryTimeSeries";
import { CreditSpreadsHistory } from "@/components/painel/market/CreditSpreadsHistory";
import { MethodInfo } from "@/components/painel/core/MethodInfo";
import { ComunidadeMercado } from "@/components/painel/market/ComunidadeMercado";
import { getRendaFixaData } from "@/lib/painel-renda-fixa-data";

export const metadata = {
  title: "Renda fixa — Mercado",
  description:
    "Curvas históricas de juros dos títulos públicos (Pré e IPCA+) por data de vencimento, e spreads de crédito privado via ANBIMA.",
};

// ISR: dados vêm do Blob com loaders guardados (degradam para null); ver plano AVALIACAO-GERAL §6.
export const revalidate = 3600;

export default async function RendaFixaPage() {
  const { treasury, credit } = await getRendaFixaData();

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#027DFC]">
          Mercado · Brasil · Renda fixa
        </p>
        <h1 className="text-2xl font-semibold text-[#132960]">
          Curva histórica e crédito privado
          <MethodInfo className="ml-1.5 align-middle">
            Fonte: <strong>ANBIMA mercado secundário</strong>, atualizada após o fechamento de
            cada pregão (D-1).
          </MethodInfo>
        </h1>
        <p className="max-w-3xl text-sm text-zinc-600">
          Acompanhe a evolução da taxa indicativa de cada vencimento dos títulos públicos federais
          (Prefixados e IPCA+) e o spread médio de crédito privado nas debêntures. Ver também as{" "}
          <Link href="/painel-economico/panorama" className="underline hover:text-[#027DFC]">
            curvas DI e a Selic implícita no Panorama
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
            <strong>Títulos públicos (Pré e IPCA+)</strong>: taxa indicativa que a ANBIMA publica todo
            dia útil para o mercado secundário. O Prefixado reúne LTN e NTN-F; o IPCA+ usa NTN-B.
          </li>
          <li>
            <strong>Crédito privado</strong>: mediana e quartis (25% e 75%) da taxa indicativa das
            debêntures publicada pela ANBIMA, separados por indexador.
          </li>
          <li>
            <strong>Histórico</strong>: a ANBIMA deixa consultar só os últimos meses; guardamos cada
            dia publicado, então as séries ficam mais longas com o tempo.
          </li>
        </ul>
      </section>

      <ComunidadeMercado assunto="renda fixa" origem="PAINEL_RENDA_FIXA" />
    </div>
  );
}
