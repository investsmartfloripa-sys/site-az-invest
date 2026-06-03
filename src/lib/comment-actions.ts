"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export async function addCommentAction(formData: FormData) {
  const postId = Number(formData.get("postId"));
  const slug = String(formData.get("slug") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim().slice(0, 80);
  const content = String(formData.get("content") ?? "").trim().slice(0, 2000);
  const honeypot = String(formData.get("site") ?? "").trim();

  if (!Number.isInteger(postId) || postId <= 0 || !slug) {
    return;
  }

  if (honeypot || name.length < 2 || content.length < 3) {
    redirect(`/blog/${slug}#comentarios`);
  }

  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { id: true, slug: true, status: true, published: true },
  });

  if (!post || post.slug !== slug || post.status !== "APPROVED" || !post.published) {
    return;
  }

  await prisma.postComment.create({ data: { postId, name, content } });

  revalidatePath(`/blog/${slug}`);
  redirect(`/blog/${slug}#comentarios`);
}
