import type { SessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { authorScopeWhere, canEditPost } from "@/lib/workspace/permissions";

export async function listPostsForSession(session: SessionUser) {
  return prisma.post.findMany({
    where: authorScopeWhere(session),
    include: { author: true },
    orderBy: { updatedAt: "desc" },
  });
}

export async function getPostForSession(session: SessionUser, id: number) {
  const post = await prisma.post.findUnique({
    where: { id },
    include: { author: true },
  });
  if (!post || !canEditPost(session, post)) return null;
  return post;
}
