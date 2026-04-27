import { Footer } from "@/components/common/Footer";
import { Header } from "@/components/common/Header";
import { PostCard } from "@/components/common/PostCard";
import { NewsletterForm } from "@/components/home/NewsletterForm";
import { findPosts, mapPost } from "@/lib/posts";

export const dynamic = "force-dynamic";

const indicators = [
  { label: "Selic", value: "10,75%", note: "ao ano" },
  { label: "IPCA 12m", value: "4,38%", note: "acumulado" },
  { label: "Dolar", value: "R$ 5,12", note: "fechamento" },
  { label: "Ibovespa", value: "138.420 pts", note: "ultimo pregao" },
];

export default async function PainelEconomicoPage() {
  const posts = await findPosts({
    where: { published: true, category: "Economia" },
    orderBy: { createdAt: "desc" },
  });

  const mapped = posts.map(mapPost);

  return (
    <div className="min-h-screen text-[#132960]">
      <Header />
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-8 md:px-8">
        <header className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#027DFC]">
            Economia
          </p>
          <h1 className="text-4xl text-[#027DFC] md:text-5xl">Painel economico</h1>
          <p className="max-w-2xl text-sm text-zinc-600">
            Acompanhe os principais indicadores e analises macroeconomicas que impactam diretamente
            os seus investimentos.
          </p>
        </header>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {indicators.map((indicator) => (
            <div
              key={indicator.label}
              className="rounded-2xl border border-[#132960]/15 bg-white p-4"
            >
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                {indicator.label}
              </p>
              <p className="mt-1 text-3xl font-semibold text-[#132960]">{indicator.value}</p>
              <p className="text-xs text-zinc-500">{indicator.note}</p>
            </div>
          ))}
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl text-[#027DFC]">Analises recentes</h2>
          {mapped.length === 0 ? (
            <p className="rounded-xl border border-[#132960]/20 bg-white p-6 text-sm text-zinc-600">
              Nenhuma analise publicada nessa categoria ainda.
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
        </section>

        <NewsletterForm />
      </main>
      <Footer />
    </div>
  );
}
