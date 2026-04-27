import Image from "next/image";
import Link from "next/link";

import { Footer } from "@/components/common/Footer";
import { Header } from "@/components/common/Header";
import { NewsletterForm } from "@/components/home/NewsletterForm";
import {
  fetchChannelVideos,
  fetchPlaylistVideos,
  findPlaylistBySlug,
  KNOWN_PLAYLISTS,
} from "@/lib/youtube";

export const metadata = {
  title: "Videos | AZ Invest",
  description:
    "Acompanhe as analises e tutoriais em video da equipe AZ Invest sobre economia, mercado e investimentos.",
};

export const revalidate = 3600;

const CHANNEL_URL = "https://www.youtube.com/@azinvestoficial";

type VideosPageProps = {
  searchParams: Promise<{ p?: string }>;
};

export default async function VideosPage({ searchParams }: VideosPageProps) {
  const { p: playlistSlug } = await searchParams;
  const activePlaylist = findPlaylistBySlug(playlistSlug);

  const result = activePlaylist
    ? await fetchPlaylistVideos(activePlaylist.playlistId, 24)
    : await fetchChannelVideos(24);

  const { videos, source, error } = result;

  return (
    <div className="min-h-screen text-[#132960]">
      <Header />
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-8 md:px-8">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#027DFC]">
              Conteudo em video
            </p>
            <h1 className="text-4xl text-[#027DFC] md:text-5xl">Videos</h1>
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
          <PlaylistTab href="/videos" label="Recentes" active={!activePlaylist} />
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
          <p className="text-sm text-zinc-500">Nenhum video encontrado nesta playlist.</p>
        ) : (
          <section className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {videos.map((video) => (
              <article
                key={video.id}
                className="group overflow-hidden rounded-2xl border border-[#132960]/15 bg-white transition hover:border-[#027DFC]/60 hover:shadow-md"
              >
                <Link
                  href={`https://www.youtube.com/watch?v=${video.youtubeId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="relative block aspect-video w-full overflow-hidden bg-zinc-100"
                >
                  {video.thumbnail ? (
                    <Image
                      src={video.thumbnail}
                      alt={video.title}
                      fill
                      sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
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
                </Link>
                <div className="space-y-2 p-4">
                  <h3 className="line-clamp-2 text-base font-semibold text-[#132960]">
                    {video.title}
                  </h3>
                  {video.description ? (
                    <p className="line-clamp-2 text-sm text-zinc-600">
                      {video.description}
                    </p>
                  ) : null}
                  <div className="text-xs text-zinc-500">
                    {new Date(video.publishedAt).toLocaleDateString("pt-BR", {
                      day: "2-digit",
                      month: "long",
                      year: "numeric",
                    })}
                  </div>
                </div>
              </article>
            ))}
          </section>
        )}

        <NewsletterForm />
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
