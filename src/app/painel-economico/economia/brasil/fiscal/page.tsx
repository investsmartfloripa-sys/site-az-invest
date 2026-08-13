import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Fiscal",
  description:
    "Painéis fiscais brasileiros: divida publica (DBGG, DLSP), receita e gastos do governo central, e Indicadores de Risco Fiscal aplicando as formulas de Ray Dalio (How Countries Go Broke) ao Brasil.",
};

const PAINEIS = [
  {
    slug: "divida",
    titulo: "Dívida",
    subtitulo: "DBGG, DLSP — estoque",
    descricao:
      "Trajetória da dívida bruta do governo geral (DBGG) e da dívida líquida do setor público (DLSP). Fonte: BCB SGS.",
  },
  {
    slug: "receita-e-gastos",
    titulo: "Receita e gastos",
    subtitulo: "Governo central — fluxo",
    descricao:
      "Receita líquida do Tesouro, despesa primária, juros nominais e resultado primário. Decomposição por previdência, pessoal e discricionárias. Fonte: STN/RTN + BCB.",
  },
  {
    slug: "indicadores-de-risco-fiscal",
    titulo: "Indicadores de Risco Fiscal",
    subtitulo: "Framework Ray Dalio",
    descricao:
      "Os 4 indicadores prioritários de How Countries Go Broke no tempo, com zonas de risco: dívida vs renda, serviço da dívida, juro vs inflação e crescimento, e dívida vs poupança — mais 20 indicadores semaforizados, matrizes e simulador.",
  },
];


export default function PainelFiscalHub() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-[#132960]">Fiscal — Brasil</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Escolha um dos painéis fiscais.
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
