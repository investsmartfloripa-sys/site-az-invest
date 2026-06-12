import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Emprego — AZ Invest",
  description:
    "Painéis do mercado de trabalho brasileiro: PNAD (pesquisa amostral do IBGE, inclui informal) e CAGED (registro administrativo do MTE, formal). Escolha a fonte para abrir o painel detalhado.",
};

const PAINEIS = [
  {
    slug: "pnad",
    titulo: "PNAD",
    subtitulo: "IBGE — pesquisa amostral domiciliar",
    descricao:
      "Taxa de desocupação, participação na força de trabalho, informalidade, composição da ocupação e setor de atividade. Trimestral, inclui mercado informal.",
  },
  {
    slug: "caged",
    titulo: "CAGED",
    subtitulo: "MTE — registro administrativo",
    descricao:
      "Saldo mensal de admissões e demissões com carteira (CLT), com quebras por faixa salarial e setor IBGE. Cobre apenas o mercado formal.",
  },
];


export default function PainelEmpregoHub() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-[#132960]">Emprego</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Escolha a fonte para abrir o painel detalhado.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {PAINEIS.map((p) => (
          <Link
            key={p.slug}
            href={`/painel-economico/economia/brasil/emprego/${p.slug}`}
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
