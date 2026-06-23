import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { Footer } from "@/components/common/Footer";
import { Header } from "@/components/common/Header";
import { listBriefings, formatDateBR } from "@/lib/cafe-com-mercado";

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

export default async function MorningCallIndex() {
  const briefings = await listBriefings(60);

  return (
    <div className="min-h-screen text-[#132960]">
      <Header />
      <main className="mx-auto w-full max-w-3xl px-4 py-8 md:px-8">
        <h1 className="sr-only">Café com Mercado</h1>

        {briefings.length === 0 ? (
          <p className="mt-8 py-12 text-zinc-700">Nenhum briefing publicado ainda.</p>
        ) : (
          <ul className="mt-6 space-y-4">
            {briefings.map((b) => (
              <li key={b.date}>
                <Link
                  href={`/cafe-com-mercado/${b.date}`}
                  className="az-card group flex flex-col gap-4 p-5 transition hover:border-[#027DFC]/40 md:p-6"
                >
                  {b.image ? (
                    <div className="relative aspect-[1200/630] w-full overflow-hidden rounded-xl">
                      <Image
                        src={b.image}
                        alt={b.imageAlt || b.title}
                        fill
                        sizes="(max-width: 768px) 100vw, 720px"
                        className="object-cover"
                      />
                    </div>
                  ) : null}
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wider text-[#027DFC]">
                      {b.weekday ? `${b.weekday}, ` : ""}
                      {formatDateBR(b.date)}
                    </p>
                    <h2 className="mt-1 text-xl font-semibold text-[#132960] group-hover:text-[#027DFC]">
                      {b.title}
                    </h2>
                    {b.description ? (
                      <p className="mt-2 line-clamp-2 text-sm text-zinc-700">
                        {b.description}
                      </p>
                    ) : null}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
      <Footer />
    </div>
  );
}
