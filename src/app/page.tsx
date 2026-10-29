import { Footer } from "@/components/common/Footer";
import { Header } from "@/components/common/Header";
import { HeroRecentes } from "@/components/home/HeroRecentes";
import { CommunityCallout } from "@/components/home/CommunityCallout";
import { VideosSection } from "@/components/home/VideosSection";
import { PeriodicosBlock } from "@/components/conteudo/PeriodicosBlock";
import { JsonLd } from "@/components/seo/JsonLd";
import type { PostCardData } from "@/components/common/PostCard";
import { artigosRecentes } from "@/lib/cache-conteudo";
import { SITE_MAIN_MAX_WIDTH_CLASS } from "@/lib/site-layout";
import { getSiteUrl } from "@/lib/site-url";

// DINÂMICA (não ISR): a home depende de DUAS chamadas externas no render —
// posts (Neon) e vídeos (YouTube). Com ISR, uma única regeneração que pegasse
// QUALQUER das duas com hiccup assava a home degradada (Artigos vazio / vídeos
// de exemplo) no cache estático e a servia a TODOS por minutos. Renderizando por
// request, uma falha transitória afeta só aquele acesso e o próximo já se corrige
// Os artigos não vão ao banco a cada request: vêm de lib/cache-conteudo, que guarda
// a última lista boa e só consulta o Neon quando ela vence ou alguém publica.
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
  // Só artigos editoriais, pela data de PUBLICAÇÃO (publicar um rascunho antigo o
  // traz ao topo); boletins têm seção própria (Periódicos). Lista vazia só se o
  // banco falhar sem nenhuma versão em cache — afeta aquele acesso, nada é assado.
  let mapped: PostCardData[] = [];
  // Duas tentativas: o Neon às vezes recusa a 1ª conexão (cold start ou pool saturado).
  for (let tentativa = 1; tentativa <= 2; tentativa++) {
    try {
      mapped = await artigosRecentes(4);
      break;
    } catch (err) {
      console.error(`[Home] artigosRecentes falhou (tentativa ${tentativa}/2)`, err);
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
        {/* PeriodicosBlock é compartilhado com /conteudo; o reveal fica no wrapper. */}
        <div className="az-reveal">
          <PeriodicosBlock variant="home" />
        </div>
        <VideosSection />
        <CommunityCallout />
      </main>
      <Footer />
    </div>
  );
}
