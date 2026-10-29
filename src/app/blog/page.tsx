import Link from "next/link";
import { Footer } from "@/components/common/Footer";
import { Header } from "@/components/common/Header";
import { PostCard } from "@/components/common/PostCard";
import { CommunityCallout } from "@/components/home/CommunityCallout";
import type { PostCardData } from "@/components/common/PostCard";
import { formatPostCategoryLabel, getPostCategoryFilterChipClasses } from "@/data/blog-categories";
import { artigosRecentes } from "@/lib/cache-conteudo";
import { SITE_MAIN_MAX_WIDTH_CLASS } from "@/lib/site-layout";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Artigos",
  description:
    "Análises, guias e opiniões da equipe AZ Invest sobre economia, mercado financeiro e educação financeira.",
  alternates: { canonical: "/blog" },
  openGraph: { images: ["/opengraph-image.png"],
    title: "Artigos | AZ Invest",
    description:
      "Análises, guias e opiniões da equipe AZ Invest sobre economia, mercado financeiro e educação financeira.",
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

  // A lista inteira de artigos (sem boletins) vem do cache e o filtro é aplicado
  // aqui: um ?categoria= qualquer não vira consulta nova ao banco. Lista vazia só
  // se o banco falhar sem versão em cache — afeta aquele acesso. Sem o catch, o
  // loading.tsx já teria mandado HTTP 200 e o visitante veria a tela de erro.
  let todos: PostCardData[] = [];
  try {
    todos = await artigosRecentes();
  } catch (err) {
    console.error("[Blog] consulta de artigos falhou; seguindo sem artigos", err);
  }
  const categories = [...new Set(todos.map((p) => p.category))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  const mapped = filter ? todos.filter((p) => p.category === filter) : todos;

  return (
    <div className="min-h-screen text-[#132960]">
      <Header />
      <main
        className={`mx-auto flex w-full ${SITE_MAIN_MAX_WIDTH_CLASS} flex-col gap-8 px-4 py-8 md:px-8`}
      >
        <header className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#027DFC]">
            Conteúdo
          </p>
          <h1 className="text-4xl text-[#027DFC] md:text-5xl">Artigos</h1>
          <p className="max-w-2xl text-sm text-zinc-600">
            Análises, guias e opiniões da equipe AZ Invest sobre economia, mercado financeiro e
            educação financeira.
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
              className={`rounded-full px-3 py-1 text-xs font-semibold transition ${getPostCategoryFilterChipClasses(category, filter === category)}`}
            >
              {formatPostCategoryLabel(category)}
            </Link>
          ))}
        </nav>

        {mapped.length === 0 ? (
          <p className="rounded-xl border border-[#132960]/20 bg-white p-6 text-sm text-zinc-600">
            Nenhum artigo encontrado{filter ? ` para a categoria ${formatPostCategoryLabel(filter)}.` : "."}
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
