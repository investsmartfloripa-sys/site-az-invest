import Link from "next/link";
import type { Metadata } from "next";
import { Footer } from "@/components/common/Footer";
import { Header } from "@/components/common/Header";
import { PostCard } from "@/components/common/PostCard";
import { DestaquesDaSemana } from "@/components/conteudo/DestaquesDaSemana";
import { formatDateBR, listBriefings } from "@/lib/cafe-com-mercado";
import { listPautas } from "@/lib/pauta-da-semana";
import { findPosts, mapPost } from "@/lib/posts";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Conteúdo",
  description:
    "Todo o conteúdo editorial do AZ Invest em um só lugar: Café com Mercado diário, Pauta da Semana e artigos sobre economia, mercado e educação financeira.",
  alternates: { canonical: "/conteudo" },
  openGraph: {
    title: "Conteúdo | AZ Invest",
    description:
      "Café com Mercado, Pauta da Semana e artigos sobre economia, mercado e educação financeira.",
    type: "website",
  },
};

export default async function ConteudoHub() {
  const [posts, cafes, pautas] = await Promise.all([
    findPosts({
      where: { published: true },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
    listBriefings(5),
    listPautas(5),
  ]);
  const mappedPosts = posts.map(mapPost);

  return (
    <div className="min-h-screen text-[#132960]">
      <Header />
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-4 py-8 md:px-8">
        <DestaquesDaSemana />

        {/* Artigos editoriais */}
        <section className="space-y-4">
          <div className="flex items-baseline justify-between">
            <h2 className="text-2xl font-semibold text-[#132960] md:text-3xl">
              Artigos
            </h2>
            <Link
              href="/blog"
              className="text-sm font-semibold text-[#027DFC] hover:underline"
            >
              Ver todos →
            </Link>
          </div>
          {mappedPosts.length === 0 ? (
            <p className="text-zinc-700">Sem artigos publicados ainda.</p>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {mappedPosts.map((p) => (
                <PostCard key={p.id} post={p} />
              ))}
            </div>
          )}
        </section>

        {/* Café com Mercado — arquivo */}
        <section className="space-y-4">
          <div className="flex items-baseline justify-between">
            <h2 className="text-2xl font-semibold text-[#132960] md:text-3xl">
              Café com Mercado
            </h2>
            <Link
              href="/cafe-com-mercado"
              className="text-sm font-semibold text-[#027DFC] hover:underline"
            >
              Ver arquivo completo →
            </Link>
          </div>
          {cafes.length === 0 ? (
            <p className="text-zinc-700">Sem briefings publicados ainda.</p>
          ) : (
            <ul className="space-y-3">
              {cafes.map((b) => (
                <li key={b.date}>
                  <Link
                    href={`/cafe-com-mercado/${b.date}`}
                    className="az-card group block p-5 transition hover:border-[#027DFC]/40"
                  >
                    <p className="text-xs font-semibold uppercase tracking-wider text-[#027DFC]">
                      {b.weekday ? `${b.weekday}, ` : ""}
                      {formatDateBR(b.date)}
                    </p>
                    <h3 className="mt-1 text-lg font-semibold text-[#132960] group-hover:text-[#027DFC]">
                      {b.title}
                    </h3>
                    {b.description ? (
                      <p className="mt-2 line-clamp-2 text-sm text-zinc-700">
                        {b.description}
                      </p>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Pauta da Semana — arquivo */}
        <section className="space-y-4">
          <div className="flex items-baseline justify-between">
            <h2 className="text-2xl font-semibold text-[#132960] md:text-3xl">
              Pauta da Semana
            </h2>
            <Link
              href="/pauta-da-semana"
              className="text-sm font-semibold text-[#027DFC] hover:underline"
            >
              Ver todas →
            </Link>
          </div>
          {pautas.length === 0 ? (
            <p className="text-zinc-700">
              A primeira pauta semanal sai em breve.
            </p>
          ) : (
            <ul className="space-y-3">
              {pautas.map((p) => (
                <li key={p.slug}>
                  <Link
                    href={`/pauta-da-semana/${p.slug}`}
                    className="az-card group block p-5 transition hover:border-[#027DFC]/40"
                  >
                    <p className="text-xs font-semibold uppercase tracking-wider text-[#027DFC]">
                      Semana de {formatDateBR(p.date)}
                    </p>
                    <h3 className="mt-1 text-lg font-semibold text-[#132960] group-hover:text-[#027DFC]">
                      {p.title}
                    </h3>
                    {p.description ? (
                      <p className="mt-2 line-clamp-2 text-sm text-zinc-700">
                        {p.description}
                      </p>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
      <Footer />
    </div>
  );
}
