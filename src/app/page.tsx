import { Footer } from "@/components/common/Footer";
import { Header } from "@/components/common/Header";
import { HeroRecentes } from "@/components/home/HeroRecentes";
import { CommunityCallout } from "@/components/home/CommunityCallout";
import { VideosSection } from "@/components/home/VideosSection";
import { DestaquesDaSemana } from "@/components/conteudo/DestaquesDaSemana";
import { JsonLd } from "@/components/seo/JsonLd";
import { findPosts, mapPost } from "@/lib/posts";
import { publishedPostWhere } from "@/lib/workspace/posts";
import { SITE_MAIN_MAX_WIDTH_CLASS } from "@/lib/site-layout";
import { getSiteUrl } from "@/lib/site-url";

// DINÂMICA (não ISR): a home depende de DUAS chamadas externas no render —
// posts (Neon) e vídeos (YouTube). Com ISR, uma única regeneração que pegasse
// QUALQUER das duas com hiccup assava a home degradada (Artigos vazio / vídeos
// de exemplo) no cache estático e a servia a TODOS por minutos. Renderizando por
// request, uma falha transitória afeta só aquele acesso e o próximo já se corrige
// — como as páginas do admin, que batem no banco a cada request e nunca quebram.
// Os dados pesados (blobs do painel) seguem cacheados na própria camada de fetch.
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
  // Guard para o prerender de build: se o banco estiver indisponível a home
  // degrada para listas vazias em vez de derrubar o build (ISR refaz depois).
  let mapped: ReturnType<typeof mapPost>[] = [];
  // Duas tentativas: no build/ISR o Neon às vezes recusa a 1ª conexão (cold start
  // ou pool saturado), e o catch silencioso assava a home VAZIA ("Nenhuma postagem
  // publicada ainda") com posts no ar, até o próximo ISR. O retry curto cobre isso.
  for (let tentativa = 1; tentativa <= 2; tentativa++) {
    try {
      const posts = await findPosts({
        where: publishedPostWhere,
        // Ordena pela data de PUBLICAÇÃO (posts antigos sem publishedAt caem para o fim
        // do critério e o desempate é a criação) — publicar um rascunho antigo o traz ao topo.
        orderBy: [{ publishedAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
        take: 4,
      });
      mapped = posts.map(mapPost);
      break;
    } catch (err) {
      console.error(`[Home] findPosts falhou (tentativa ${tentativa}/2)`, err);
    }
  }

  const siteUrl = getSiteUrl();

  // Hero "Artigos": 1 destaque + 3 cards na coluna direita (preenche a altura sem buraco).
  // A lista completa fica em /blog ("Ver todas"); a home não repete a seção embaixo.
  const hero = mapped.slice(0, 4);

  return (
    <div className="min-h-screen text-[#132960]">
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "Organization",
            "@id": `${siteUrl}/#organization`,
            name: "AZ Invest",
            alternateName: "Investimentos de A a Z",
            url: siteUrl,
            logo: `${siteUrl}/logo-az.png`,
            sameAs: ["https://www.youtube.com/@azinvestoficial"],
          },
          {
            "@context": "https://schema.org",
            "@type": "WebSite",
            "@id": `${siteUrl}/#website`,
            name: "Investimentos de A a Z",
            url: siteUrl,
            publisher: { "@id": `${siteUrl}/#organization` },
            inLanguage: "pt-BR",
          },
        ]}
      />
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
        <VideosSection />
        <CommunityCallout />
      </main>
      <Footer />
    </div>
  );
}
