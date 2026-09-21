import Link from "next/link";
import type { Metadata } from "next";
import { Footer } from "@/components/common/Footer";
import { Header } from "@/components/common/Header";
import { PostCard } from "@/components/common/PostCard";
import { BOLETIM_BASE_PATH, BOLETIM_SECTION_LABEL } from "@/data/blog-categories";
import { findPosts, mapPost } from "@/lib/posts";
import { INDICADOR_LABEL, type ChartIndicador } from "@/lib/publisher/chart-catalog";
import { SITE_MAIN_MAX_WIDTH_CLASS } from "@/lib/site-layout";
import { boletinsWhere } from "@/lib/workspace/posts";

// Lista de boletins: lê o banco a cada request (como /blog), sem ISR.
export const dynamic = "force-dynamic";

const DESCRIPTION =
  "Divulgações de indicadores — IPCA, IGP-M — comentadas a cada release, com gráficos ao vivo.";

/** Mesmo sistema de título de seção da home (HeroRecentes): navy com sublinhado curto azure. */
const SECTION_TITLE_CLASSES =
  "text-3xl text-[#132960] after:mt-2 after:block after:h-1 after:w-12 after:rounded-full after:bg-[#027DFC] md:text-4xl";

export const metadata: Metadata = {
  title: BOLETIM_SECTION_LABEL,
  description: DESCRIPTION,
  alternates: { canonical: BOLETIM_BASE_PATH },
  openGraph: { images: ["/opengraph-image.png"],
    title: `${BOLETIM_SECTION_LABEL} | AZ Invest`,
    description: DESCRIPTION,
    url: BOLETIM_BASE_PATH,
    type: "website",
  },
};

/** Chips de indicador. O filtro é pelo prefixo do slug que o Publisher grava (`ipca-…`, `igpm-…`). */
const INDICADORES: ChartIndicador[] = ["ipca", "igpm"];

function parseIndicador(value: string | undefined): ChartIndicador | undefined {
  return INDICADORES.find((ind) => ind === value);
}

type SearchParams = { ind?: string };

export default async function BoletinsIndexPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { ind } = await searchParams;
  const filtro = parseIndicador(ind?.trim());

  const posts = await findPosts({
    where: {
      ...boletinsWhere,
      ...(filtro ? { slug: { startsWith: `${filtro}-` } } : {}),
    },
    orderBy: [{ publishedAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
  });
  const mapped = posts.map(mapPost);

  return (
    <div className="min-h-screen text-[#132960]">
      <Header />
      <main
        className={`mx-auto flex w-full ${SITE_MAIN_MAX_WIDTH_CLASS} flex-col gap-8 px-4 py-8 md:px-8`}
      >
        <header className="space-y-4">
          <h1 className={SECTION_TITLE_CLASSES}>{BOLETIM_SECTION_LABEL}</h1>
          <p className="max-w-2xl text-sm text-zinc-600">{DESCRIPTION}</p>
        </header>

        <nav className="flex flex-wrap gap-2">
          <Chip href={BOLETIM_BASE_PATH} label="Todos" active={!filtro} />
          {INDICADORES.map((i) => (
            <Chip
              key={i}
              href={`${BOLETIM_BASE_PATH}?ind=${i}`}
              label={INDICADOR_LABEL[i]}
              active={filtro === i}
            />
          ))}
        </nav>

        {/* Estado vazio sem citar o nome do formato: ele é provisório e pode mudar de gênero. */}
        {mapped.length === 0 ? (
          <p className="rounded-xl border border-[#132960]/20 bg-white p-6 text-sm text-zinc-600">
            {filtro ? `Nenhuma publicação de ${INDICADOR_LABEL[filtro]} ainda.` : "Nenhuma publicação ainda."}
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {mapped.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}

function Chip({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
        active
          ? "border-[#027DFC] bg-[#027DFC] text-white"
          : "border-[#132960]/25 text-[#132960] hover:bg-[#132960]/5"
      }`}
    >
      {label}
    </Link>
  );
}
