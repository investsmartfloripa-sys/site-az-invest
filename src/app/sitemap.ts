import type { MetadataRoute } from "next";

import { getSiteUrl } from "@/lib/site-url";
import { prisma } from "@/lib/prisma";
import { simuladores } from "@/data/simuladores";

export const dynamic = "force-dynamic";

const STATIC_PATHS: { path: string; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"]; priority: number }[] = [
  { path: "/", changeFrequency: "daily", priority: 1.0 },
  { path: "/blog", changeFrequency: "daily", priority: 0.9 },
  { path: "/painel-economico", changeFrequency: "daily", priority: 0.8 },
  { path: "/painel-economico/panorama", changeFrequency: "daily", priority: 0.7 },
  { path: "/painel-economico/economia", changeFrequency: "daily", priority: 0.7 },
  { path: "/painel-economico/mercado", changeFrequency: "daily", priority: 0.7 },
  { path: "/videos", changeFrequency: "daily", priority: 0.7 },
  { path: "/simuladores", changeFrequency: "monthly", priority: 0.7 },
  { path: "/nosso-time", changeFrequency: "weekly", priority: 0.6 },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteUrl();
  const now = new Date();

  const entries: MetadataRoute.Sitemap = STATIC_PATHS.map((item) => ({
    url: `${siteUrl}${item.path}`,
    lastModified: now,
    changeFrequency: item.changeFrequency,
    priority: item.priority,
  }));

  for (const sim of simuladores) {
    entries.push({
      url: `${siteUrl}/simuladores/${sim.slug}`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.6,
    });
  }

  try {
    const posts = await prisma.post.findMany({
      where: { published: true },
      select: { slug: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
    });
    for (const p of posts) {
      entries.push({
        url: `${siteUrl}/blog/${p.slug}`,
        lastModified: p.updatedAt,
        changeFrequency: "weekly",
        priority: 0.7,
      });
    }
  } catch {
    // banco indisponivel: ainda retornamos as paginas estaticas
  }

  try {
    const authors = await prisma.author.findMany({
      select: { slug: true, updatedAt: true },
    });
    for (const a of authors) {
      entries.push({
        url: `${siteUrl}/nosso-time/${a.slug}`,
        lastModified: a.updatedAt,
        changeFrequency: "monthly",
        priority: 0.5,
      });
    }
  } catch {
    // ignora se banco offline
  }

  return entries;
}
