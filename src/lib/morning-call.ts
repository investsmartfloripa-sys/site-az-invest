import fs from "fs/promises";
import path from "path";
import matter from "gray-matter";

const CONTENT_DIR = path.join(process.cwd(), "content", "morning-call");

export type Briefing = {
  /** Slug da rota e nome do arquivo (sem .md), formato YYYY-MM-DD. */
  date: string;
  /** Ex: "sexta-feira". */
  weekday: string;
  /** Título do briefing (renderizado como H1 da página). */
  title: string;
  /** Carimbo de hora do fechamento. Ex: "10:15 BRT". */
  hora: string;
  /** ISO 8601 com timezone — usado em <time> e OG metadata. */
  publishedAt: string;
  /** Resumo curto para metadata (description, OG). */
  description: string;
  /** Corpo Markdown sem frontmatter e sem o H1. */
  body: string;
};

type BriefingFrontmatter = Partial<
  Pick<Briefing, "date" | "weekday" | "title" | "hora" | "publishedAt" | "description">
>;

/**
 * Lista os slugs de briefings disponíveis em `content/morning-call`,
 * ordenados do mais recente para o mais antigo.
 * Retorna [] se a pasta ainda não existe (primeira execução).
 */
export async function listBriefingDates(): Promise<string[]> {
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

/** Lê um briefing por slug. Retorna null se o arquivo não existir. */
export async function getBriefing(date: string): Promise<Briefing | null> {
  const filePath = path.join(CONTENT_DIR, `${date}.md`);
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = matter(raw);
    const fm = parsed.data as BriefingFrontmatter;
    return {
      date: fm.date ?? date,
      weekday: fm.weekday ?? "",
      title: fm.title ?? `Briefing ${date}`,
      hora: fm.hora ?? "",
      publishedAt: fm.publishedAt ?? "",
      description: fm.description ?? "",
      body: parsed.content.trim(),
    };
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw e;
  }
}

/** Lista os N briefings mais recentes com frontmatter parseado. */
export async function listBriefings(limit?: number): Promise<Briefing[]> {
  const dates = await listBriefingDates();
  const slice = typeof limit === "number" ? dates.slice(0, limit) : dates;
  const all = await Promise.all(slice.map((d) => getBriefing(d)));
  return all.filter((b): b is Briefing => b !== null);
}

const MESES_PT = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

/** "2026-05-29" → "29 de maio de 2026". */
export function formatDateBR(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  if (!y || !m || !d) return date;
  return `${d} de ${MESES_PT[m - 1]} de ${y}`;
}
