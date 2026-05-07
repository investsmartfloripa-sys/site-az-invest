import Link from "next/link";
import { CommunityCallout } from "@/components/home/CommunityCallout";
import { simuladores } from "@/data/simuladores";
import { SITE_MAIN_MAX_WIDTH_CLASS } from "@/lib/site-layout";

export const metadata = {
  title: "Simuladores | AZ Invest",
  description:
    "Ferramentas para simular juros compostos, reserva de emergencia, aposentadoria e mais.",
};

export default function SimuladoresPage() {
  return (
    <main
      className={`mx-auto flex w-full ${SITE_MAIN_MAX_WIDTH_CLASS} flex-col gap-10 px-4 py-8 md:px-8`}
    >
        <header className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#027DFC]">
            Ferramentas praticas
          </p>
          <h1 className="text-4xl text-[#027DFC] md:text-5xl">Simuladores</h1>
          <p className="max-w-2xl text-sm text-zinc-600">
            Ferramentas para voce visualizar diferentes cenarios financeiros e tomar decisoes
            com mais clareza. Escolha um simulador para comecar.
          </p>
        </header>

        <section className="grid gap-4 md:grid-cols-2">
          {simuladores.map((sim) => (
            <Link
              key={sim.slug}
              href={`/simuladores/${sim.slug}`}
              className="group flex h-full flex-col gap-3 rounded-2xl border border-[#132960]/15 bg-white p-6 transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#027DFC] text-2xl font-semibold text-white">
                  {sim.icon}
                </span>
                <span className="rounded-full bg-[#132960]/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#132960]">
                  {sim.highlight}
                </span>
              </div>
              <h2 className="text-2xl font-semibold text-[#132960]">{sim.title}</h2>
              <p className="text-sm text-zinc-600">{sim.description}</p>
              <span className="mt-auto text-xs font-semibold text-[#027DFC] group-hover:underline">
                Abrir simulador {"->"}
              </span>
            </Link>
          ))}
        </section>

        <CommunityCallout />
      </main>
  );
}
