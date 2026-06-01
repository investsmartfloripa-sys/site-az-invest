"use client";

import Image from "next/image";
import { useState } from "react";
import type { YoutubeVideo } from "@/lib/youtube";

function embedUrl(id: string): string {
  const params = new URLSearchParams({
    autoplay: "1",
    rel: "0",
    modestbranding: "1",
    playsinline: "1",
  });
  return `https://www.youtube-nocookie.com/embed/${id}?${params.toString()}`;
}

export function VideosShowcase({ videos }: { videos: YoutubeVideo[] }) {
  const [activeId, setActiveId] = useState(videos[0]?.id);
  const [playing, setPlaying] = useState(false);

  if (videos.length === 0) return null;

  const active = videos.find((v) => v.id === activeId) ?? videos[0];

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-zinc-900">
          {playing ? (
            <iframe
              key={active.id}
              src={embedUrl(active.id)}
              title={active.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              className="h-full w-full"
            />
          ) : (
            <button
              type="button"
              onClick={() => setPlaying(true)}
              className="group relative block h-full w-full text-left"
              aria-label={`Reproduzir: ${active.title}`}
            >
              {active.thumbnail ? (
                <Image
                  src={active.thumbnail}
                  alt={active.title}
                  fill
                  sizes="(max-width: 1024px) 100vw, 66vw"
                  className="object-cover"
                  priority
                />
              ) : null}
              <span className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-black/30" />
              <span className="absolute left-0 top-0 p-5">
                <span className="line-clamp-2 block max-w-[85%] text-lg font-semibold text-white drop-shadow md:text-2xl">
                  {active.title}
                </span>
              </span>
              <span className="absolute inset-0 flex items-center justify-center">
                <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[#FF0000] text-white shadow-lg transition group-hover:scale-110">
                  <svg viewBox="0 0 24 24" fill="currentColor" className="h-7 w-7 translate-x-0.5" aria-hidden>
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </span>
              </span>
              <span className="absolute bottom-4 right-4 text-xs font-semibold text-white/90 drop-shadow">
                Assista no YouTube
              </span>
            </button>
          )}
        </div>
      </div>

      <div className="flex max-h-[420px] flex-col gap-3 overflow-y-auto pr-1 lg:max-h-[480px]">
        {videos.map((v) => {
          const isActive = v.id === active.id;
          return (
            <button
              key={v.id}
              type="button"
              onClick={() => {
                setActiveId(v.id);
                setPlaying(true);
              }}
              className={
                "group flex items-center gap-3 rounded-xl border p-2 text-left transition " +
                (isActive
                  ? "border-[#027DFC] bg-[#027DFC]/5"
                  : "border-[#132960]/10 hover:border-[#027DFC]/50 hover:bg-[#132960]/[0.03]")
              }
            >
              <span className="relative aspect-video w-28 shrink-0 overflow-hidden rounded-lg bg-zinc-200 sm:w-32">
                {v.thumbnail ? (
                  <Image src={v.thumbnail} alt={v.title} fill sizes="128px" className="object-cover" />
                ) : null}
                <span className="absolute inset-0 flex items-center justify-center">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-white">
                    <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5 translate-x-px" aria-hidden>
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </span>
                </span>
              </span>
              <span className="min-w-0 flex-1">
                {isActive ? (
                  <span className="mb-0.5 block text-[10px] font-bold uppercase tracking-wider text-[#027DFC]">
                    Assistindo
                  </span>
                ) : null}
                <span className="line-clamp-2 block text-sm font-medium text-[#132960]">
                  {v.title}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
