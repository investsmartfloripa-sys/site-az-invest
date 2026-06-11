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
  // Post legado: tem `content` (markdown) mas nunca foi salvo pelo editor TipTap
  // (sem contentHtml). Não dá para hidratar o editor sem perder formatação, então
  // o editor abre vazio e o servidor bloqueia salvamentos que reduziriam o texto.
  const isLegacyPost = Boolean(post && !post.contentHtml && post.content);
  // AUTHOR não edita post publicado — a equipe editorial precisa abrir revisão.
  const isLockedForAuthor = Boolean(isAuthor && post?.status === "APPROVED");

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
        {isLegacyPost ? (
          <p className="mb-2 rounded-md border border-amber-700/30 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Post legado precisa de migração: o conteúdo original (markdown) não pode ser
            carregado neste editor. Para evitar perda de dados, salvar com o editor vazio ou
            com texto bem menor que o original será bloqueado — cole o conteúdo completo no
            editor para migrar o post.
          </p>
        ) : null}
        <WorkspaceEditor name="contentHtml" initialHtml={post?.contentHtml || ""} />
      </div>

      {post ? (
        <p className="text-xs text-[#132960]/55">
          Status: {POST_STATUS_LABELS[post.status]}
          {post.reviewNote ? ` — ${post.reviewNote}` : ""}
        </p>
      ) : null}

      {isLockedForAuthor ? (
        <p className="rounded-md border border-[#9C2B24]/30 bg-[#9C2B24]/5 px-3 py-2 text-sm text-[#9C2B24]">
          Post publicado — peça à equipe editorial para abrir uma revisão.
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={isLockedForAuthor}
          className="rounded-md bg-[#027DFC] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0268d4] disabled:cursor-not-allowed disabled:opacity-50"
        >
          Salvar rascunho
        </button>
        {post ? (
          <>
            <button
              type="submit"
              formAction={submitPostForReviewAction}
              className="rounded-md border border-amber-700/40 px-4 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-700/10"
            >
              Enviar para revisão
            </button>
            {canPublishDirectly(session) ? (
              <button
                type="submit"
                formAction={publishPostDirectAction}
                className="rounded-md border border-[#166B47]/40 px-4 py-2 text-sm font-semibold text-[#166B47] hover:bg-[#166B47]/10"
              >
                Publicar direto
              </button>
            ) : null}
            <button
              type="submit"
              formAction={deletePostAction}
              className="rounded-md border border-[#9C2B24]/40 px-4 py-2 text-sm text-[#9C2B24] hover:bg-[#9C2B24]/10"
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
