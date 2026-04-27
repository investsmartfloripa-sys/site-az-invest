import { videos as fallbackVideos } from "@/data/videos";

export type YoutubeVideo = {
  id: string;
  youtubeId: string;
  title: string;
  description: string;
  thumbnail: string;
  publishedAt: string;
  duration?: string;
};

type SearchItem = {
  id: { kind: string; videoId?: string };
  snippet: {
    publishedAt: string;
    title: string;
    description: string;
    thumbnails: {
      default?: { url: string };
      medium?: { url: string };
      high?: { url: string };
      standard?: { url: string };
      maxres?: { url: string };
    };
  };
};

type SearchResponse = {
  items?: SearchItem[];
  error?: { message?: string };
};

type VideosItem = {
  id: string;
  contentDetails?: { duration?: string };
};

type VideosResponse = {
  items?: VideosItem[];
};

const SEARCH_ENDPOINT = "https://www.googleapis.com/youtube/v3/search";
const VIDEOS_ENDPOINT = "https://www.googleapis.com/youtube/v3/videos";
const REVALIDATE_SECONDS = 60 * 60; // 1h

function decode(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function formatIsoDuration(iso?: string): string | undefined {
  if (!iso) return undefined;
  const match = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso);
  if (!match) return undefined;
  const h = Number(match[1] ?? 0);
  const m = Number(match[2] ?? 0);
  const s = Number(match[3] ?? 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  if (h > 0) return `${h}:${pad(m)}:${pad(s)}`;
  return `${m}:${pad(s)}`;
}

function pickThumb(item: SearchItem): string {
  const t = item.snippet.thumbnails;
  return (
    t.maxres?.url ?? t.standard?.url ?? t.high?.url ?? t.medium?.url ?? t.default?.url ?? ""
  );
}

function toFallback(): YoutubeVideo[] {
  return fallbackVideos.map((v) => ({
    id: v.id,
    youtubeId: v.youtubeId,
    title: v.title,
    description: v.description,
    thumbnail: `https://i.ytimg.com/vi/${v.youtubeId}/hqdefault.jpg`,
    publishedAt: v.publishedAt,
    duration: v.duration,
  }));
}

export async function fetchChannelVideos(maxResults = 12): Promise<{
  videos: YoutubeVideo[];
  source: "youtube" | "fallback";
  error?: string;
}> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  const channelId = process.env.YOUTUBE_CHANNEL_ID;

  if (!apiKey || !channelId) {
    return {
      videos: toFallback(),
      source: "fallback",
      error: "YOUTUBE_API_KEY ou YOUTUBE_CHANNEL_ID nao configurados",
    };
  }

  try {
    const searchUrl = new URL(SEARCH_ENDPOINT);
    searchUrl.searchParams.set("key", apiKey);
    searchUrl.searchParams.set("channelId", channelId);
    searchUrl.searchParams.set("part", "snippet");
    searchUrl.searchParams.set("order", "date");
    searchUrl.searchParams.set("type", "video");
    searchUrl.searchParams.set("maxResults", String(Math.min(maxResults, 50)));

    const searchRes = await fetch(searchUrl.toString(), {
      next: { revalidate: REVALIDATE_SECONDS },
    });

    if (!searchRes.ok) {
      const body = (await searchRes.json().catch(() => ({}))) as SearchResponse;
      return {
        videos: toFallback(),
        source: "fallback",
        error:
          body.error?.message ??
          `YouTube search retornou ${searchRes.status}`,
      };
    }

    const search = (await searchRes.json()) as SearchResponse;
    const items = (search.items ?? []).filter(
      (i): i is SearchItem & { id: { videoId: string } } =>
        i.id.kind === "youtube#video" && Boolean(i.id.videoId),
    );

    if (items.length === 0) {
      return {
        videos: toFallback(),
        source: "fallback",
        error: "Nenhum video retornado pelo canal",
      };
    }

    let durationsById = new Map<string, string | undefined>();
    try {
      const ids = items.map((i) => i.id.videoId).join(",");
      const videosUrl = new URL(VIDEOS_ENDPOINT);
      videosUrl.searchParams.set("key", apiKey);
      videosUrl.searchParams.set("part", "contentDetails");
      videosUrl.searchParams.set("id", ids);

      const videosRes = await fetch(videosUrl.toString(), {
        next: { revalidate: REVALIDATE_SECONDS },
      });

      if (videosRes.ok) {
        const v = (await videosRes.json()) as VideosResponse;
        durationsById = new Map(
          (v.items ?? []).map((it) => [
            it.id,
            formatIsoDuration(it.contentDetails?.duration),
          ]),
        );
      }
    } catch {
      // duracao e opcional, segue sem
    }

    const videos: YoutubeVideo[] = items.map((item) => ({
      id: item.id.videoId,
      youtubeId: item.id.videoId,
      title: decode(item.snippet.title),
      description: decode(item.snippet.description),
      thumbnail: pickThumb(item),
      publishedAt: item.snippet.publishedAt,
      duration: durationsById.get(item.id.videoId),
    }));

    return { videos, source: "youtube" };
  } catch (err) {
    return {
      videos: toFallback(),
      source: "fallback",
      error: err instanceof Error ? err.message : "Erro desconhecido",
    };
  }
}
