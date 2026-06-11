import Link from "next/link";
import { Clock } from "lucide-react";
import { CommunityCallout } from "@/components/home/CommunityCallout";
import { CATEGORIAS, ORDEM_CATEGORIAS, simuladores } from "@/data/simuladores";
import { SITE_MAIN_MAX_WIDTH_CLASS } from "@/lib/site-layout";

export const metadata = {
  title: "Simuladores | AZ Invest",
  description:
    "Simuladores de juros compostos, aposentadoria, PGBL, financiamento, consórcio, compromissadas e proteção patrimonial. Números honestos, premissas à vista.",
};

export default function SimuladoresPage() {
  return (
    <main
      className={`mx-auto flex w-full ${SITE_MAIN_MAX_WIDTH_CLASS} flex-col gap-12 px-4 py-8 md:px-8`}
    >
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-[#027DFC]">
          Ferramentas de decisão financeira
        </p>
        <h1 className="text-4xl text-[#132960] md:text-5xl">Simuladores</h1>
        <p className="max-w-2xl text-sm text-zinc-600">
          Números honestos, premissas à vista. Escolha a pergunta que você quer
          responder e simule em poucos minutos.
        </p>
      </header>

      {ORDEM_CATEGORIAS.map((slug) => {
        const cat = CATEGORIAS[slug];
        const sims = simuladores.filter((sim) => sim.categoria === slug);
        if (sims.length === 0) return null;
        const CatIcon = cat.icone;

        return (
          <section key={slug} className="space-y-4">
            <div className="space-y-1.5">
              <p
                className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider"
                style={{ color: cat.cor }}
              >
                <CatIcon className="h-4 w-4" aria-hidden />
                {cat.nome}
              </p>
              <p className="text-sm text-zinc-600">{cat.descricao}</p>
              <div
                className="h-0.5 w-full rounded-full"
                style={{ backgroundColor: `${cat.cor}33` }}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {sims.map((sim) => {
                const SimIcon = sim.icone;
                return (
                  <Link
                    key={sim.slug}
                    href={`/simuladores/${sim.slug}`}
                    className="az-hover-lift group flex h-full flex-col gap-3 rounded-2xl border border-[#132960]/10 bg-white p-6 shadow-sm"
                    style={{ borderTopWidth: 3, borderTopColor: `${cat.cor}99` }}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span
                        className="flex h-12 w-12 items-center justify-center rounded-xl"
                        style={{ backgroundColor: `${cat.cor}1A` }}
                      >
                        <SimIcon
                          className="h-5 w-5"
                          style={{ color: cat.cor }}
                          aria-hidden
                        />
                      </span>
                      {sim.popular && (
                        <span className="rounded-full bg-[#FF5713]/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#FF5713]">
                          Mais usado
                        </span>
                      )}
                    </div>
                    <h2 className="text-2xl font-semibold text-[#132960]">
                      {sim.title}
                    </h2>
                    <p className="text-sm text-zinc-600">
                      Responde: <span className="italic">{sim.pergunta}</span>
                    </p>
                    <div className="mt-auto flex items-center justify-between pt-2">
                      <span className="flex items-center gap-1.5 text-xs text-zinc-500">
                        <Clock className="h-3.5 w-3.5" aria-hidden />~
                        {sim.tempoMin} min
                      </span>
                      <span
                        className="text-xs font-semibold group-hover:underline"
                        style={{ color: cat.cor }}
                      >
                        Abrir simulador <span aria-hidden>→</span>
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        );
      })}

      <CommunityCallout />
    </main>
  );
}
