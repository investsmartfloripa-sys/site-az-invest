import type { SessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { authorScopeWhere } from "@/lib/workspace/permissions";

export type WorkspaceCommentReply = {
  id: number;
  name: string;
  content: string;
  createdAt: Date;
  /** true quando a resposta foi escrita pelo autor do próprio artigo. */
  authorReply: boolean;
};

export type WorkspaceComment = {
  id: number;
  name: string;
  content: string;
  createdAt: Date;
  post: { id: number; title: string; slug: string };
  replies: WorkspaceCommentReply[];
};

/**
 * Filtro de comentários por escopo do usuário: STAFF/ADMIN veem todos;
 * AUTHOR só vê comentários nos próprios textos (via relação `post`).
 * Considera apenas comentários de leitor de 1º nível (parentId null, não-resposta).
 */
function readerCommentScope(session: SessionUser) {
  return {
    parentId: null,
    isStaffReply: false,
    post: authorScopeWhere(session),
  } as const;
}

export async function listWorkspaceComments(
  session: SessionUser,
  take = 200,
): Promise<WorkspaceComment[]> {
  const rows = await prisma.postComment.findMany({
    where: readerCommentScope(session),
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      name: true,
      content: true,
      createdAt: true,
      post: { select: { id: true, title: true, slug: true, authorId: true } },
      replies: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          name: true,
          content: true,
          createdAt: true,
          repliedBy: { select: { authorId: true } },
        },
      },
    },
  });

  return rows.map((c) => ({
    id: c.id,
    name: c.name,
    content: c.content,
    createdAt: c.createdAt,
    post: { id: c.post.id, title: c.post.title, slug: c.post.slug },
    replies: c.replies.map((r) => ({
      id: r.id,
      name: r.name,
      content: r.content,
      createdAt: r.createdAt,
      authorReply:
        r.repliedBy?.authorId != null && r.repliedBy.authorId === c.post.authorId,
    })),
  }));
}

/** Total de comentários de leitor no escopo (opcionalmente numa janela). */
export function countComments(session: SessionUser, since?: Date) {
  return prisma.postComment.count({
    where: {
      ...readerCommentScope(session),
      ...(since ? { createdAt: { gte: since } } : {}),
    },
  });
}

/** Comentários de leitor ainda sem resposta — pendência acionável. */
export function countUnansweredComments(session: SessionUser) {
  return prisma.postComment.count({
    where: { ...readerCommentScope(session), replies: { none: {} } },
  });
}
