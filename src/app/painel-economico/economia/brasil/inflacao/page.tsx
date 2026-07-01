import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Inflação",
  description:
    "Painéis de inflação brasileira: IPCA (oficial do Banco Central) e IGP-M (FGV). Escolha o índice para abrir o painel detalhado.",
};

const PAINEIS = [
  {
    slug: "ipca",
    titulo: "IPCA",
    subtitulo: "Índice oficial do BC — IBGE",
    descricao:
      "Inflação ao consumidor amplo (rendas até 40 SM). Meta da política monetária. Abertura por grupo, núcleos, difusão e expectativas Focus.",
  },
  {
    slug: "igp-m",
    titulo: "IGP-M",
    subtitulo: "FGV — referência de contratos",
    descricao:
      "Composto por IPA-M (60%), IPC-M (30%) e INCC-M (10%). Indexador de aluguéis e contratos. Sensível a câmbio e commodities.",
  },
];


export default function PainelInflacaoHub() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-[#132960]">Inflação</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Escolha o índice para abrir o painel detalhado.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {PAINEIS.map((p) => (
          <Link
            key={p.slug}
            href={`/painel-economico/economia/brasil/inflacao/${p.slug}`}
            className="group block rounded-2xl border border-[#132960]/15 bg-white p-6 shadow-sm transition hover:border-[#027DFC] hover:shadow-md"
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-2xl font-bold text-[#132960] group-hover:text-[#027DFC]">
                  {p.titulo}
                </h2>
                <p className="mt-0.5 text-xs font-medium uppercase tracking-wide text-zinc-500">
                  {p.subtitulo}
                </p>
              </div>
              <span
                className="text-xl text-zinc-300 transition group-hover:translate-x-1 group-hover:text-[#027DFC]"
                aria-hidden="true"
              >
                →
              </span>
            </div>
            <p className="mt-3 text-sm text-zinc-600">{p.descricao}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
