import Link from "next/link";

import { VideosShowcase } from "@/components/home/VideosShowcase";
import { YoutubeVideoCard } from "@/components/videos/YoutubeVideoCard";
import { fetchChannelVideos, isShort } from "@/lib/youtube";

export async function VideosSection() {
  const { videos } = await fetchChannelVideos(30);

  if (videos.length === 0) return null;

  const longs = videos.filter((v) => !isShort(v));
  const shorts = videos.filter(isShort);
  const showcaseVideos = (longs.length > 0 ? longs : videos).slice(0, 7);

  return (
    <section className="space-y-6">
      <div className="flex items-end justify-between gap-3">
        <h2 className="text-4xl text-[#027DFC]">Vídeos</h2>
        <Link
          href="/conteudo#videos"
          className="text-xs font-semibold uppercase tracking-wider text-[#132960] underline-offset-4 hover:text-[#027DFC] hover:underline"
        >
          Ver todos
        </Link>
      </div>

      <VideosShowcase videos={showcaseVideos} />

      {shorts.length > 0 ? (
        <div className="space-y-3 pt-2">
          <div className="flex items-end justify-between gap-3">
            <h3 className="text-2xl font-semibold text-[#132960]">Shorts</h3>
            <Link
              href="/conteudo?vt=shorts#videos"
              className="text-xs font-semibold uppercase tracking-wider text-[#132960] underline-offset-4 hover:text-[#027DFC] hover:underline"
            >
              Ver todos
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {shorts.slice(0, 4).map((video) => (
              <YoutubeVideoCard key={video.id} video={video} vertical />
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
