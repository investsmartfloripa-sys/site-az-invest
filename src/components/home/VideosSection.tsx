import Link from "next/link";

import { VideosShowcase } from "@/components/home/VideosShowcase";
import { YoutubeVideoCard } from "@/components/videos/YoutubeVideoCard";
import { fetchChannelVideos, isShort } from "@/lib/youtube";

export async function VideosSection() {
  const { videos } = await fetchChannelVideos(30);

  if (videos.length === 0) return null;

  const longs = videos.filter((v) => !isShort(v));
  const shorts = videos.filter(isShort);
  // Cinco vídeos: a lista lateral do showcase cabe inteira, sem scroll dentro do scroll.
  const showcaseVideos = (longs.length > 0 ? longs : videos).slice(0, 5);

  return (
    <section className="az-reveal space-y-6">
      <div className="flex items-baseline justify-between gap-3">
        {/* Mesmo sistema do título "Artigos": navy + sublinhado curto azure. */}
        <h2 className="text-3xl text-[#132960] after:mt-2 after:block after:h-1 after:w-12 after:rounded-full after:bg-[#027DFC] md:text-4xl">
          Vídeos
        </h2>
        <Link href="/conteudo#videos" className="whitespace-nowrap text-sm font-semibold text-[#027DFC] hover:underline">
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
              className="whitespace-nowrap text-sm font-semibold text-[#027DFC] hover:underline"
            >
              Ver todos
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {shorts.slice(0, 4).map((video) => (
              <YoutubeVideoCard key={video.id} video={video} vertical variant="home" />
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
