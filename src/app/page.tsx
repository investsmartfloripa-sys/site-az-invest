import { Footer } from "@/components/common/Footer";
import { Header } from "@/components/common/Header";
import { HeroRecentes } from "@/components/home/HeroRecentes";
import { CommunityCallout } from "@/components/home/CommunityCallout";
import { UltimasPublicacoes } from "@/components/home/UltimasPublicacoes";
import { VideosSection } from "@/components/home/VideosSection";
import { DestaquesDaSemana } from "@/components/conteudo/DestaquesDaSemana";
import { findPosts, mapPost } from "@/lib/posts";
import { publishedPostWhere } from "@/lib/workspace/posts";
import { SITE_MAIN_MAX_WIDTH_CLASS } from "@/lib/site-layout";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Investimentos de A a Z - Economia, mercado e educação financeira",
  description:
    "Análises de economia e mercado, simuladores financeiros, painel econômico e conteúdo da equipe AZ Invest para você investir com mais clareza.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Investimentos de A a Z",
    description:
      "Análises de economia e mercado, simuladores financeiros, painel econômico e conteúdo da equipe AZ Invest.",
    url: "/",
    type: "website",
  },
};

export default async function Home() {
  const posts = await findPosts({
    where: publishedPostWhere,
    // Ordena pela data de PUBLICAÇÃO (posts antigos sem publishedAt caem para o fim
    // do critério e o desempate é a criação) — publicar um rascunho antigo o traz ao topo.
    orderBy: [{ publishedAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
    take: 21,
  });

  const mapped = posts.map(mapPost);

  // Hero "Artigos": 1 destaque + 3 cards na coluna direita (preenche a altura sem buraco).
  const hero = mapped.slice(0, 4);
  const restantes = mapped.slice(4);

  return (
    <div className="min-h-screen text-[#132960]">
      <Header />
      <main
        id="conteudo"
        className={`az-shell az-hero-bg mx-auto flex w-full ${SITE_MAIN_MAX_WIDTH_CLASS} flex-col gap-12 px-4 py-6 md:px-8 md:py-8`}
      >
        <HeroRecentes posts={hero} />
        {/* DestaquesDaSemana é compartilhado com /conteudo; o reveal fica no wrapper. */}
        <div className="az-reveal">
          <DestaquesDaSemana />
        </div>
        <UltimasPublicacoes posts={restantes} />
        <VideosSection />
        <CommunityCallout />
      </main>
      <Footer />
    </div>
  );
}
