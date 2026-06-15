import { prisma } from "@/lib/prisma";
import type { PostCardData } from "@/components/common/PostCard";

const FALLBACK_IMAGE =
  "/capa-padrao.png";

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
    // Data exibida no card = publicação (criação só p/ posts legados sem publishedAt).
    date: new Date(post.publishedAt ?? post.createdAt).toLocaleDateString("pt-BR"),
    image: post.coverImage || FALLBACK_IMAGE,
  };
}
