import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Fiscal — AZ Invest",
  description:
    "Paineis fiscais brasileiros: divida publica (DBGG, DLSP), receita e gastos do governo central, e Termometro Fiscal aplicando as formulas de Ray Dalio (How Countries Go Broke) ao Brasil.",
};

const PAINEIS = [
  {
    slug: "divida",
    titulo: "Divida",
    subtitulo: "DBGG, DLSP — estoque",
    descricao:
      "Trajetoria da divida bruta do governo geral (DBGG) e da divida liquida do setor publico (DLSP). Fonte: BCB SGS.",
  },
  {
    slug: "receita-e-gastos",
    titulo: "Receita e gastos",
    subtitulo: "Governo central — fluxo",
    descricao:
      "Receita liquida do Tesouro, despesa primaria, juros nominais e resultado primario. Decomposicao por previdencia, pessoal e discricionarias. Fonte: STN/RTN + BCB.",
  },
  {
    slug: "termometro-fiscal",
    titulo: "Termometro Fiscal",
    subtitulo: "Framework Ray Dalio",
    descricao:
      "Aplicacao das formulas de How Countries Go Broke ao Brasil: projecao de Debt/Income em 10 anos, matrizes de sensibilidade e os 4 levers para estabilizar a divida.",
  },
];

export const dynamic = "force-dynamic";

export default function PainelFiscalHub() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-[#132960]">Fiscal — Brasil</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Escolha um dos paineis fiscais.
        </p>
      </header>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {PAINEIS.map((p) => (
          <Link
            key={p.slug}
            href={`/painel-economico/economia/brasil/fiscal/${p.slug}`}
            className="group block rounded-2xl border border-[#132960]/15 bg-white p-6 shadow-sm transition hover:border-[#027DFC] hover:shadow-md"
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-bold text-[#132960] group-hover:text-[#027DFC]">
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
