import { Footer } from "@/components/common/Footer";
import { Header } from "@/components/common/Header";
import { SITE_MAIN_MAX_WIDTH_CLASS } from "@/lib/site-layout";

/** Skeleton do hub de conteúdo (artigos, vídeos e periódicos). */
export default function ConteudoLoading() {
  return (
    <div className="min-h-screen text-[#132960]">
      <Header />
      <main
        className={`mx-auto flex w-full ${SITE_MAIN_MAX_WIDTH_CLASS} flex-col gap-10 px-4 py-10 md:px-8`}
      >
        <div className="space-y-3">
          <div className="h-4 w-32 animate-pulse rounded-full bg-zinc-100" />
          <div className="h-10 w-80 max-w-full animate-pulse rounded-2xl bg-zinc-100" />
        </div>
        {Array.from({ length: 3 }).map((_, section) => (
          <section key={section} className="space-y-4">
            <div className="h-6 w-56 animate-pulse rounded-full bg-zinc-100" />
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="space-y-3">
                  <div className="aspect-[16/9] animate-pulse rounded-2xl bg-zinc-100" />
                  <div className="h-5 w-3/4 animate-pulse rounded-full bg-zinc-100" />
                </div>
              ))}
            </div>
          </section>
        ))}
      </main>
      <Footer />
    </div>
  );
}
