import Link from "next/link";

import { YoutubeVideoCard } from "@/components/videos/YoutubeVideoCard";
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
          <YoutubeVideoCard key={video.id} video={video} variant="home" />
        ))}
      </div>
    </section>
  );
}
