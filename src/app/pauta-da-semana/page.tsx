import Link from "next/link";
import type { Metadata } from "next";
import { Footer } from "@/components/common/Footer";
import { Header } from "@/components/common/Header";
import { listPautas } from "@/lib/pauta-da-semana";
import { formatDateBR } from "@/lib/cafe-com-mercado";

export const metadata: Metadata = {
  title: "Pauta da Semana",
  description:
    "Pauta da Semana do AZ Invest: análise semanal escrita pelo economista da casa com os temas que vão mover a curva. Publicada toda segunda-feira.",
  openGraph: { images: ["/opengraph-image.png"],
    title: "Pauta da Semana | AZ Invest",
    description:
      "Análise semanal escrita pelo economista da casa com os temas que vão mover a curva.",
    type: "website",
  },
};

export default async function PautaIndex() {
  const pautas = await listPautas(60);

  return (
    <div className="min-h-screen text-[#132960]">
      <Header />
      <main className="mx-auto w-full max-w-3xl px-4 py-8 md:px-8">
        <section className="az-card p-6 md:p-10">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#027DFC]">
            Análise semanal
          </p>
          <h1 className="mt-2 text-4xl font-semibold text-[#132960] md:text-5xl">
            Pauta da Semana
          </h1>
          <p className="mt-4 text-base text-zinc-700">
            Toda segunda-feira: o que vai mover a curva nesta semana, com gráficos e
            leitura editorial do economista do AZ Invest.
          </p>
        </section>

        {pautas.length === 0 ? (
          <div className="az-card mt-6 p-6 text-center md:p-10">
            <p className="text-zinc-700">
              A primeira pauta semanal sai em breve. Enquanto isso, confira o{" "}
              <Link href="/cafe-com-mercado" className="text-[#027DFC] hover:underline">
                Café com Mercado
              </Link>{" "}
              do dia.
            </p>
          </div>
        ) : (
          <ul className="mt-6 space-y-4">
            {pautas.map((p) => (
              <li key={p.slug}>
                <Link
                  href={`/pauta-da-semana/${p.slug}`}
                  className="az-card group block p-5 transition hover:border-[#027DFC]/40 md:p-6"
                >
                  <p className="text-xs font-semibold uppercase tracking-wider text-[#027DFC]">
                    Semana de {formatDateBR(p.date)}
                  </p>
                  <h2 className="mt-1 text-xl font-semibold text-[#132960] group-hover:text-[#027DFC]">
                    {p.title}
                  </h2>
                  {p.description ? (
                    <p className="mt-2 line-clamp-2 text-sm text-zinc-700">
                      {p.description}
                    </p>
                  ) : null}
                  {p.videoUrl ? (
                    <p className="mt-2 text-xs font-semibold uppercase tracking-wider text-[#FF5713]">
                      ▶ Versão em vídeo disponível
                    </p>
                  ) : null}
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
