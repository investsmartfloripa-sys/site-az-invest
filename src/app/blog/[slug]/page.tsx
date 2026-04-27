import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Footer } from "@/components/common/Footer";
import { Header } from "@/components/common/Header";
import { NewsletterForm } from "@/components/home/NewsletterForm";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await prisma.post.findUnique({ where: { slug } });
  if (!post) return { title: "Artigo nao encontrado | AZ Invest" };
  return {
    title: `${post.title} | AZ Invest`,
    description: post.excerpt ?? undefined,
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
  const post = await prisma.post.findUnique({
    where: { slug },
    include: { author: true },
  });

  if (!post || !post.published) {
    notFound();
  }

  return (
    <div className="min-h-screen text-[#132960]">
      <Header />
      <main className="mx-auto w-full max-w-3xl px-4 py-8 md:px-8">
        <Link href="/blog" className="text-sm text-[#027DFC] hover:underline">
          {"<-"} Voltar para Artigos
        </Link>

        {post.coverImage ? (
          <div className="relative mt-4 aspect-[16/9] w-full overflow-hidden rounded-2xl">
            <Image
              src={post.coverImage}
              alt={post.title}
              fill
              sizes="(min-width: 768px) 768px, 100vw"
              className="object-cover"
              priority
            />
          </div>
        ) : null}

        <article className="mt-6 space-y-4">
          <p className="text-sm font-semibold uppercase tracking-wider text-[#027DFC]">
            {post.category}
          </p>
          <h1 className="text-4xl font-semibold text-[#132960] md:text-5xl">{post.title}</h1>
          {post.excerpt ? <p className="text-lg text-zinc-700">{post.excerpt}</p> : null}

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

          <div className="whitespace-pre-wrap text-[15px] leading-7 text-zinc-800">
            {post.content}
          </div>
        </article>

        <div className="mt-10">
          <NewsletterForm />
        </div>
      </main>
      <Footer />
    </div>
  );
}
