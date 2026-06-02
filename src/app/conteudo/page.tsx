import Link from "next/link";
import type { Metadata } from "next";
import { Footer } from "@/components/common/Footer";
import { Header } from "@/components/common/Header";
import { PostCard } from "@/components/common/PostCard";
import { YoutubeVideoCard } from "@/components/videos/YoutubeVideoCard";
import { formatDateBR, listBriefings } from "@/lib/cafe-com-mercado";
import { listPautas } from "@/lib/pauta-da-semana";
import { findPosts, mapPost } from "@/lib/posts";
import { fetchChannelVideos } from "@/lib/youtube";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Conteúdo",
  description:
    "Todo o conteúdo do AZ Invest em um só lugar: artigos, vídeos e os periódicos (Café com Mercado diário e Pauta da Semana).",
  alternates: { canonical: "/conteudo" },
  openGraph: {
    title: "Conteúdo | AZ Invest",
    description:
      "Artigos, vídeos e periódicos (Café com Mercado e Pauta da Semana) sobre economia, mercado e educação financeira.",
    type: "website",
  },
};

export default async function ConteudoHub() {
  const [posts, videoResult, cafes, pautas] = await Promise.all([
    findPosts({
      where: { published: true },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
    fetchChannelVideos(6),
    listBriefings(5),
    listPautas(5),
  ]);
  const mappedPosts = posts.map(mapPost);
  const videos = videoResult.videos.slice(0, 6);

  return (
    <div className="min-h-screen text-[#132960]">
      <Header />
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-4 py-8 md:px-8">
        {/* Artigos */}
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

        {/* Vídeos */}
        {videos.length > 0 ? (
          <section className="space-y-4">
            <div className="flex items-baseline justify-between">
              <h2 className="text-2xl font-semibold text-[#132960] md:text-3xl">
                Vídeos
              </h2>
              <Link
                href="/videos"
                className="text-sm font-semibold text-[#027DFC] hover:underline"
              >
                Ver todos →
              </Link>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {videos.map((v) => (
                <YoutubeVideoCard key={v.id} video={v} variant="home" />
              ))}
            </div>
          </section>
        ) : null}

        {/* Periódicos (Café com Mercado + Pauta da Semana) */}
        <section className="space-y-6">
          <h2 className="text-2xl font-semibold text-[#132960] md:text-3xl">
            Periódicos
          </h2>

          <div className="space-y-3">
            <div className="flex items-baseline justify-between">
              <h3 className="text-lg font-semibold text-[#132960] md:text-xl">
                Café com Mercado
              </h3>
              <Link
                href="/cafe-com-mercado"
                className="text-sm font-semibold text-[#027DFC] hover:underline"
              >
                Ver arquivo →
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
                      <h4 className="mt-1 text-lg font-semibold text-[#132960] group-hover:text-[#027DFC]">
                        {b.title}
                      </h4>
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
          </div>

          <div className="space-y-3">
            <div className="flex items-baseline justify-between">
              <h3 className="text-lg font-semibold text-[#132960] md:text-xl">
                Pauta da Semana
              </h3>
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
                      <h4 className="mt-1 text-lg font-semibold text-[#132960] group-hover:text-[#027DFC]">
                        {p.title}
                      </h4>
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
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
