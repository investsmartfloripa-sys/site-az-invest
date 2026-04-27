import Image from "next/image";
import Link from "next/link";

import { fetchChannelVideos } from "@/lib/youtube";

export async function VideosSection() {
  const { videos } = await fetchChannelVideos(3);

  if (videos.length === 0) return null;

  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <h2 className="text-4xl text-[#027DFC]">Videos</h2>
        <Link
          href="/videos"
          className="text-xs font-semibold uppercase tracking-wider text-[#132960] underline-offset-4 hover:text-[#027DFC] hover:underline"
        >
          Ver todos
        </Link>
      </div>

      <div className="grid gap-5 md:grid-cols-3">
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
                  sizes="(max-width: 768px) 100vw, 33vw"
                  className="object-cover transition group-hover:scale-105"
                />
              ) : null}
              <span className="absolute inset-0 flex items-center justify-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#FF0000] text-white shadow-lg transition group-hover:scale-110">
                  <svg
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="h-5 w-5 translate-x-0.5"
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
            <div className="space-y-1 p-4">
              <h3 className="line-clamp-2 text-sm font-semibold text-[#132960]">
                {video.title}
              </h3>
              <div className="text-[11px] text-zinc-500">
                {new Date(video.publishedAt).toLocaleDateString("pt-BR", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })}
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
