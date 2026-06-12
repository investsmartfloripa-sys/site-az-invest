import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { PostMarkdownBody } from "@/components/blog/PostMarkdownBody";
import { SubmitButton } from "@/components/workspace/SubmitButton";
import {
  formatPostCategoryLabel,
  getPostCategorySoftPillClasses,
} from "@/data/blog-categories";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canReviewPosts } from "@/lib/workspace/permissions";
import { POST_STATUS_LABELS } from "@/lib/workspace/posts";
import { approvePostAction, rejectPostAction } from "@/lib/workspace/review-actions";

export default async function RevisaoPage() {
  const session = await requireSession();
  if (!canReviewPosts(session)) redirect("/area-restrita/dashboard");

  const pending = await prisma.post.findMany({
    where: { status: "PENDING_REVIEW" },
    include: { author: true },
    orderBy: { submittedAt: "asc" },
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold text-[#132960]">Fila de revisão</h1>
      <p className="mt-1 text-sm text-[#132960]/60">
        Pré-visualize o texto como ficará no blog antes de aprovar ou devolver.
      </p>

      <div className="mt-6 space-y-4">
        {pending.map((post) => (
          <article
            key={post.id}
            className="rounded-lg border border-[#132960]/12 bg-white p-5 shadow-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-medium text-[#132960]">{post.title}</h2>
                <p className="text-sm text-[#132960]/60">
                  {post.authorName} · {post.category} ·{" "}
                  {POST_STATUS_LABELS[post.status]}
                  {post.submittedAt
                    ? ` · enviado em ${new Date(post.submittedAt).toLocaleDateString("pt-BR")}`
                    : ""}
                </p>
                {post.excerpt ? (
                  <p className="mt-2 text-sm text-[#132960]/80">{post.excerpt}</p>
                ) : null}
              </div>
              <Link
                href={`/area-restrita/conteudo/${post.id}`}
                className="text-sm font-medium text-[#027DFC] hover:underline"
              >
                Abrir editor
              </Link>
            </div>

            {/*
              Pré-visualização expansível: renderiza o MESMO caminho do post
              publicado (Post.content em markdown via PostMarkdownBody, que é o
              componente usado em /blog/[slug]) dentro do envelope az-card do
              blog — nada de HTML cru, nada de pipeline novo.
            */}
            <details className="group mt-4 overflow-hidden rounded-lg border border-[#132960]/12 bg-[#F3F5FB]">
              <summary className="flex cursor-pointer select-none items-center gap-2 px-4 py-3 text-sm font-medium text-[#027DFC] transition hover:bg-[#027DFC]/5 [&::-webkit-details-marker]:hidden">
                <ChevronRight
                  aria-hidden
                  className="h-4 w-4 shrink-0 transition-transform group-open:rotate-90"
                />
                Pré-visualizar como no blog
              </summary>
              <div className="border-t border-[#132960]/10 px-4 py-6 md:px-6">
                {post.coverImage ? (
                  <div className="relative mb-6 aspect-[21/8] w-full overflow-hidden rounded-2xl">
                    {/* eslint-disable-next-line @next/next/no-img-element -- preview de URL remota variável */}
                    <img
                      src={post.coverImage}
                      alt={post.title}
                      className="h-full w-full object-cover"
                    />
                  </div>
                ) : null}

                <div className="az-card space-y-4 p-6 md:p-10">
                  <span
                    className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider ${getPostCategorySoftPillClasses(post.category)}`}
                  >
                    {formatPostCategoryLabel(post.category)}
                  </span>
                  <h3 className="text-4xl font-semibold text-[#132960] md:text-5xl">
                    {post.title}
                  </h3>

                  <div className="flex items-center gap-3 border-y border-[#132960]/10 py-3">
                    <p className="text-sm text-zinc-500">
                      {post.authorName} |{" "}
                      {new Date(post.createdAt).toLocaleDateString("pt-BR")}
                    </p>
                  </div>

                  {post.content.trim() ? (
                    <PostMarkdownBody markdown={post.content} />
                  ) : (
                    <p className="text-sm text-[#132960]/45">Texto sem conteúdo.</p>
                  )}
                </div>
              </div>
            </details>

            <div className="mt-4 flex flex-wrap items-end gap-2">
              <form action={approvePostAction} className="flex flex-wrap items-end gap-2">
                <input type="hidden" name="id" value={post.id} />
                <input
                  name="note"
                  placeholder="Nota para o autor (opcional)"
                  className="rounded-md border border-[#132960]/20 bg-white px-3 py-2 text-sm text-[#132960] outline-none focus:border-[#027DFC]"
                />
                <SubmitButton className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500">
                  Aprovar e publicar
                </SubmitButton>
              </form>
              <form action={rejectPostAction} className="flex flex-wrap items-end gap-2">
                <input type="hidden" name="id" value={post.id} />
                <input
                  name="note"
                  required
                  placeholder="Motivo da devolução"
                  className="rounded-md border border-[#132960]/20 bg-white px-3 py-2 text-sm text-[#132960] outline-none focus:border-[#027DFC]"
                />
                <SubmitButton className="rounded-md border border-red-400 px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50">
                  Devolver
                </SubmitButton>
              </form>
            </div>
          </article>
        ))}
        {pending.length === 0 ? (
          <p className="text-sm text-[#132960]/55">Nenhum texto na fila.</p>
        ) : null}
      </div>
    </div>
  );
}
