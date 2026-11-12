import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { Footer } from "@/components/common/Footer";
import { Header } from "@/components/common/Header";
import { listBriefings } from "@/lib/cafe-com-mercado";

export const metadata: Metadata = {
  title: "Café com Mercado",
  description:
    "Briefing macroeconômico diário do AZ Invest: mercado brasileiro, internacional, empresas e agenda do dia. Publicado em dias úteis às ~10h Brasília.",
  openGraph: { images: ["/opengraph-image.png"],
    title: "Café com Mercado | AZ Invest",
    description:
      "Briefing macroeconômico diário do AZ Invest: mercado brasileiro, internacional, empresas e agenda do dia.",
    type: "website",
  },
};

/** "quinta-feira" + "2026-11-12" → "Quinta, 12/11/2026" — o mesmo formato dos Periódicos. */
function dataCafe(weekday: string, date: string): string {
  const dia = weekday.replace(/-feira$/, "");
  const data = date.split("-").reverse().join("/");
  return dia ? `${dia[0].toUpperCase()}${dia.slice(1)}, ${data}` : data;
}

/**
 * Arquivo do Café: título e uma linha de apresentação; a edição mais recente em destaque e as
 * anteriores em grade. O cartão mostra a data uma vez e o resumo — a manchete já está na capa
 * (revisão de 12/11/2026: coluna única de 700 px, data repetida em três formatos).
 */
export default async function MorningCallIndex() {
  const briefings = await listBriefings(60);
  const [destaque, ...anteriores] = briefings;

  return (
    <div className="min-h-screen text-[#132960]">
      <Header />
      <main className="mx-auto w-full max-w-7xl px-4 py-8 md:px-8">
        <header className="space-y-2">
          <h1 className="text-3xl text-[#132960] md:text-4xl">Café com Mercado</h1>
          <p className="max-w-2xl text-base text-zinc-600">
            O resumo do mercado de cada manhã, publicado em dias úteis por volta das 10h.
          </p>
        </header>

        {!destaque ? (
          <p className="mt-8 py-12 text-zinc-700">Nenhum briefing publicado ainda.</p>
        ) : (
          <>
            <Link
              href={`/cafe-com-mercado/${destaque.date}`}
              className="az-card group mt-6 grid gap-5 overflow-hidden p-4 transition hover:border-[#027DFC]/40 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] md:p-5"
            >
              {destaque.image ? (
                <div className="relative aspect-[1200/630] w-full overflow-hidden rounded-xl">
                  <Image
                    src={destaque.image}
                    alt={destaque.imageAlt || destaque.title}
                    fill
                    priority
                    sizes="(max-width: 768px) 100vw, 720px"
                    className="object-cover"
                  />
                </div>
              ) : null}
              <div className="flex min-w-0 flex-col justify-center gap-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-[#027DFC]">
                  Última edição · {dataCafe(destaque.weekday, destaque.date)}
                </p>
                {destaque.description ? (
                  <p className="text-lg leading-relaxed text-[#132960]">{destaque.description}</p>
                ) : null}
                <p className="text-base font-semibold text-[#027DFC]">Ler a edição →</p>
              </div>
            </Link>

            {anteriores.length > 0 ? (
              <>
                <h2 className="mt-10 text-xl text-[#132960]">Edições anteriores</h2>
                <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {anteriores.map((b) => (
                    <li key={b.date}>
                      <Link
                        href={`/cafe-com-mercado/${b.date}`}
                        className="az-card group flex h-full flex-col overflow-hidden transition hover:border-[#027DFC]/40"
                      >
                        {b.image ? (
                          <div className="relative aspect-[1200/630] w-full overflow-hidden">
                            <Image
                              src={b.image}
                              alt={b.imageAlt || b.title}
                              fill
                              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 400px"
                              className="object-cover"
                            />
                          </div>
                        ) : null}
                        <div className="flex flex-1 flex-col gap-1.5 p-4">
                          <p className="text-xs font-semibold uppercase tracking-wider text-[#027DFC]">
                            {dataCafe(b.weekday, b.date)}
                          </p>
                          {b.description ? (
                            <p className="line-clamp-3 text-sm leading-relaxed text-zinc-700 group-hover:text-[#132960]">
                              {b.description}
                            </p>
                          ) : null}
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}
