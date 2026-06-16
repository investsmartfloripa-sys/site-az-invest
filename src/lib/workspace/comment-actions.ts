"use server";

import { revalidatePath } from "next/cache";
import { isStaffOrAdmin, requireSession, type SessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/workspace/audit";

/**
 * Quem pode moderar (responder/excluir) comentários de um post:
 * STAFF/ADMIN em qualquer post; AUTHOR apenas nos próprios textos.
 */
function canModeratePost(session: SessionUser, postAuthorId: number | null) {
  if (isStaffOrAdmin(session.role)) return true;
  return (
    session.role === "AUTHOR" &&
    session.authorId != null &&
    postAuthorId === session.authorId
  );
}

async function loadComment(commentId: number) {
  return prisma.postComment.findUnique({
    where: { id: commentId },
    select: {
      id: true,
      postId: true,
      parentId: true,
      post: { select: { slug: true, authorId: true } },
    },
  });
}

function revalidateComment(slug: string) {
  revalidatePath(`/blog/${slug}`);
  revalidatePath("/area-restrita/comentarios");
  revalidatePath("/area-restrita/dashboard");
}

/**
 * Responde a um comentário do leitor. A resposta é um PostComment filho
 * (parentId = comentário do leitor), marcado como isStaffReply para o blog
 * exibi-la como resposta oficial da AZ Invest.
 */
export async function replyToCommentAction(formData: FormData) {
  const session = await requireSession();
  const commentId = Number(formData.get("commentId"));
  const content = String(formData.get("content") ?? "").trim().slice(0, 2000);

  if (!Number.isInteger(commentId) || commentId <= 0 || content.length < 2) return;

  const comment = await loadComment(commentId);
  // Só responde a comentário de leitor de 1º nível (não a outra resposta).
  if (!comment || comment.parentId !== null) return;
  if (!canModeratePost(session, comment.post.authorId)) return;

  // Nome de exibição: o autor assina com o nome do perfil público (Author.name)
  // para o leitor ver que foi o próprio autor; equipe/admin assina como a marca.
  let displayName = "Equipe AZ Invest";
  if (session.authorId) {
    const author = await prisma.author.findUnique({
      where: { id: session.authorId },
      select: { name: true },
    });
    if (author?.name) displayName = author.name;
  }

  await prisma.postComment.create({
    data: {
      postId: comment.postId,
      parentId: comment.id,
      name: displayName,
      content,
      isStaffReply: true,
      repliedById: session.userId,
    },
  });

  await writeAuditLog({
    userId: session.userId,
    action: "comment.reply",
    entity: "PostComment",
    entityId: comment.id,
  });

  revalidateComment(comment.post.slug);
}

/**
 * Exclui um comentário (e, em cascata, suas respostas). Usado contra spam/ofensa.
 */
export async function deleteCommentAction(formData: FormData) {
  const session = await requireSession();
  const commentId = Number(formData.get("commentId"));
  if (!Number.isInteger(commentId) || commentId <= 0) return;

  const comment = await loadComment(commentId);
  if (!comment) return;
  if (!canModeratePost(session, comment.post.authorId)) return;

  await prisma.postComment.delete({ where: { id: comment.id } });

  await writeAuditLog({
    userId: session.userId,
    action: "comment.delete",
    entity: "PostComment",
    entityId: comment.id,
  });

  revalidateComment(comment.post.slug);
}
