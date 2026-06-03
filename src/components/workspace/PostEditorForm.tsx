import Link from "next/link";
import { blogPostCategoryOptions } from "@/data/blog-categories";
import { WorkspaceEditor } from "@/components/workspace/WorkspaceEditor";
import { PhotoField } from "@/components/workspace/PhotoField";
import {
  deletePostAction,
  publishPostDirectAction,
  savePostDraftAction,
  submitPostForReviewAction,
} from "@/lib/workspace/post-actions";
import type { Post, Author } from "@prisma/client";
import type { SessionUser } from "@/lib/auth";
import { canPublishDirectly } from "@/lib/workspace/permissions";
import { POST_STATUS_LABELS } from "@/lib/workspace/posts";

type PostWithAuthor = Post & { author: Author | null };

export function PostEditorForm({
  session,
  post,
  authors,
}: {
  session: SessionUser;
  post?: PostWithAuthor;
  authors: Author[];
}) {
  const isAuthor = session.role === "AUTHOR";
  const authorOptions = isAuthor
    ? authors.filter((a) => a.id === session.authorId)
    : authors;

  return (
    <form action={savePostDraftAction} className="space-y-5">
      {post ? <input type="hidden" name="id" value={post.id} /> : null}

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block text-sm">
          <span className="text-[#132960]/65">Título</span>
          <input
            name="title"
            required
            defaultValue={post?.title}
            className="mt-1 w-full rounded-md border border-[#132960]/20 bg-white px-3 py-2 text-[#132960] outline-none focus:border-[#027DFC]"
          />
        </label>
        <label className="block text-sm">
          <span className="text-[#132960]/65">Slug (SEO)</span>
          <input
            name="slug"
            defaultValue={post?.slug}
            placeholder="gerado-automaticamente"
            className="mt-1 w-full rounded-md border border-[#132960]/20 bg-white px-3 py-2 text-[#132960] outline-none focus:border-[#027DFC]"
          />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block text-sm">
          <span className="text-[#132960]/65">Categoria</span>
          <select
            name="category"
            required
            defaultValue={post?.category}
            className="mt-1 w-full rounded-md border border-[#132960]/20 bg-white px-3 py-2 text-[#132960] outline-none focus:border-[#027DFC]"
          >
            {blogPostCategoryOptions.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-[#132960]/65">Autor</span>
          <select
            name="authorId"
            required
            defaultValue={post?.authorId ?? session.authorId ?? undefined}
            disabled={isAuthor}
            className="mt-1 w-full rounded-md border border-[#132960]/20 bg-white px-3 py-2 text-[#132960] outline-none focus:border-[#027DFC] disabled:opacity-60"
          >
            {authorOptions.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="block text-sm">
        <span className="text-[#132960]/65">Resumo (excerpt)</span>
        <textarea
          name="excerpt"
          rows={2}
          defaultValue={post?.excerpt ?? ""}
          className="mt-1 w-full rounded-md border border-[#132960]/20 bg-white px-3 py-2 text-[#132960] outline-none focus:border-[#027DFC]"
        />
      </label>

      <label className="block text-sm">
        <span className="text-[#132960]/65">Capa do texto</span>
        <PhotoField name="coverImage" defaultValue={post?.coverImage ?? ""} variant="cover" />
      </label>

      <div>
        <p className="mb-2 text-sm text-[#132960]/65">Conteúdo</p>
        <WorkspaceEditor
          name="contentHtml"
          initialHtml={post?.contentHtml || (post?.content ? `<p>${post.content.slice(0, 200)}…</p>` : "")}
        />
      </div>

      {post ? (
        <p className="text-xs text-[#132960]/55">
          Status: {POST_STATUS_LABELS[post.status]}
          {post.reviewNote ? ` — ${post.reviewNote}` : ""}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          className="rounded-md bg-[#027DFC] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0268d4]"
        >
          Salvar rascunho
        </button>
        {post ? (
          <>
            <button
              type="submit"
              formAction={submitPostForReviewAction}
              className="rounded-md border border-amber-500/50 px-4 py-2 text-sm font-semibold text-amber-200 hover:bg-amber-500/10"
            >
              Enviar para revisão
            </button>
            {canPublishDirectly(session) ? (
              <button
                type="submit"
                formAction={publishPostDirectAction}
                className="rounded-md border border-emerald-500/50 px-4 py-2 text-sm font-semibold text-emerald-200 hover:bg-emerald-500/10"
              >
                Publicar direto
              </button>
            ) : null}
            <button
              type="submit"
              formAction={deletePostAction}
              className="rounded-md border border-red-500/40 px-4 py-2 text-sm text-red-300 hover:bg-red-500/10"
            >
              Excluir
            </button>
            {post.status === "APPROVED" ? (
              <Link
                href={`/blog/${post.slug}`}
                target="_blank"
                className="rounded-md border border-[#132960]/25 px-4 py-2 text-sm text-[#132960]/70 hover:bg-[#132960]/5"
              >
                Ver no site
              </Link>
            ) : null}
          </>
        ) : null}
      </div>
    </form>
  );
}
