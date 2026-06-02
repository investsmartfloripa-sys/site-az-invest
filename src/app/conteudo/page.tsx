import Link from "next/link";
import type { Metadata } from "next";
import { Footer } from "@/components/common/Footer";
import { Header } from "@/components/common/Header";
import { PostCard } from "@/components/common/PostCard";
import { YoutubeVideoCard } from "@/components/videos/YoutubeVideoCard";
import { formatDateBR, listBriefings } from "@/lib/cafe-com-mercado";
import { listPautas } from "@/lib/pauta-da-semana";
import { findPosts, mapPost } from "@/lib/posts";
import {
  fetchChannelVideos,
  fetchPlaylistVideos,
  findPlaylistBySlug,
  isLong,
  isShort,
  KNOWN_PLAYLISTS,
  type YoutubeVideo,
} from "@/lib/youtube";

export const dynamic = "force-dynamic";

const CHANNEL_URL = "https://www.youtube.com/@azinvestoficial";

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

type ConteudoProps = {
  searchParams: Promise<{ vp?: string; vt?: string }>;
};

export default async function ConteudoHub({ searchParams }: ConteudoProps) {
  const { vp, vt } = await searchParams;
  const activePlaylist = findPlaylistBySlug(vp);
  const activeType = vt === "shorts" || vt === "long" ? vt : undefined;

  const [posts, videoResult, cafes, pautas] = await Promise.all([
    findPosts({
      where: { published: true },
      orderBy: { createdAt: "desc" },
      take: 3,
    }),
    activePlaylist
      ? fetchPlaylistVideos(activePlaylist.playlistId, 50)
      : fetchChannelVideos(30),
    listBriefings(3),
    listPautas(3),
  ]);
  const mappedPosts = posts.map(mapPost);

  let vids: YoutubeVideo[] = videoResult.videos;
  if (activeType === "shorts") vids = vids.filter(isShort);
  else if (activeType === "long") vids = vids.filter(isLong);
  const videoLimit = activePlaylist || activeType ? 12 : 3;
  const videos = vids.slice(0, videoLimit);
  const isShortsView = activeType === "shorts";

  return (
    <div className="min-h-screen text-[#132960]">
      <Header />
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-4 py-8 md:px-8">
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

        <section id="videos" className="scroll-mt-24 space-y-4">
          <div className="flex items-baseline justify-between">
            <h2 className="text-2xl font-semibold text-[#132960] md:text-3xl">
              Vídeos
            </h2>
            <Link
              href={CHANNEL_URL}
              target="_blank"
              rel="noreferrer"
              className="text-sm font-semibold text-[#027DFC] hover:underline"
            >
              Ver no canal ↗
            </Link>
          </div>

          <nav className="flex flex-wrap gap-2 border-b border-[#132960]/10 pb-2">
            <VideoTab href="/conteudo#videos" label="Recentes" active={!activePlaylist && !activeType} />
            <VideoTab href="/conteudo?vt=long#videos" label="Vídeos longos" active={!activePlaylist && activeType === "long"} />
            <VideoTab href="/conteudo?vt=shorts#videos" label="Shorts" active={!activePlaylist && activeType === "shorts"} />
            {KNOWN_PLAYLISTS.map((p) => (
              <VideoTab
                key={p.slug}
                href={`/conteudo?vp=${p.slug}#videos`}
                label={p.label}
                active={activePlaylist?.slug === p.slug}
              />
            ))}
          </nav>

          {videos.length === 0 ? (
            <p className="text-sm text-zinc-500">Nenhum vídeo encontrado neste filtro.</p>
          ) : (
            <div
              className={
                isShortsView
                  ? "grid grid-cols-2 gap-4 sm:grid-cols-4"
                  : "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
              }
            >
              {videos.map((v) => (
                <YoutubeVideoCard key={v.id} video={v} variant="home" vertical={isShortsView} />
              ))}
            </div>
          )}
        </section>

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

function VideoTab({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={
        "rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide transition " +
        (active
          ? "bg-[#132960] text-white"
          : "border border-[#132960]/20 text-[#132960] hover:border-[#027DFC] hover:text-[#027DFC]")
      }
    >
      {label}
    </Link>
  );
}
