"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slugify";
import { blogPostCategoryLabels } from "@/data/blog-categories";
import { writeAuditLog } from "@/lib/workspace/audit";
import {
  notifyAdminPendingReview,
} from "@/lib/workspace/emails";
import {
  canEditPost,
  canPublishDirectly,
} from "@/lib/workspace/permissions";
import { syncPublishedFields } from "@/lib/workspace/posts";

type PostFormInput = {
  title: string;
  category: string;
  authorId: number | null;
  excerpt: string;
  contentHtml: string;
  coverImage: string;
  slug?: string;
};

async function prepareContent(html: string) {
  const { preparePostContent } = await import("@/lib/workspace/html-content");
  return preparePostContent(html);
}

function parsePostForm(formData: FormData): PostFormInput {
  return {
    title: String(formData.get("title") || "").trim(),
    category: String(formData.get("category") || "").trim(),
    authorId: Number(formData.get("authorId")) || null,
    excerpt: String(formData.get("excerpt") || "").trim(),
    contentHtml: String(formData.get("contentHtml") || "").trim(),
    coverImage: String(formData.get("coverImage") || "").trim(),
    slug: String(formData.get("slug") || "").trim() || undefined,
  };
}

async function resolveAuthorId(session: Awaited<ReturnType<typeof requireSession>>, authorId: number | null) {
  if (session.role === "AUTHOR") {
    if (!session.authorId) throw new Error("Autor sem perfil vinculado");
    return session.authorId;
  }
  if (!authorId) return null;
  const author = await prisma.author.findUnique({ where: { id: authorId } });
  return author?.id ?? null;
}

async function uniqueSlug(base: string, excludeId?: number) {
  let slug = slugify(base) || "post";
  let counter = 1;
  while (true) {
    const existing = await prisma.post.findUnique({ where: { slug } });
    if (!existing || existing.id === excludeId) return slug;
    slug = `${slugify(base)}-${counter}`;
    counter += 1;
  }
}

export async function savePostDraftAction(formData: FormData) {
  const session = await requireSession();
  const input = parsePostForm(formData);
  const id = Number(formData.get("id")) || null;

  if (!input.title || !blogPostCategoryLabels.includes(input.category)) {
    redirect("/area-restrita/conteudo?error=invalid");
  }

  const authorId = await resolveAuthorId(session, input.authorId);
  if (!authorId) redirect("/area-restrita/conteudo?error=author");

  const author = await prisma.author.findUnique({ where: { id: authorId } });
  if (!author) redirect("/area-restrita/conteudo?error=author");

  const { content, contentHtml } = await prepareContent(input.contentHtml || "<p></p>");

  if (id) {
    const post = await prisma.post.findUnique({ where: { id } });
    if (!post || !canEditPost(session, post)) redirect("/area-restrita/conteudo");

    // AUTHOR não edita post publicado (APPROVED): a equipe editorial precisa
    // abrir uma revisão. ADMIN/STAFF seguem editando normalmente.
    if (session.role === "AUTHOR" && post.status === "APPROVED") {
      redirect(`/area-restrita/conteudo/${id}?error=published`);
    }

    // Proteção contra perda de dados em post legado (tem `content` markdown,
    // mas nunca foi salvo pelo editor TipTap — sem contentHtml). O editor abre
    // vazio nesses casos; se o conteúdo enviado for menor que 50% do original,
    // bloqueia o salvamento em vez de sobrescrever o texto.
    const originalContent = post.content.trim();
    const isLegacyPost = !post.contentHtml && originalContent.length > 0;
    if (isLegacyPost && content.length < originalContent.length * 0.5) {
      redirect(`/area-restrita/conteudo/${id}?error=legacy`);
    }

    await prisma.post.update({
      where: { id },
      data: {
        title: input.title,
        slug: input.slug ? await uniqueSlug(input.slug, post.id) : post.slug,
        category: input.category,
        excerpt: input.excerpt || null,
        content,
        contentHtml,
        coverImage: input.coverImage || null,
        authorId,
        authorName: author.name,
        status: post.status === "APPROVED" ? "APPROVED" : "DRAFT",
      },
    });

    await writeAuditLog({
      userId: session.userId,
      action: "post.save_draft",
      entity: "Post",
      entityId: id,
    });
  } else {
    const slug = await uniqueSlug(input.slug || input.title);
    const created = await prisma.post.create({
      data: {
        title: input.title,
        slug,
        category: input.category,
        excerpt: input.excerpt || null,
        content,
        contentHtml,
        coverImage: input.coverImage || null,
        authorId,
        authorName: author.name,
        status: "DRAFT",
        published: false,
      },
    });

    await writeAuditLog({
      userId: session.userId,
      action: "post.create_draft",
      entity: "Post",
      entityId: created.id,
    });

    redirect(`/area-restrita/conteudo/${created.id}`);
  }

  revalidatePath("/area-restrita/conteudo");
  revalidatePath("/blog");
  redirect(`/area-restrita/conteudo/${id}`);
}

export async function submitPostForReviewAction(formData: FormData) {
  const session = await requireSession();
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) return;

  const post = await prisma.post.findUnique({ where: { id }, include: { author: true } });
  if (!post || !canEditPost(session, post)) redirect("/area-restrita/conteudo");

  await prisma.post.update({
    where: { id },
    data: {
      status: "PENDING_REVIEW",
      submittedAt: new Date(),
      published: false,
    },
  });

  await writeAuditLog({
    userId: session.userId,
    action: "post.submit_review",
    entity: "Post",
    entityId: id,
  });

  await notifyAdminPendingReview({
    title: post.title,
    authorName: post.authorName,
  });

  revalidatePath("/area-restrita/revisao");
  revalidatePath("/area-restrita/conteudo");
  redirect("/area-restrita/conteudo?submitted=1");
}

export async function publishPostDirectAction(formData: FormData) {
  const session = await requireSession();
  if (!canPublishDirectly(session)) redirect("/area-restrita/conteudo");

  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) return;

  const post = await prisma.post.findUnique({ where: { id } });
  if (!post || !canEditPost(session, post)) return;

  const sync = syncPublishedFields("APPROVED");
  await prisma.post.update({
    where: { id },
    data: {
      ...sync,
      reviewedAt: new Date(),
      reviewedById: session.userId,
    },
  });

  await writeAuditLog({
    userId: session.userId,
    action: "post.publish_direct",
    entity: "Post",
    entityId: id,
  });

  revalidatePath("/");
  revalidatePath("/blog");
  revalidatePath("/area-restrita/conteudo");
}

export async function deletePostAction(formData: FormData) {
  const session = await requireSession();
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) return;

  const post = await prisma.post.findUnique({ where: { id } });
  if (!post || !canEditPost(session, post)) return;

  await prisma.post.delete({ where: { id } });

  await writeAuditLog({
    userId: session.userId,
    action: "post.delete",
    entity: "Post",
    entityId: id,
  });

  revalidatePath("/");
  revalidatePath("/blog");
  revalidatePath("/area-restrita/conteudo");
  redirect("/area-restrita/conteudo");
}
