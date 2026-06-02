import { Footer } from "@/components/common/Footer";
import { Header } from "@/components/common/Header";
import { HeroRecentes } from "@/components/home/HeroRecentes";
import { MaisLidos } from "@/components/home/MaisLidos";
import { CommunityCallout } from "@/components/home/CommunityCallout";
import { UltimasPublicacoes } from "@/components/home/UltimasPublicacoes";
import { VideosSection } from "@/components/home/VideosSection";
import { DestaquesDaSemana } from "@/components/conteudo/DestaquesDaSemana";
import { findPosts, mapPost } from "@/lib/posts";
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
    where: { published: true },
    orderBy: { createdAt: "desc" },
    take: 21,
  });

  const mapped = posts.map(mapPost);

  const hero = mapped.slice(0, 3);
  /** Segunda faixa da home; posts 7+ vão só para UltimasPublicacoes (evita repetir cards). */
  const maisLidos = mapped.slice(3, 6);
  const restantes = mapped.slice(6);

  return (
    <div className="min-h-screen text-[#132960]">
      <Header />
      <main
        className={`az-shell mx-auto flex w-full ${SITE_MAIN_MAX_WIDTH_CLASS} flex-col gap-12 px-4 py-6 md:px-8 md:py-8`}
      >
        <HeroRecentes posts={hero} />
        <DestaquesDaSemana />
        {maisLidos.length > 0 ? <MaisLidos posts={maisLidos} /> : null}
        <UltimasPublicacoes posts={restantes} />
        <CommunityCallout />
        <VideosSection />
      </main>
      <Footer />
    </div>
  );
}
