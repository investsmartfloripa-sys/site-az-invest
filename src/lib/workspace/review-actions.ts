"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/workspace/audit";
import { notifyAuthorReviewResult } from "@/lib/workspace/emails";
import { canReviewPosts } from "@/lib/workspace/permissions";
import { syncPublishedFields } from "@/lib/workspace/posts";

export async function approvePostAction(formData: FormData) {
  const session = await requireSession();
  if (!canReviewPosts(session)) redirect("/area-restrita/dashboard");

  const id = Number(formData.get("id"));
  const note = String(formData.get("note") || "").trim();
  if (!Number.isInteger(id)) return;

  const post = await prisma.post.findUnique({
    where: { id },
    include: { author: true },
  });
  if (!post) return;

  const sync = syncPublishedFields("APPROVED");
  await prisma.post.update({
    where: { id },
    data: {
      ...sync,
      reviewedAt: new Date(),
      reviewedById: session.userId,
      reviewNote: note || null,
    },
  });

  await writeAuditLog({
    userId: session.userId,
    action: "post.approve",
    entity: "Post",
    entityId: id,
  });

  if (post.author?.email) {
    await notifyAuthorReviewResult({
      to: post.author.email,
      title: post.title,
      approved: true,
    });
  }

  revalidatePath("/");
  revalidatePath("/blog");
  revalidatePath("/area-restrita/revisao");
  revalidatePath("/area-restrita/conteudo");
}

export async function rejectPostAction(formData: FormData) {
  const session = await requireSession();
  if (!canReviewPosts(session)) redirect("/area-restrita/dashboard");

  const id = Number(formData.get("id"));
  const note = String(formData.get("note") || "").trim();
  if (!Number.isInteger(id) || !note) return;

  const post = await prisma.post.findUnique({
    where: { id },
    include: { author: true },
  });
  if (!post) return;

  await prisma.post.update({
    where: { id },
    data: {
      status: "REJECTED",
      published: false,
      reviewedAt: new Date(),
      reviewedById: session.userId,
      reviewNote: note,
    },
  });

  await writeAuditLog({
    userId: session.userId,
    action: "post.reject",
    entity: "Post",
    entityId: id,
    meta: { note },
  });

  if (post.author?.email) {
    await notifyAuthorReviewResult({
      to: post.author.email,
      title: post.title,
      approved: false,
      note,
    });
  }

  revalidatePath("/area-restrita/revisao");
  revalidatePath("/area-restrita/conteudo");
}
