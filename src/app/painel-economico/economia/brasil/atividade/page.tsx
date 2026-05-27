import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Atividade Econômica — AZ Invest",
  description:
    "Painéis de atividade econômica brasileira: PIB (IBGE Contas Nacionais Trimestrais + IBC-Br como proxy mensal), Produção Industrial (PIM-PF), Comércio Varejista (PMC) e Serviços (PMS).",
};

const CARDS = [
  {
    slug: "pib",
    titulo: "PIB",
    subtitulo: "IBGE Contas Nacionais + IBC-Br",
    descricao:
      "Produto Interno Bruto trimestral pela ótica da oferta (Agro/Indústria/Serviços) e da demanda (Consumo/FBCF/Exportações). IBC-Br do BCB como proxy mensal.",
  },
  {
    slug: "pim",
    titulo: "PIM-PF",
    subtitulo: "IBGE — Produção Industrial",
    descricao:
      "Pesquisa Industrial Mensal — Produção Física. Indústria geral, extrativa, transformação e decomposição por categoria econômica (bens de capital, intermediários, consumo).",
  },
  {
    slug: "pmc",
    titulo: "PMC",
    subtitulo: "IBGE — Comércio Varejista",
    descricao:
      "Volume de vendas no varejo restrito (9 atividades) e ampliado (inclui veículos e materiais de construção). Comparação lado a lado das duas leituras.",
  },
  {
    slug: "pms",
    titulo: "PMS",
    subtitulo: "IBGE — Serviços",
    descricao:
      "Pesquisa Mensal de Serviços. Volume agregado e ranking por segmento/atividade (alojamento, alimentação, transportes, profissionais, comunicação).",
  },
];

export const dynamic = "force-dynamic";

export default function PainelAtividadeHub() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-[#132960]">Atividade Econômica</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Indicadores de ciclo econômico brasileiro. Escolha um card para abrir o painel detalhado.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {CARDS.map((c) => (
          <Link
            key={c.slug}
            href={`/painel-economico/economia/brasil/atividade/${c.slug}`}
            className="group block rounded-2xl border border-[#132960]/15 bg-white p-6 shadow-sm transition hover:border-[#027DFC] hover:shadow-md"
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-2xl font-bold text-[#132960] group-hover:text-[#027DFC]">
                  {c.titulo}
                </h2>
                <p className="mt-0.5 text-xs font-medium uppercase tracking-wide text-zinc-500">
                  {c.subtitulo}
                </p>
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
