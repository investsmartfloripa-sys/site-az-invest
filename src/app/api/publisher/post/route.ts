import { createHash, timingSafeEqual } from "node:crypto";

import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { blogPostCategoryLabels } from "@/data/blog-categories";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slugify";
import { writeAuditLog } from "@/lib/workspace/audit";
import { preparePostContent } from "@/lib/workspace/html-content";
import { getSiteUrl } from "@/lib/site-url";

/**
 * Porta de escrita do Publisher (robô de releases macro) no blog.
 *
 * POST autenticado por `Authorization: Bearer ${AGENT_API_TOKEN}` — mesmo
 * padrão decidido no BRIEFING-INTEGRACAO-AGENTE-NOTICIAS (uma credencial para
 * as pistas de agente). O post nasce PUBLICADO (APPROVED + published), com
 * autor resolvido por slug — decisão do produto: blog automático, WhatsApp
 * com aprovação humana (o envio é outro passo, fora desta rota).
 *
 * Idempotente por slug: repetir a chamada com o mesmo slug NÃO duplica —
 * retorna o post existente com `already: true` (o robô pode re-rodar sem medo).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PublisherPostBody = {
  /** Slug estável, ex.: "ipca-2026-06". A rota NÃO sufixa: é a chave de idempotência. */
  slug: string;
  title: string;
  excerpt?: string;
  /** HTML do corpo (será sanitizado; markdown derivado p/ o campo content). */
  contentHtml: string;
  /** Categoria do blog — precisa existir em blogPostCategoryLabels. */
  category?: string;
  /** Slug do autor assinante (ex.: "arthur-borba"). */
  authorSlug: string;
  /** URL pública da imagem de capa (PNG do release no Blob). */
  coverImage?: string;
  /** Metadados de auditoria (indicador, mes_referencia, run...). */
  meta?: Record<string, unknown>;
  /**
   * true = se o slug já existir, ATUALIZA título/excerpt/corpo/capa em vez de
   * retornar `already`. Uso excepcional (correção de release publicado) —
   * a doutrina exige instrução explícita do usuário para reescrever post no ar.
   */
  overwrite?: boolean;
};

function tokenOk(header: string | null): boolean {
  const expected = process.env.AGENT_API_TOKEN?.trim();
  if (!expected || !header?.startsWith("Bearer ")) return false;
  const got = header.slice("Bearer ".length).trim();
  // Comparação em tempo constante sobre hashes (evita vazar tamanho).
  const a = createHash("sha256").update(got).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  if (!tokenOk(req.headers.get("authorization"))) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let body: PublisherPostBody;
  try {
    body = (await req.json()) as PublisherPostBody;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid-json" }, { status: 400 });
  }

  const title = body.title?.trim();
  const contentHtml = body.contentHtml?.trim();
  const authorSlug = body.authorSlug?.trim();
  const rawSlug = body.slug?.trim();
  if (!title || !contentHtml || !authorSlug || !rawSlug) {
    return NextResponse.json(
      { ok: false, error: "missing-fields", required: ["slug", "title", "contentHtml", "authorSlug"] },
      { status: 422 },
    );
  }

  const category = body.category?.trim() || "Economia";
  if (!blogPostCategoryLabels.includes(category)) {
    return NextResponse.json(
      { ok: false, error: "invalid-category", allowed: blogPostCategoryLabels },
      { status: 422 },
    );
  }

  const author = await prisma.author.findUnique({ where: { slug: authorSlug } });
  if (!author) {
    return NextResponse.json({ ok: false, error: "author-not-found", authorSlug }, { status: 422 });
  }

  const slug = slugify(rawSlug);
  const siteUrl = getSiteUrl();

  const existing = await prisma.post.findUnique({ where: { slug } });
  if (existing && !body.overwrite) {
    return NextResponse.json({
      ok: true,
      already: true,
      id: existing.id,
      slug: existing.slug,
      url: `${siteUrl}/blog/${existing.slug}`,
    });
  }

  const { content, contentHtml: cleanHtml } = preparePostContent(contentHtml);
  if (!content.trim()) {
    return NextResponse.json({ ok: false, error: "empty-content-after-sanitize" }, { status: 422 });
  }

  if (existing) {
    const updated = await prisma.post.update({
      where: { id: existing.id },
      data: {
        title,
        category,
        excerpt: body.excerpt?.trim() || null,
        content,
        contentHtml: cleanHtml,
        coverImage: body.coverImage?.trim() || existing.coverImage,
      },
    });
    await writeAuditLog({
      action: "post.publisher_update",
      entity: "Post",
      entityId: updated.id,
      meta: { source: "publisher", authorSlug, category, ...(body.meta ?? {}) },
    });
    revalidatePath("/");
    revalidatePath("/blog");
    revalidatePath(`/blog/${updated.slug}`);
    return NextResponse.json({
      ok: true,
      already: false,
      updated: true,
      id: updated.id,
      slug: updated.slug,
      url: `${siteUrl}/blog/${updated.slug}`,
    });
  }

  const now = new Date();
  const created = await prisma.post.create({
    data: {
      title,
      slug,
      category,
      excerpt: body.excerpt?.trim() || null,
      content,
      contentHtml: cleanHtml,
      coverImage: body.coverImage?.trim() || null,
      authorId: author.id,
      authorName: author.name,
      status: "APPROVED",
      published: true,
      publishedAt: now,
      submittedAt: now,
      reviewedAt: now,
    },
  });

  await writeAuditLog({
    action: "post.publisher_create",
    entity: "Post",
    entityId: created.id,
    meta: { source: "publisher", authorSlug, category, ...(body.meta ?? {}) },
  });

  revalidatePath("/");
  revalidatePath("/blog");
  revalidatePath(`/blog/${created.slug}`);
  revalidatePath("/conteudo");

  return NextResponse.json({
    ok: true,
    already: false,
    id: created.id,
    slug: created.slug,
    url: `${siteUrl}/blog/${created.slug}`,
  });
}
