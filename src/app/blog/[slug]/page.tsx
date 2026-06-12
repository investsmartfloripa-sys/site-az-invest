import { cache } from "react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Footer } from "@/components/common/Footer";
import { Header } from "@/components/common/Header";
import { CommunityCallout } from "@/components/home/CommunityCallout";
import { PostMarkdownBody } from "@/components/blog/PostMarkdownBody";
import { JsonLd } from "@/components/seo/JsonLd";
import { formatPostCategoryLabel, getPostCategorySoftPillClasses } from "@/data/blog-categories";
import { addCommentAction } from "@/lib/comment-actions";
import { prisma } from "@/lib/prisma";
import { getSiteUrl } from "@/lib/site-url";

// ISR: novo comentário chama revalidatePath("/blog/[slug]") (comment-actions)
// e edições se resolvem no fallback de 5 min. Sem force-dynamic.
export const revalidate = 300;

// React.cache: generateMetadata e a página compartilham a MESMA consulta
// dentro de um request (antes eram duas idas ao banco por acesso).
const getPost = cache(async (slug: string) =>
  prisma.post.findUnique({
    where: { slug },
    include: {
      author: true,
      comments: { orderBy: { createdAt: "desc" }, take: 100 },
    },
  }),
);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) return { title: "Artigo não encontrado | AZ Invest" };
  return {
    title: `${post.title} | AZ Invest`,
    description: post.excerpt ?? undefined,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      type: "article",
      url: `/blog/${post.slug}`,
      title: post.title,
      description: post.excerpt ?? undefined,
      ...(post.coverImage ? { images: [{ url: post.coverImage, alt: post.title }] } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.excerpt ?? undefined,
      ...(post.coverImage ? { images: [post.coverImage] } : {}),
    },
  };
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getPost(slug);

  if (!post || post.status !== "APPROVED") {
    notFound();
  }

  const siteUrl = getSiteUrl();

  return (
    <div className="min-h-screen text-[#132960]">
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "Article",
            headline: post.title,
            description: post.excerpt ?? undefined,
            datePublished: (post.publishedAt ?? post.createdAt).toISOString(),
            dateModified: post.updatedAt.toISOString(),
            mainEntityOfPage: `${siteUrl}/blog/${post.slug}`,
            inLanguage: "pt-BR",
            ...(post.coverImage ? { image: post.coverImage } : {}),
            author: post.author
              ? {
                  "@type": "Person",
                  name: post.author.name,
                  url: `${siteUrl}/nosso-time/${post.author.slug}`,
                }
              : { "@type": "Person", name: post.authorName },
            publisher: {
              "@type": "Organization",
              name: "AZ Invest",
              url: siteUrl,
              logo: { "@type": "ImageObject", url: `${siteUrl}/logo-az.png` },
            },
          },
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Início", item: siteUrl },
              { "@type": "ListItem", position: 2, name: "Artigos", item: `${siteUrl}/blog` },
              { "@type": "ListItem", position: 3, name: post.title, item: `${siteUrl}/blog/${post.slug}` },
            ],
          },
        ]}
      />
      <Header />
      <main className="mx-auto w-full max-w-[60rem] px-4 py-8 md:px-8">
        <Link href="/blog" className="text-sm text-[#027DFC] hover:underline">
          {"<-"} Voltar para Artigos
        </Link>

        {post.coverImage ? (
          <div className="relative mt-4 aspect-[21/8] w-full overflow-hidden rounded-2xl">
            <Image
              src={post.coverImage}
              alt={post.title}
              fill
              sizes="(min-width: 768px) 960px, 100vw"
              className="object-cover"
              priority
            />
          </div>
        ) : null}

        <article className="az-card mt-6 space-y-4 p-6 md:p-10">
          <span
            className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider ${getPostCategorySoftPillClasses(post.category)}`}
          >
            {formatPostCategoryLabel(post.category)}
          </span>
          <h1 className="text-4xl font-semibold text-[#132960] md:text-5xl">{post.title}</h1>

          <div className="flex items-center gap-3 border-y border-[#132960]/10 py-3">
            {post.author ? (
              <Link
                href={`/nosso-time/${post.author.slug}`}
                className="flex items-center gap-3 hover:underline"
              >
                <div className="relative h-12 w-12 flex-none overflow-hidden rounded-full bg-[#132960]">
                  {post.author.photo ? (
                    <Image
                      src={post.author.photo}
                      alt={post.author.name}
                      fill
                      sizes="48px"
                      className="object-cover"
                    />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-sm font-semibold text-white">
                      {initials(post.author.name)}
                    </span>
                  )}
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#132960]">{post.author.name}</p>
                  <p className="text-xs text-zinc-500">
                    {post.author.role} | {new Date(post.createdAt).toLocaleDateString("pt-BR")}
                  </p>
                </div>
              </Link>
            ) : (
              <p className="text-sm text-zinc-500">
                {post.authorName} | {new Date(post.createdAt).toLocaleDateString("pt-BR")}
              </p>
            )}
          </div>

          <PostMarkdownBody markdown={post.content} />
        </article>

        <section id="comentarios" className="az-card mt-8 space-y-6 p-6 md:p-10">
          <h2 className="text-2xl font-semibold text-[#132960]">
            Comentários{post.comments.length > 0 ? ` (${post.comments.length})` : ""}
          </h2>

          <form action={addCommentAction} className="space-y-3">
            <input type="hidden" name="postId" value={post.id} />
            <input type="hidden" name="slug" value={post.slug} />
            <input
              type="text"
              name="site"
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              className="hidden"
            />
            <div>
              <label
                htmlFor="comment-name"
                className="text-xs font-semibold uppercase tracking-wider text-zinc-500"
              >
                Nome
              </label>
              <input
                id="comment-name"
                name="name"
                required
                maxLength={80}
                placeholder="Seu nome"
                className="mt-1 w-full rounded-lg border border-[#132960]/20 bg-white px-3 py-2 text-sm outline-none transition focus:border-[#027DFC]"
              />
            </div>
            <div>
              <label
                htmlFor="comment-content"
                className="text-xs font-semibold uppercase tracking-wider text-zinc-500"
              >
                Comentário
              </label>
              <textarea
                id="comment-content"
                name="content"
                required
                maxLength={2000}
                rows={4}
                placeholder="Escreva seu comentário..."
                className="mt-1 w-full rounded-lg border border-[#132960]/20 bg-white px-3 py-2 text-sm outline-none transition focus:border-[#027DFC]"
              />
            </div>
            <button
              type="submit"
              className="rounded-lg bg-[#027DFC] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#0265c9] active:bg-[#0253a4]"
            >
              Publicar comentário
            </button>
          </form>

          {post.comments.length === 0 ? (
            <p className="text-sm text-zinc-500">Seja o primeiro a comentar.</p>
          ) : (
            <ul className="space-y-4">
              {post.comments.map((comment) => (
                <li key={comment.id} className="rounded-xl border border-[#132960]/10 bg-[#F7F9FC] p-4">
                  <p className="text-sm font-semibold text-[#132960]">
                    {comment.name}{" "}
                    <span className="text-xs font-normal text-zinc-500">
                      | {new Date(comment.createdAt).toLocaleDateString("pt-BR")}
                    </span>
                  </p>
                  <p className="mt-1 whitespace-pre-line text-sm text-zinc-700">{comment.content}</p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="mt-10">
          <CommunityCallout />
        </div>
      </main>
      <Footer />
    </div>
  );
}
