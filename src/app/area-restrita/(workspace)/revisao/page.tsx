import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { approvePostAction, rejectPostAction } from "@/lib/workspace/review-actions";
import { canReviewPosts } from "@/lib/workspace/permissions";
import { redirect } from "next/navigation";
import { POST_STATUS_LABELS } from "@/lib/workspace/posts";

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
        Aprove ou devolva textos enviados pelos autores.
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

            <div className="mt-4 flex flex-wrap gap-2">
              <form action={approvePostAction}>
                <input type="hidden" name="id" value={post.id} />
                <button
                  type="submit"
                  className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
                >
                  Aprovar e publicar
                </button>
              </form>
              <form action={rejectPostAction} className="flex flex-wrap items-end gap-2">
                <input type="hidden" name="id" value={post.id} />
                <input
                  name="note"
                  required
                  placeholder="Motivo da devolução"
                  className="rounded-md border border-[#132960]/20 bg-white px-3 py-2 text-sm text-[#132960] outline-none focus:border-[#027DFC]"
                />
                <button
                  type="submit"
                  className="rounded-md border border-red-400 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                >
                  Devolver
                </button>
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
