import Link from "next/link";

import { Footer } from "@/components/common/Footer";
import { Header } from "@/components/common/Header";
import { CommunityCallout } from "@/components/home/CommunityCallout";
import { YoutubeVideoCard } from "@/components/videos/YoutubeVideoCard";
import {
  fetchChannelVideos,
  fetchPlaylistVideos,
  findPlaylistBySlug,
  isLong,
  isShort,
  KNOWN_PLAYLISTS,
  type YoutubeVideo,
} from "@/lib/youtube";
import { SITE_MAIN_MAX_WIDTH_CLASS } from "@/lib/site-layout";

export const metadata = {
  title: "Videos | AZ Invest",
  description:
    "Acompanhe as analises e tutoriais em video da equipe AZ Invest sobre economia, mercado e investimentos.",
};

export const revalidate = 3600;

const CHANNEL_URL = "https://www.youtube.com/@azinvestoficial";

type VideoType = "shorts" | "long";
type VideosPageProps = {
  searchParams: Promise<{ p?: string; t?: string }>;
};

function parseType(t?: string): VideoType | undefined {
  if (t === "shorts" || t === "long") return t;
  return undefined;
}

export default async function VideosPage({ searchParams }: VideosPageProps) {
  const { p: playlistSlug, t: typeParam } = await searchParams;
  const activePlaylist = findPlaylistBySlug(playlistSlug);
  const activeType = parseType(typeParam);

  const fetchSize = activeType ? 50 : 24;
  const result = activePlaylist
    ? await fetchPlaylistVideos(activePlaylist.playlistId, fetchSize)
    : await fetchChannelVideos(fetchSize);

  const { source, error } = result;
  let videos: YoutubeVideo[] = result.videos;

  if (activeType === "shorts") {
    videos = videos.filter(isShort);
  } else if (activeType === "long") {
    videos = videos.filter(isLong);
  }

  videos = videos.slice(0, 24);

  const heading = activeType === "shorts"
    ? "Shorts"
    : activeType === "long"
      ? "Videos longos"
      : activePlaylist?.label ?? "Videos";

  return (
    <div className="min-h-screen text-[#132960]">
      <Header />
      <main
        className={`mx-auto flex w-full ${SITE_MAIN_MAX_WIDTH_CLASS} flex-col gap-10 px-4 py-8 md:px-8`}
      >
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#027DFC]">
              Conteudo em video
            </p>
            <h1 className="text-4xl text-[#027DFC] md:text-5xl">{heading}</h1>
            <p className="max-w-2xl text-sm text-zinc-600">
              Analises, tutoriais e bate-papos com especialistas do nosso time.
              Conteudo puxado diretamente do nosso canal no YouTube.
            </p>
          </div>
          <Link
            href={CHANNEL_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-full bg-[#FF0000] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
          >
            Inscreva-se no canal
          </Link>
        </header>

        <nav className="flex flex-wrap gap-2 border-b border-[#132960]/10 pb-2">
          <PlaylistTab
            href="/videos"
            label="Recentes"
            active={!activePlaylist && !activeType}
          />
          <PlaylistTab
            href="/videos?t=long"
            label="Videos longos"
            active={!activePlaylist && activeType === "long"}
          />
          <PlaylistTab
            href="/videos?t=shorts"
            label="Shorts"
            active={!activePlaylist && activeType === "shorts"}
          />
          {KNOWN_PLAYLISTS.map((p) => (
            <PlaylistTab
              key={p.slug}
              href={`/videos?p=${p.slug}`}
              label={p.label}
              active={activePlaylist?.slug === p.slug}
            />
          ))}
        </nav>

        {source === "fallback" && error ? (
          <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-xs text-amber-900">
            <strong>Modo offline:</strong> exibindo videos de exemplo. ({error})
          </div>
        ) : null}

        {videos.length === 0 ? (
          <p className="text-sm text-zinc-500">
            {activeType === "shorts"
              ? "Nenhum short encontrado nos videos recentes."
              : activeType === "long"
                ? "Nenhum video longo encontrado nos videos recentes."
                : "Nenhum video encontrado nesta playlist."}
          </p>
        ) : (
          <section
            className={
              activeType === "shorts"
                ? "grid gap-5 grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
                : "grid gap-6 md:grid-cols-2 lg:grid-cols-3"
            }
          >
            {videos.map((video) => (
              <YoutubeVideoCard key={video.id} video={video} vertical={activeType === "shorts"} />
            ))}
          </section>
        )}

        <CommunityCallout />
      </main>
      <Footer />
    </div>
  );
}

function PlaylistTab({
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
        "rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-wider transition " +
        (active
          ? "bg-[#132960] text-white"
          : "border border-[#132960]/20 text-[#132960] hover:border-[#027DFC] hover:text-[#027DFC]")
      }
    >
      {label}
    </Link>
  );
}
