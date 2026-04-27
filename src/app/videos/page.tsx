import Image from "next/image";
import Link from "next/link";

import { Footer } from "@/components/common/Footer";
import { Header } from "@/components/common/Header";
import { NewsletterForm } from "@/components/home/NewsletterForm";
import {
  fetchChannelVideos,
  fetchPlaylistVideos,
  findPlaylistBySlug,
  isLong,
  isShort,
  KNOWN_PLAYLISTS,
  type YoutubeVideo,
} from "@/lib/youtube";

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
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-8 md:px-8">
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
              <VideoCard
                key={video.id}
                video={video}
                vertical={activeType === "shorts"}
              />
            ))}
          </section>
        )}

        <NewsletterForm />
      </main>
      <Footer />
    </div>
  );
}

function VideoCard({
  video,
  vertical,
}: {
  video: YoutubeVideo;
  vertical: boolean;
}) {
  const watchUrl = vertical
    ? `https://www.youtube.com/shorts/${video.youtubeId}`
    : `https://www.youtube.com/watch?v=${video.youtubeId}`;

  return (
    <article className="group overflow-hidden rounded-2xl border border-[#132960]/15 bg-white transition hover:border-[#027DFC]/60 hover:shadow-md">
      <Link
        href={watchUrl}
        target="_blank"
        rel="noreferrer"
        className={
          "relative block w-full overflow-hidden bg-zinc-100 " +
          (vertical ? "aspect-[9/16]" : "aspect-video")
        }
      >
        {video.thumbnail ? (
          <Image
            src={video.thumbnail}
            alt={video.title}
            fill
            sizes={
              vertical
                ? "(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
                : "(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
            }
            className="object-cover transition group-hover:scale-105"
          />
        ) : null}
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#FF0000] text-white shadow-lg transition group-hover:scale-110">
            <svg
              viewBox="0 0 24 24"
              fill="currentColor"
              className="h-6 w-6 translate-x-0.5"
              aria-hidden
            >
              <path d="M8 5v14l11-7z" />
            </svg>
          </span>
        </span>
        {video.duration ? (
          <span className="absolute bottom-2 right-2 rounded bg-black/80 px-2 py-0.5 text-[11px] font-semibold text-white">
            {video.duration}
          </span>
        ) : null}
        {vertical ? (
          <span className="absolute left-2 top-2 rounded bg-[#FF0000]/95 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
            Shorts
          </span>
        ) : null}
      </Link>
      <div className="space-y-2 p-4">
        <h3
          className={
            "line-clamp-2 font-semibold text-[#132960] " +
            (vertical ? "text-sm" : "text-base")
          }
        >
          {video.title}
        </h3>
        {!vertical && video.description ? (
          <p className="line-clamp-2 text-sm text-zinc-600">
            {video.description}
          </p>
        ) : null}
        <div className="text-xs text-zinc-500">
          {new Date(video.publishedAt).toLocaleDateString("pt-BR", {
            day: "2-digit",
            month: vertical ? "short" : "long",
            year: "numeric",
          })}
        </div>
      </div>
    </article>
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
