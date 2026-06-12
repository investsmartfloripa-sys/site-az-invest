import type { Metadata } from "next";
import Link from "next/link";

import { SinteseSetorialCard } from "@/components/painel/atividade/v2/SinteseSetorialCard";
import {
  loadAtividadeCodace,
  loadAtividadeIbcBr,
  loadAtividadePim,
  loadAtividadePmc,
  loadAtividadePms,
} from "@/lib/painel-atividade";

export const metadata: Metadata = {
  title: "Atividade Econômica — AZ Invest",
  description:
    "Painéis de atividade econômica brasileira: síntese setorial pós-pandemia (indústria × varejo × serviços), PIB (IBGE Contas Nacionais + IBC-Br), Produção Industrial (PIM-PF), Comércio Varejista (PMC) e Serviços (PMS).",
};

const CARDS = [
  {
    slug: "pib",
    titulo: "PIB",
    subtitulo: "IBGE Contas Nacionais + IBC-Br",
    descricao:
      "Contribuições ao crescimento por ótica da oferta e da demanda, carrego estatístico, IBC-Br como prévia mensal e expectativas Focus.",
  },
  {
    slug: "pim",
    titulo: "PIM-PF",
    subtitulo: "IBGE — Produção Industrial",
    descricao:
      "Nível dessazonalizado vs pico histórico, ciclo por categoria de uso (bens de capital, intermediários, consumo), difusão setorial e insumos da construção.",
  },
  {
    slug: "pmc",
    titulo: "PMC",
    subtitulo: "IBGE — Comércio Varejista",
    descricao:
      "Volume do varejo restrito e ampliado vs pré-pandemia, deflator implícito (quanta inflação há nas vendas) e abertura por atividade.",
  },
  {
    slug: "pms",
    titulo: "PMS",
    subtitulo: "IBGE — Serviços",
    descricao:
      "O motor do PIB pós-pandemia: volume agregado, turismo vs patamar pré-covid, transportes (cargas × passageiros) e abertura por segmento.",
  },
];

export const revalidate = 86400;

export default async function PainelAtividadeHub() {
  const [pim, pmc, pms, ibcbr, codace] = await Promise.all([
    loadAtividadePim(),
    loadAtividadePmc(),
    loadAtividadePms(),
    loadAtividadeIbcBr(),
    loadAtividadeCodace(),
  ]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-[#132960]">Atividade Econômica</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Indicadores de ciclo econômico brasileiro. A síntese abaixo responde a pergunta mais frequente — quem recuperou da
          pandemia — e cada card abre o painel detalhado.
        </p>
      </header>

      <SinteseSetorialCard pim={pim} pmc={pmc} pms={pms} ibcbr={ibcbr} codace={codace} />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {CARDS.map((c) => (
          <Link
            key={c.slug}
            href={`/painel-economico/economia/brasil/atividade/${c.slug}`}
            className="group block rounded-2xl border border-[#132960]/15 bg-white p-6 shadow-sm transition hover:border-[#027DFC] hover:shadow-md"
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-2xl font-bold text-[#132960] group-hover:text-[#027DFC]">{c.titulo}</h2>
                <p className="mt-0.5 text-xs font-medium uppercase tracking-wide text-zinc-500">{c.subtitulo}</p>
              </div>
              <span
                className="text-xl text-zinc-300 transition group-hover:translate-x-1 group-hover:text-[#027DFC]"
                aria-hidden="true"
              >
                →
              </span>
            </div>
            <p className="mt-3 text-sm text-zinc-600">{c.descricao}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
