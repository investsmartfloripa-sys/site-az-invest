import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Footer } from "@/components/common/Footer";
import { Header } from "@/components/common/Header";
import { PostCard } from "@/components/common/PostCard";
import { NewsletterForm } from "@/components/home/NewsletterForm";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const FALLBACK_IMAGE =
  "https://investimentosdeaz.com.br/wp-content/uploads/2026/03/Seguros-1024x666.png";

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const author = await prisma.author.findUnique({ where: { slug } });
  if (!author) return { title: "Autor nao encontrado | AZ Invest" };
  return {
    title: `${author.name} | AZ Invest`,
    description: author.bio ?? `Artigos publicados por ${author.name}`,
  };
}

export default async function AuthorPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const author = await prisma.author.findUnique({
    where: { slug },
    include: {
      posts: {
        where: { published: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!author) notFound();

  const mappedPosts = author.posts.map((post) => ({
    id: post.id,
    title: post.title,
    slug: post.slug,
    category: post.category,
    authorName: author.name,
    excerpt: post.excerpt,
    date: new Date(post.createdAt).toLocaleDateString("pt-BR"),
    image: post.coverImage || FALLBACK_IMAGE,
  }));

  return (
    <div className="min-h-screen text-[#132960]">
      <Header />
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-8 md:px-8">
        <Link
          href="/nosso-time"
          className="text-xs font-semibold text-[#132960] hover:underline"
        >
          {"<-"} Voltar para Nosso time
        </Link>

        <section className="grid gap-6 rounded-2xl border border-[#132960]/15 bg-white p-6 md:grid-cols-[160px_1fr]">
          <div className="relative mx-auto h-40 w-40 flex-none overflow-hidden rounded-full bg-[#132960]">
            {author.photo ? (
              <Image
                src={author.photo}
                alt={author.name}
                fill
                sizes="160px"
                className="object-cover"
              />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-3xl font-semibold text-white">
                {initials(author.name)}
              </span>
            )}
          </div>
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#027DFC]">
              {author.role}
            </p>
            <h1 className="text-4xl text-[#132960]">{author.name}</h1>
            {author.bio ? <p className="text-sm text-zinc-700">{author.bio}</p> : null}
            <div className="flex flex-wrap gap-3 text-sm">
              {author.email ? (
                <a
                  href={`mailto:${author.email}`}
                  className="rounded-full border border-[#132960]/25 px-3 py-1 text-[#132960] hover:bg-[#132960]/5"
                >
                  {author.email}
                </a>
              ) : null}
              {author.linkedin ? (
                <a
                  href={author.linkedin}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full bg-[#027DFC] px-3 py-1 font-semibold text-white"
                >
                  LinkedIn
                </a>
              ) : null}
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl text-[#027DFC]">Artigos publicados</h2>
          {mappedPosts.length === 0 ? (
            <p className="rounded-xl border border-[#132960]/20 bg-white p-6 text-sm text-zinc-600">
              {author.name.split(" ")[0]} ainda nao publicou nenhum artigo por aqui.
            </p>
          ) : (
            <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {mappedPosts.map((post) => (
                <li key={post.id}>
                  <PostCard post={post} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <NewsletterForm />
      </main>
      <Footer />
    </div>
  );
}
