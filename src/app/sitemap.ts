import type { MetadataRoute } from "next";

import { getSiteUrl } from "@/lib/site-url";
import { prisma } from "@/lib/prisma";
import { simuladores } from "@/data/simuladores";
import { listBriefings } from "@/lib/cafe-com-mercado";
import { listPautas } from "@/lib/pauta-da-semana";

export const dynamic = "force-dynamic";

const STATIC_PATHS: { path: string; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"]; priority: number }[] = [
  { path: "/", changeFrequency: "daily", priority: 1.0 },
  { path: "/blog", changeFrequency: "daily", priority: 0.9 },
  { path: "/conteudo", changeFrequency: "daily", priority: 0.8 },
  { path: "/cafe-com-mercado", changeFrequency: "daily", priority: 0.7 },
  { path: "/pauta-da-semana", changeFrequency: "weekly", priority: 0.7 },
  { path: "/painel-economico", changeFrequency: "daily", priority: 0.8 },
  { path: "/painel-economico/panorama", changeFrequency: "daily", priority: 0.7 },
  { path: "/painel-economico/economia", changeFrequency: "daily", priority: 0.7 },
  { path: "/painel-economico/mercado", changeFrequency: "daily", priority: 0.7 },
  { path: "/videos", changeFrequency: "daily", priority: 0.7 },
  { path: "/simuladores", changeFrequency: "monthly", priority: 0.7 },
  { path: "/nosso-time", changeFrequency: "weekly", priority: 0.6 },
];

/** Folhas públicas estáticas do painel econômico (sem redirects nem rotas dinâmicas). */
const PAINEL_PATHS: string[] = [
  "/painel-economico/economia/brasil/visao-geral",
  "/painel-economico/economia/brasil/termometro-ciclo",
  "/painel-economico/economia/brasil/atividade",
  "/painel-economico/economia/brasil/atividade/pib",
  "/painel-economico/economia/brasil/atividade/pim",
  "/painel-economico/economia/brasil/atividade/pmc",
  "/painel-economico/economia/brasil/atividade/pms",
  "/painel-economico/economia/brasil/inflacao",
  "/painel-economico/economia/brasil/inflacao/ipca",
  "/painel-economico/economia/brasil/inflacao/igp-m",
  "/painel-economico/economia/brasil/emprego",
  "/painel-economico/economia/brasil/emprego/pnad",
  "/painel-economico/economia/brasil/emprego/caged",
  "/painel-economico/economia/brasil/fiscal",
  "/painel-economico/economia/brasil/fiscal/divida",
  "/painel-economico/economia/brasil/fiscal/receita-e-gastos",
  "/painel-economico/economia/brasil/fiscal/termometro-fiscal",
  "/painel-economico/economia/brasil/contas-externas",
  "/painel-economico/economia/brasil/contas-externas/cambio",
  "/painel-economico/economia/brasil/familias",
  "/painel-economico/mercado/historico",
  "/painel-economico/mercado/fundamentos",
  "/painel-economico/mercado/brasil/renda-fixa",
  "/painel-economico/mercado/brasil/renda-variavel",
  "/painel-economico/mercado/brasil/fundos-imobiliarios",
  "/painel-economico/mercado/global/commodities",
  "/painel-economico/mercado/global/moedas",
  "/painel-economico/mercado/global/indices-globais",
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

  for (const path of PAINEL_PATHS) {
    entries.push({
      url: `${siteUrl}${path}`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.6,
    });
  }

  for (const sim of simuladores) {
    entries.push({
      url: `${siteUrl}/simuladores/${sim.slug}`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.6,
    });
  }

  const safeDate = (value: string | undefined): Date => {
    const dt = value ? new Date(value) : now;
    return Number.isNaN(dt.getTime()) ? now : dt;
  };

  try {
    const briefings = await listBriefings();
    for (const b of briefings) {
      entries.push({
        url: `${siteUrl}/cafe-com-mercado/${b.date}`,
        lastModified: safeDate(b.publishedAt),
        changeFrequency: "monthly",
        priority: 0.5,
      });
    }
  } catch {
    // conteudo local indisponivel: segue sem os briefings
  }

  try {
    const pautas = await listPautas();
    for (const p of pautas) {
      entries.push({
        url: `${siteUrl}/pauta-da-semana/${p.slug}`,
        lastModified: safeDate(p.publishedAt),
        changeFrequency: "monthly",
        priority: 0.5,
      });
    }
  } catch {
    // conteudo local indisponivel: segue sem as pautas
  }

  try {
    const posts = await prisma.post.findMany({
      where: { status: "APPROVED", published: true },
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
