import Link from "next/link";
import type { Metadata } from "next";
import { Footer } from "@/components/common/Footer";
import { Header } from "@/components/common/Header";
import { PostCard } from "@/components/common/PostCard";
import { PeriodicosBlock } from "@/components/conteudo/PeriodicosBlock";
import { YoutubeVideoCard } from "@/components/videos/YoutubeVideoCard";
import { findPosts, mapPost } from "@/lib/posts";
import { artigosWhere } from "@/lib/workspace/posts";
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

/** Mesmo sistema de título de seção da home (HeroRecentes): navy com sublinhado curto azure. */
const SECTION_TITLE_CLASSES =
  "text-3xl text-[#132960] after:mt-2 after:block after:h-1 after:w-12 after:rounded-full after:bg-[#027DFC] md:text-4xl";

export const metadata: Metadata = {
  title: "Conteúdo",
  description:
    "Todo o conteúdo do AZ Invest em um só lugar: artigos, vídeos e os periódicos (Café com Mercado diário e os dossiês macro semanal e mensal).",
  alternates: { canonical: "/conteudo" },
  openGraph: { images: ["/opengraph-image.png"],
    title: "Conteúdo | AZ Invest",
    description:
      "Artigos, vídeos e periódicos (Café com Mercado e os dossiês macro) sobre economia, mercado e educação financeira.",
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

  const [posts, videoResult] = await Promise.all([
    findPosts({
      // Só artigos editoriais: os boletins do Publisher ficam no bloco Periódicos.
      where: artigosWhere,
      orderBy: { createdAt: "desc" },
      take: 3,
    }),
    activePlaylist
      ? fetchPlaylistVideos(activePlaylist.playlistId, 50)
      : fetchChannelVideos(30),
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
        {/* Artigos */}
        <section className="space-y-4">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className={SECTION_TITLE_CLASSES}>Artigos</h2>
            <Link
              href="/blog"
              className="whitespace-nowrap text-sm font-semibold text-[#027DFC] hover:underline"
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

        {/* Vídeos com filtros de classificação */}
        <section id="videos" className="scroll-mt-24 space-y-4">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className={SECTION_TITLE_CLASSES}>Vídeos</h2>
            <Link
              href={CHANNEL_URL}
              target="_blank"
              rel="noreferrer"
              className="whitespace-nowrap text-sm font-semibold text-[#027DFC] hover:underline"
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

        {/* Periódicos — Café, dossiês e boletins, cada grupo com seu arquivo */}
        <PeriodicosBlock variant="hub" />
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
