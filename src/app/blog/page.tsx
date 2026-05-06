import Link from "next/link";
import { Footer } from "@/components/common/Footer";
import { Header } from "@/components/common/Header";
import { PostCard } from "@/components/common/PostCard";
import { CommunityCallout } from "@/components/home/CommunityCallout";
import { prisma } from "@/lib/prisma";
import { findPosts, mapPost } from "@/lib/posts";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Artigos | AZ Invest",
  description:
    "Analises, guias e opinioes da equipe AZ Invest sobre economia, mercado financeiro e educacao financeira.",
  alternates: { canonical: "/blog" },
  openGraph: {
    title: "Artigos | AZ Invest",
    description:
      "Analises, guias e opinioes da equipe AZ Invest sobre economia, mercado financeiro e educacao financeira.",
    url: "/blog",
    type: "website",
  },
};

type SearchParams = { categoria?: string };

export default async function BlogIndexPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { categoria } = await searchParams;
  const filter = categoria?.trim();

  const [posts, categoriesRaw] = await Promise.all([
    findPosts({
      where: {
        published: true,
        ...(filter ? { category: { equals: filter } } : {}),
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.post.findMany({
      where: { published: true },
      select: { category: true },
      distinct: ["category"],
      orderBy: { category: "asc" },
    }),
  ]);

  const mapped = posts.map(mapPost);
  const categories = categoriesRaw.map((c) => c.category);

  return (
    <div className="min-h-screen text-[#132960]">
      <Header />
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 md:px-8">
        <header className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#027DFC]">
            Conteudo
          </p>
          <h1 className="text-4xl text-[#027DFC] md:text-5xl">Artigos</h1>
          <p className="max-w-2xl text-sm text-zinc-600">
            Analises, guias e opinioes da equipe AZ Invest sobre economia, mercado financeiro e
            educacao financeira.
          </p>
        </header>

        <nav className="flex flex-wrap gap-2">
          <Link
            href="/blog"
            className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
              !filter
                ? "border-[#027DFC] bg-[#027DFC] text-white"
                : "border-[#132960]/25 text-[#132960] hover:bg-[#132960]/5"
            }`}
          >
            Todas
          </Link>
          {categories.map((category) => (
            <Link
              key={category}
              href={`/blog?categoria=${encodeURIComponent(category)}`}
              className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                filter === category
                  ? "border-[#027DFC] bg-[#027DFC] text-white"
                  : "border-[#132960]/25 text-[#132960] hover:bg-[#132960]/5"
              }`}
            >
              {category}
            </Link>
          ))}
        </nav>

        {mapped.length === 0 ? (
          <p className="rounded-xl border border-[#132960]/20 bg-white p-6 text-sm text-zinc-600">
            Nenhum artigo encontrado{filter ? ` para a categoria ${filter}.` : "."}
          </p>
        ) : (
          <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {mapped.map((post) => (
              <li key={post.id}>
                <PostCard post={post} />
              </li>
            ))}
          </ul>
        )}

        <CommunityCallout />
      </main>
      <Footer />
    </div>
  );
}
