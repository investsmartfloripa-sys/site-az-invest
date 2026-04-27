import { Footer } from "@/components/common/Footer";
import { Header } from "@/components/common/Header";
import { HeroRecentes } from "@/components/home/HeroRecentes";
import { MaisLidos } from "@/components/home/MaisLidos";
import { NewsletterForm } from "@/components/home/NewsletterForm";
import { UltimasPublicacoes } from "@/components/home/UltimasPublicacoes";
import { VideosSection } from "@/components/home/VideosSection";
import { findPosts, mapPost } from "@/lib/posts";

export const dynamic = "force-dynamic";

export default async function Home() {
  const posts = await findPosts({
    where: { published: true },
    orderBy: { createdAt: "desc" },
    take: 12,
  });

  const mapped = posts.map(mapPost);

  const hero = mapped.slice(0, 3);
  const maisLidos = mapped.slice(3, 6);
  const restantes = mapped.slice(3);

  return (
    <div className="min-h-screen text-[#132960]">
      <Header />
      <main className="az-shell mx-auto flex w-full max-w-6xl flex-col gap-12 px-4 py-6 md:px-8 md:py-8">
        <HeroRecentes posts={hero} />
        {maisLidos.length > 0 ? <MaisLidos posts={maisLidos} /> : null}
        <UltimasPublicacoes posts={restantes} />
        <VideosSection />
        <NewsletterForm />
      </main>
      <Footer />
    </div>
  );
}
