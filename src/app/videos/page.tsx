import { Footer } from "@/components/common/Footer";
import { Header } from "@/components/common/Header";
import { NewsletterForm } from "@/components/home/NewsletterForm";
import { videos } from "@/data/videos";

export const metadata = {
  title: "Videos | AZ Invest",
  description:
    "Acompanhe as analises e tutoriais em video da equipe AZ Invest sobre economia, mercado e investimentos.",
};

export default function VideosPage() {
  return (
    <div className="min-h-screen text-[#132960]">
      <Header />
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-8 md:px-8">
        <header className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#027DFC]">
            Conteudo em video
          </p>
          <h1 className="text-4xl text-[#027DFC] md:text-5xl">Videos</h1>
          <p className="max-w-2xl text-sm text-zinc-600">
            Analises, tutoriais e bate-papos com especialistas do nosso time. Inscreva-se no
            canal para nao perder nenhum lancamento.
          </p>
        </header>

        <section className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {videos.map((video) => (
            <article
              key={video.id}
              className="overflow-hidden rounded-2xl border border-[#132960]/15 bg-white"
            >
              <div className="relative aspect-video w-full">
                <iframe
                  className="absolute inset-0 h-full w-full"
                  src={`https://www.youtube.com/embed/${video.youtubeId}`}
                  title={video.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              </div>
              <div className="space-y-2 p-4">
                <h3 className="text-lg font-semibold text-[#132960]">{video.title}</h3>
                <p className="text-sm text-zinc-600">{video.description}</p>
                <div className="flex items-center justify-between text-xs text-zinc-500">
                  <span>{new Date(video.publishedAt).toLocaleDateString("pt-BR")}</span>
                  <span>{video.duration}</span>
                </div>
              </div>
            </article>
          ))}
        </section>

        <NewsletterForm />
      </main>
      <Footer />
    </div>
  );
}
