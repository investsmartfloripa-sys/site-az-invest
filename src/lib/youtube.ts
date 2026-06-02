import { videos as fallbackVideos } from "@/data/videos";

export type YoutubeVideo = {
  id: string;
  youtubeId: string;
  title: string;
  description: string;
  thumbnail: string;
  publishedAt: string;
  duration?: string;
  durationSeconds?: number;
};

// Limite oficial atual de duracao de YouTube Shorts (3 min, vigente desde 2024).
// Heuristica: a Data API nao retorna se um video e Short, entao usamos a duracao
// como proxy. Pode haver falso-positivo (video tradicional curto), mas captura 100%
// dos Shorts reais.
export const SHORT_MAX_SECONDS = 180;

export function isShort(video: YoutubeVideo): boolean {
  return typeof video.durationSeconds === "number" && video.durationSeconds <= SHORT_MAX_SECONDS;
}

export function isLong(video: YoutubeVideo): boolean {
  return typeof video.durationSeconds === "number" && video.durationSeconds > SHORT_MAX_SECONDS;
}

// Exclui transmissoes "AO VIVO" das listagens — elas duplicam o VOD limpo. Temporario.
const LIVE_TITLE_RE = /ao\s*vivo/i;

export type PlaylistInfo = {
  slug: string;
  label: string;
  playlistId: string;
};

export const KNOWN_PLAYLISTS: PlaylistInfo[] = [
  { slug: "fala-borba", label: "Fala Borba", playlistId: "PLqqJv6H5mqgoTCbMXIaqXsrSjOhFK0eP-" },
  { slug: "macros", label: "Macros", playlistId: "PLqqJv6H5mqgrbxOAHFW2XYkQ22Wr0PL8A" },
  { slug: "educacional", label: "Educacional", playlistId: "PLqqJv6H5mqgqjRjmP6ZmGNZU-apNKlsg4" },
  { slug: "az-cast", label: "AZ Cast", playlistId: "PLqqJv6H5mqgqJfd7r4ZLJXvDGPwS0X0rF" },
  { slug: "rende-mais", label: "Rende +", playlistId: "PLqqJv6H5mqgoSNQQg92U_YTf3FiypN2jA" },
  { slug: "economista-reage", label: "Economista Reage", playlistId: "PLqqJv6H5mqgpkcMTf_ZWtU5ldTv14VE4T" },
];

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

function parseIsoDurationSeconds(iso?: string): number | undefined {
  if (!iso) return undefined;
  const match = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso);
  if (!match) return undefined;
  const h = Number(match[1] ?? 0);
  const m = Number(match[2] ?? 0);
  const s = Number(match[3] ?? 0);
  return h * 3600 + m * 60 + s;
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

    type DurationEntry = { formatted?: string; seconds?: number };
    let durationsById = new Map<string, DurationEntry>();
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
            {
              formatted: formatIsoDuration(it.contentDetails?.duration),
              seconds: parseIsoDurationSeconds(it.contentDetails?.duration),
            },
          ]),
        );
      }
    } catch {
      // duracao e opcional, segue sem
    }

    const videos: YoutubeVideo[] = items.map((item) => {
      const d = durationsById.get(item.id.videoId);
      return {
        id: item.id.videoId,
        youtubeId: item.id.videoId,
        title: decode(item.snippet.title),
        description: decode(item.snippet.description),
        thumbnail: pickThumb(item),
        publishedAt: item.snippet.publishedAt,
        duration: d?.formatted,
        durationSeconds: d?.seconds,
      };
    });

    return { videos: videos.filter((v) => !LIVE_TITLE_RE.test(v.title)), source: "youtube" };
  } catch (err) {
    return {
      videos: toFallback(),
      source: "fallback",
      error: err instanceof Error ? err.message : "Erro desconhecido",
    };
  }
}

type PlaylistItemSnippet = {
  publishedAt: string;
  title: string;
  description: string;
  thumbnails: SearchItem["snippet"]["thumbnails"];
  resourceId?: { kind: string; videoId?: string };
};

type PlaylistItem = {
  snippet: PlaylistItemSnippet;
};

type PlaylistItemsResponse = {
  items?: PlaylistItem[];
  error?: { message?: string };
};

function pickThumbFromMap(t: SearchItem["snippet"]["thumbnails"]): string {
  return (
    t.maxres?.url ?? t.standard?.url ?? t.high?.url ?? t.medium?.url ?? t.default?.url ?? ""
  );
}

export async function fetchPlaylistVideos(
  playlistId: string,
  maxResults = 12,
): Promise<{ videos: YoutubeVideo[]; source: "youtube" | "fallback"; error?: string }> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey || !playlistId) {
    return {
      videos: toFallback(),
      source: "fallback",
      error: "API key ou playlist nao configurada",
    };
  }

  try {
    const url = new URL("https://www.googleapis.com/youtube/v3/playlistItems");
    url.searchParams.set("key", apiKey);
    url.searchParams.set("playlistId", playlistId);
    url.searchParams.set("part", "snippet");
    url.searchParams.set("maxResults", String(Math.min(maxResults, 50)));

    const res = await fetch(url.toString(), { next: { revalidate: REVALIDATE_SECONDS } });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as PlaylistItemsResponse;
      return {
        videos: toFallback(),
        source: "fallback",
        error: body.error?.message ?? `playlistItems retornou ${res.status}`,
      };
    }

    const data = (await res.json()) as PlaylistItemsResponse;
    const items = (data.items ?? [])
      .filter((i): i is PlaylistItem & { snippet: PlaylistItemSnippet & { resourceId: { videoId: string } } } => {
        return i.snippet.resourceId?.kind === "youtube#video" && Boolean(i.snippet.resourceId?.videoId);
      });

    if (items.length === 0) {
      return { videos: [], source: "youtube" };
    }

    type DurationEntry = { formatted?: string; seconds?: number };
    let durationsById = new Map<string, DurationEntry>();
    try {
      const ids = items.map((i) => i.snippet.resourceId.videoId).join(",");
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
            {
              formatted: formatIsoDuration(it.contentDetails?.duration),
              seconds: parseIsoDurationSeconds(it.contentDetails?.duration),
            },
          ]),
        );
      }
    } catch {
      // duracao opcional
    }

    const videos: YoutubeVideo[] = items.map((it) => {
      const d = durationsById.get(it.snippet.resourceId.videoId);
      return {
        id: it.snippet.resourceId.videoId,
        youtubeId: it.snippet.resourceId.videoId,
        title: decode(it.snippet.title),
        description: decode(it.snippet.description),
        thumbnail: pickThumbFromMap(it.snippet.thumbnails),
        publishedAt: it.snippet.publishedAt,
        duration: d?.formatted,
        durationSeconds: d?.seconds,
      };
    });

    return { videos: videos.filter((v) => !LIVE_TITLE_RE.test(v.title)), source: "youtube" };
  } catch (err) {
    return {
      videos: toFallback(),
      source: "fallback",
      error: err instanceof Error ? err.message : "Erro desconhecido",
    };
  }
}

export function findPlaylistBySlug(slug: string | undefined): PlaylistInfo | undefined {
  if (!slug) return undefined;
  return KNOWN_PLAYLISTS.find((p) => p.slug === slug);
}
