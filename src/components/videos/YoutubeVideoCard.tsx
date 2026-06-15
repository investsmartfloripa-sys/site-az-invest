"use client";

import Image from "next/image";
import { useState } from "react";

import type { YoutubeVideo } from "@/lib/youtube";

type YoutubeVideoCardProps = {
  video: YoutubeVideo;
  vertical?: boolean;
  variant?: "home" | "page";
};

function getEmbedUrl(videoId: string): string {
  const params = new URLSearchParams({
    autoplay: "1",
    rel: "0",
    modestbranding: "1",
    playsinline: "1",
  });
  return `https://www.youtube-nocookie.com/embed/${videoId}?${params.toString()}`;
}

export function YoutubeVideoCard({
  video,
  vertical = false,
  variant = "page",
}: YoutubeVideoCardProps) {
  const [isPlaying, setIsPlaying] = useState(false);

  const imageSizes = vertical
    ? "(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
    : variant === "home"
      ? "(max-width: 768px) 100vw, 33vw"
      : "(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw";

  return (
    <article className="group overflow-hidden rounded-2xl border border-[#132960]/15 bg-white transition hover:border-[#027DFC]/60 hover:shadow-md">
      <div
        className={
          "relative block w-full overflow-hidden bg-zinc-100 " +
          (vertical ? "aspect-[9/16]" : "aspect-video")
        }
      >
        {isPlaying ? (
          <>
            <iframe
              src={getEmbedUrl(video.youtubeId)}
              title={video.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              className="h-full w-full"
            />
            <button
              type="button"
              onClick={() => setIsPlaying(false)}
              className="absolute right-2 top-2 z-10 rounded-full bg-black/70 px-2 py-1 text-xs font-semibold text-white hover:bg-black/85"
            >
              Fechar
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setIsPlaying(true)}
            className="relative block h-full w-full text-left"
            aria-label={`Reproduzir vídeo: ${video.title}`}
          >
            {video.thumbnail ? (
              <Image
                src={video.thumbnail}
                alt={video.title}
                fill
                sizes={imageSizes}
                className="object-cover transition group-hover:scale-105"
              />
            ) : null}
            <span className="absolute inset-0 flex items-center justify-center">
              <span
                className={
                  "flex items-center justify-center rounded-full bg-[#FF0000] text-white shadow-lg transition group-hover:scale-110 " +
                  (variant === "home" ? "h-12 w-12" : "h-14 w-14")
                }
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className={(variant === "home" ? "h-5 w-5 " : "h-6 w-6 ") + "translate-x-0.5"}
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
          </button>
        )}
      </div>

      <div className={variant === "home" ? "space-y-1 p-4" : "space-y-2 p-4"}>
        <h3
          className={
            (variant === "home"
              ? "line-clamp-2 text-sm font-semibold text-[#132960]"
              : "line-clamp-2 font-semibold text-[#132960] " +
                (vertical ? "text-sm" : "text-base"))
          }
        >
          {video.title}
        </h3>
        {variant === "page" && !vertical && video.description ? (
          <p className="line-clamp-2 text-sm text-zinc-600">{video.description}</p>
        ) : null}
        <div className={variant === "home" ? "text-[11px] text-zinc-500" : "text-xs text-zinc-500"}>
          {new Date(video.publishedAt).toLocaleDateString("pt-BR", {
            day: "2-digit",
            month: variant === "home" || vertical ? "short" : "long",
            year: "numeric",
          })}
        </div>
      </div>
    </article>
  );
}
