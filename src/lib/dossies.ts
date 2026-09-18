import fs from "fs/promises";
import path from "path";
import matter from "gray-matter";

/**
 * Loader dos dossiês macro (mensal e semanal) publicados como Markdown.
 *
 * As pastas `content/dossie-mensal/` e `content/dossie-semanal/` podem não
 * existir ainda: as rotinas que produzem os dossiês hoje entregam HTML local e
 * ainda não publicam no repo. Nesse caso `listDossies` devolve `[]` e o card do
 * bloco Periódicos cai no estado vazio — sem quebrar o build.
 *
 * Quando a rotina passar a publicar, basta gravar o `.md` na pasta com o mesmo
 * frontmatter do Café com Mercado; nenhum componente precisa mudar.
 */

export type DossieTipo = "mensal" | "semanal";

export type Dossie = {
  /** Slug e nome do arquivo, sem `.md`. Ex.: "2026-08" ou "2026-09-11". */
  slug: string;
  tipo: DossieTipo;
  /** Data ISO de referência. Mensal usa o 1º dia do mês de referência. */
  date: string;
  title: string;
  /** Rótulo do período já pronto para exibição. Ex.: "Agosto de 2026". */
  periodo: string;
  description: string;
  publishedAt: string;
  /**
   * Caminho público do artigo. O dossiê é um HTML autocontido (prosa, tabelas e
   * gráficos com os dados embutidos), então é servido direto de `public/` — não
   * há rota de render nem corpo em Markdown. O `.md` existe só para os metadados
   * que alimentam os cards e o sitemap.
   */
  href: string;
};

type Frontmatter = {
  date?: unknown;
  title?: unknown;
  periodo?: unknown;
  description?: unknown;
  publishedAt?: unknown;
};

const DIR: Record<DossieTipo, string> = {
  mensal: "dossie-mensal",
  semanal: "dossie-semanal",
};

function asString(value: unknown, fallback = ""): string {
  if (value == null) return fallback;
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value);
}

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

/** Rótulo de período derivado da data quando o frontmatter não traz `periodo`. */
function periodoPadrao(tipo: DossieTipo, date: string): string {
  const [ano, mes, dia] = date.split("-");
  if (tipo === "mensal") {
    const i = Number(mes) - 1;
    return MESES[i] ? `${MESES[i]} de ${ano}` : date;
  }
  return dia && mes ? `Semana de ${dia}/${mes}` : date;
}

export async function listDossies(
  tipo: DossieTipo,
  limit?: number,
): Promise<Dossie[]> {
  const dir = path.join(process.cwd(), "content", DIR[tipo]);
  let files: string[];
  try {
    files = await fs.readdir(dir);
  } catch {
    // Pasta ainda não existe: nada publicado nesse formato.
    return [];
  }

  const slugs = files
    .filter((f) => f.endsWith(".md"))
    .map((f) => f.replace(/\.md$/, ""))
    .sort()
    .reverse();

  const escolhidos = typeof limit === "number" ? slugs.slice(0, limit) : slugs;

  const lidos = await Promise.all(
    escolhidos.map(async (slug): Promise<Dossie | null> => {
      try {
        const raw = await fs.readFile(path.join(dir, `${slug}.md`), "utf8");
        const { data } = matter(raw);
        const fm = data as Frontmatter;
        const date = asString(fm.date, slug.length === 7 ? `${slug}-01` : slug);
        return {
          slug,
          tipo,
          date,
          title: asString(fm.title, slug),
          periodo: asString(fm.periodo) || periodoPadrao(tipo, date),
          description: asString(fm.description),
          publishedAt: asString(fm.publishedAt, date),
          href: `/dossies/${tipo}/${slug}.html`,
        };
      } catch {
        return null;
      }
    }),
  );

  return lidos.filter((d): d is Dossie => d !== null);
}
