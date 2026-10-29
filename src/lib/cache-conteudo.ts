import { revalidateTag, unstable_cache } from "next/cache";
import type { PostCardData } from "@/components/common/PostCard";
import { findPosts, mapPost } from "@/lib/posts";
import { prisma } from "@/lib/prisma";
import { artigosWhere, boletinsWhere } from "@/lib/workspace/posts";

/**
 * Cache das consultas ao banco das páginas públicas que renderizam a cada visita
 * (home, /blog, /conteudo, /boletins, /nosso-time e o bloco Periódicos).
 *
 * Renderizar por request consultava o Neon a cada acesso — inclusive de robôs —
 * e o banco quase nunca dormia: em out/2026 a cota de compute do plano estourou
 * e o site ficou dois dias sem artigos (docs/ARMADILHAS.md §1). Agora cada
 * consulta vai ao banco no máximo uma vez a cada REVALIDAR_S, ou logo depois de
 * uma gravação que chame invalidarConteudoPublico().
 *
 * Se o banco falhar quando o cache vence, o unstable_cache devolve o resultado
 * anterior: a página nunca troca uma lista boa por uma vazia. O cache sobrevive
 * a deploys. Só entram valores serializáveis em JSON (datas já como string).
 */

const TAG_CONTEUDO_PUBLICO = "db:conteudo-publico";

/** Rede de segurança para gravação que não passe por invalidarConteudoPublico(). */
const REVALIDAR_S = 6 * 60 * 60;

const OPCOES = { revalidate: REVALIDAR_S, tags: [TAG_CONTEUDO_PUBLICO] };

const ordemPublicacao = [
  { publishedAt: { sort: "desc", nulls: "last" } },
  { createdAt: "desc" },
] as const;

/**
 * Chamar em toda Server Action ou Route Handler que grave Post ou Author
 * (criar, editar, publicar, despublicar, apagar). `expire: 0` é obrigatório:
 * sem ele o próximo visitante ainda recebe a lista antiga.
 */
export function invalidarConteudoPublico() {
  revalidateTag(TAG_CONTEUDO_PUBLICO, { expire: 0 });
}

/** Artigos (sem boletins) do mais recente publicado para o mais antigo. */
export const artigosRecentes = unstable_cache(
  async (take?: number): Promise<PostCardData[]> =>
    (await findPosts({ where: artigosWhere, orderBy: [...ordemPublicacao], take })).map(mapPost),
  ["db", "artigos-recentes"],
  OPCOES,
);

/** Artigos pela data de criação — a ordem que /conteudo sempre usou. */
export const artigosPorCriacao = unstable_cache(
  async (take: number): Promise<PostCardData[]> =>
    (await findPosts({ where: artigosWhere, orderBy: { createdAt: "desc" }, take })).map(mapPost),
  ["db", "artigos-por-criacao"],
  OPCOES,
);

/** Boletins do Publisher (IPCA, IGP-M…), do mais recente para o mais antigo. */
export const boletinsRecentes = unstable_cache(
  async (take?: number): Promise<PostCardData[]> =>
    (await findPosts({ where: boletinsWhere, orderBy: [...ordemPublicacao], take })).map(mapPost),
  ["db", "boletins-recentes"],
  OPCOES,
);

/** Boletins com a data de publicação em ISO, para ordenar junto com os dossiês (Periódicos). */
export const boletinsComData = unstable_cache(
  async (take: number): Promise<{ card: PostCardData; publishedAt: string }[]> =>
    (await findPosts({ where: boletinsWhere, orderBy: [...ordemPublicacao], take })).map((p) => ({
      card: mapPost(p),
      publishedAt: (p.publishedAt ?? p.createdAt).toISOString(),
    })),
  ["db", "boletins-com-data"],
  OPCOES,
);

export type AutorDoTime = {
  id: number;
  slug: string;
  name: string;
  photo: string | null;
  role: string;
  headline: string | null;
  bio: string | null;
  whatsapp: string | null;
  linkedin: string | null;
  instagram: string | null;
  postsPublicados: number;
};

/** Integrantes do time com a contagem de posts publicados de cada um. */
export const autoresDoTime = unstable_cache(
  async (): Promise<AutorDoTime[]> => {
    const autores = await prisma.author.findMany({
      orderBy: { createdAt: "asc" },
      include: { _count: { select: { posts: { where: { status: "APPROVED", published: true } } } } },
    });
    return autores.map((a) => ({
      id: a.id,
      slug: a.slug,
      name: a.name,
      photo: a.photo,
      role: a.role,
      headline: a.headline,
      bio: a.bio,
      whatsapp: a.whatsapp,
      linkedin: a.linkedin,
      instagram: a.instagram,
      postsPublicados: a._count.posts,
    }));
  },
  ["db", "autores-do-time"],
  OPCOES,
);
