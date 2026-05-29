import fs from "fs/promises";
import path from "path";
import matter from "gray-matter";

const CONTENT_DIR = path.join(process.cwd(), "content", "pauta-da-semana");

export type Pauta = {
  /** Slug da rota e nome do arquivo (sem .md). Ex: "2026-w22" ou "2026-05-25". */
  slug: string;
  /** Data ISO da semana (segunda-feira em geral). Ex: "2026-05-25". */
  date: string;
  /** Título da pauta. */
  title: string;
  /** ISO 8601 com timezone. */
  publishedAt: string;
  /** Resumo curto para metadata e card. */
  description: string;
  /** URL do vídeo no YouTube (embed/share), se houver. */
  videoUrl: string;
  /** Corpo Markdown sem frontmatter. */
  body: string;
};

type PautaFrontmatter = {
  date?: unknown;
  title?: unknown;
  publishedAt?: unknown;
  description?: unknown;
  videoUrl?: unknown;
};

function asString(value: unknown, fallback = ""): string {
  if (value == null) return fallback;
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

export async function listPautaSlugs(): Promise<string[]> {
  try {
    const files = await fs.readdir(CONTENT_DIR);
    return files
      .filter((f) => f.endsWith(".md"))
      .map((f) => f.replace(/\.md$/, ""))
      .sort()
      .reverse();
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw e;
  }
}

export async function getPauta(slug: string): Promise<Pauta | null> {
  const filePath = path.join(CONTENT_DIR, `${slug}.md`);
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = matter(raw);
    const fm = parsed.data as PautaFrontmatter;
    return {
      slug,
      date: asString(fm.date),
      title: asString(fm.title, `Pauta ${slug}`),
      publishedAt: asString(fm.publishedAt),
      description: asString(fm.description),
      videoUrl: asString(fm.videoUrl),
      body: parsed.content.trim(),
    };
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw e;
  }
}

export async function listPautas(limit?: number): Promise<Pauta[]> {
  const slugs = await listPautaSlugs();
  const slice = typeof limit === "number" ? slugs.slice(0, limit) : slugs;
  const all = await Promise.all(slice.map((s) => getPauta(s)));
  return all.filter((p): p is Pauta => p !== null);
}
