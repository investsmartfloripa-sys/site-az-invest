import { notFound, permanentRedirect } from "next/navigation";
import { PostPage, buildPostMetadata, getPost } from "@/components/blog/PostPage";
import { isBoletimCategory } from "@/data/blog-categories";
import { postPath } from "@/lib/post-path";

// ISR: novo comentário chama revalidatePath(postPath) (comment-actions)
// e edições se resolvem no fallback de 5 min. Sem force-dynamic.
export const revalidate = 300;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return buildPostMetadata(slug);
}

/**
 * Rota fina do BOLETIM — espelho de /blog/[slug]. Se o slug for de um artigo
 * (qualquer categoria que não a do Publisher), manda em definitivo para
 * /blog/<slug>; `postPath` resolve o destino pela categoria.
 */
export default async function BoletimPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getPost(slug);

  if (!post || post.status !== "APPROVED") {
    notFound();
  }
  if (!isBoletimCategory(post.category)) {
    permanentRedirect(postPath(post));
  }

  return <PostPage slug={slug} kind="boletim" />;
}
