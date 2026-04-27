import { prisma } from "@/lib/prisma";
import type { PostCardData } from "@/components/common/PostCard";

const FALLBACK_IMAGE =
  "https://investimentosdeaz.com.br/wp-content/uploads/2026/03/Seguros-1024x666.png";

export type PostWithAuthor = Awaited<ReturnType<typeof findPosts>>[number];

export function findPosts(args: Parameters<typeof prisma.post.findMany>[0] = {}) {
  return prisma.post.findMany({
    ...args,
    include: { ...(args?.include ?? {}), author: true },
  });
}

export function mapPost(post: PostWithAuthor): PostCardData {
  return {
    id: post.id,
    title: post.title,
    slug: post.slug,
    category: post.category,
    authorName: post.author?.name ?? post.authorName,
    authorSlug: post.author?.slug ?? null,
    authorPhoto: post.author?.photo ?? null,
    excerpt: post.excerpt,
    date: new Date(post.createdAt).toLocaleDateString("pt-BR"),
    image: post.coverImage || FALLBACK_IMAGE,
  };
}
