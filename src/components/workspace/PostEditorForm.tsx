import {
  BOLETIM_CATEGORY,
  blogPostCategoryOptions,
  formatPostCategoryLabel,
  isBoletimCategory,
} from "@/data/blog-categories";
import { PostEditorClient } from "@/components/workspace/PostEditorClient";
import type { Post, Author } from "@prisma/client";
import type { SessionUser } from "@/lib/auth";
import { canPublishDirectly } from "@/lib/workspace/permissions";

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
  const authorOptions = (isAuthor
    ? authors.filter((a) => a.id === session.authorId)
    : authors
  ).map((a) => ({ id: a.id, name: a.name }));

  const authorNameById = Object.fromEntries(authors.map((a) => [a.id, a.name]));

  // Post legado: tem `content` (markdown) mas nunca foi salvo pelo editor TipTap
  // (sem contentHtml). Não dá para hidratar o editor sem perder formatação, então
  // o editor abre vazio e o servidor bloqueia salvamentos que reduziriam o texto.
  const isLegacyPost = Boolean(post && !post.contentHtml && post.content);
  // AUTHOR não edita post publicado — a equipe editorial precisa abrir revisão.
  const isLockedForAuthor = Boolean(isAuthor && post?.status === "APPROVED");
  // Boletim (post do robô Publisher): a categoria é própria e NÃO está no select
  // (blogPostCategoryOptions). Vai travada para o cliente — campo somente leitura
  // + hidden — senão salvar trocaria a categoria e o boletim viraria artigo.
  const lockedCategory =
    post && isBoletimCategory(post.category)
      ? { label: formatPostCategoryLabel(post.category), value: BOLETIM_CATEGORY }
      : null;

  return (
    <PostEditorClient
      post={
        post
          ? {
              id: post.id,
              title: post.title,
              slug: post.slug,
              category: post.category,
              authorId: post.authorId,
              excerpt: post.excerpt ?? "",
              coverImage: post.coverImage ?? "",
              contentHtml: post.contentHtml ?? "",
              status: post.status,
              reviewNote: post.reviewNote ?? null,
            }
          : null
      }
      categoryOptions={blogPostCategoryOptions}
      lockedCategory={lockedCategory}
      authorOptions={authorOptions}
      defaultAuthorId={post?.authorId ?? session.authorId ?? null}
      authorNameById={authorNameById}
      isAuthor={isAuthor}
      isLegacyPost={isLegacyPost}
      isLockedForAuthor={isLockedForAuthor}
      canPublishDirectly={canPublishDirectly(session)}
    />
  );
}
