"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { postPath } from "@/lib/post-path";
import { prisma } from "@/lib/prisma";

/**
 * Para onde voltar depois do comentário. O form manda `returnTo` (= postPath
 * do post: /blog/… ou /boletins/…). Só aceitamos caminho relativo ao site —
 * nada de "//host" nem URL absoluta — para não virar open redirect.
 */
function safeReturnTo(raw: FormDataEntryValue | null): string | null {
  const value = String(raw ?? "").trim();
  return value.startsWith("/") && !value.startsWith("//") ? value : null;
}

/** Fallback sem `returnTo` confiável: a categoria do post decide a rota. */
async function lookupPostPath(postId: number): Promise<string | null> {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { slug: true, category: true },
  });
  return post ? postPath(post) : null;
}

export async function addCommentAction(formData: FormData) {
  const postId = Number(formData.get("postId"));
  const slug = String(formData.get("slug") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim().slice(0, 80);
  const content = String(formData.get("content") ?? "").trim().slice(0, 2000);
  const honeypot = String(formData.get("site") ?? "").trim();
  const returnTo = safeReturnTo(formData.get("returnTo"));

  if (!Number.isInteger(postId) || postId <= 0 || !slug) {
    return;
  }

  if (honeypot || name.length < 2 || content.length < 3) {
    const back = returnTo ?? (await lookupPostPath(postId));
    if (!back) return;
    redirect(`${back}#comentarios`);
  }

  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { id: true, slug: true, category: true, status: true, published: true },
  });

  if (!post || post.slug !== slug || post.status !== "APPROVED" || !post.published) {
    return;
  }

  await prisma.postComment.create({ data: { postId, name, content } });

  // Com o post à mão, o caminho real vem da categoria (artigo ou boletim) —
  // é ele que precisa ser revalidado, não o que veio no form.
  const path = postPath(post);
  revalidatePath(path);
  redirect(`${path}#comentarios`);
}
