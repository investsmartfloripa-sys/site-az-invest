import { Footer } from "@/components/common/Footer";
import { Header } from "@/components/common/Header";

/** Skeleton do artigo individual (capa + corpo). */
export default function BlogPostLoading() {
  return (
    <div className="min-h-screen text-[#132960]">
      <Header />
      <main className="mx-auto w-full max-w-[60rem] px-4 py-8 md:px-8">
        <div className="h-4 w-40 animate-pulse rounded-full bg-zinc-100" />
        <div className="mt-4 aspect-[21/8] w-full animate-pulse rounded-2xl bg-zinc-100" />
        <div className="mt-6 space-y-4 rounded-2xl bg-zinc-50 p-6 md:p-10">
          <div className="h-6 w-28 animate-pulse rounded-full bg-zinc-100" />
          <div className="h-10 w-5/6 animate-pulse rounded-2xl bg-zinc-100" />
          <div className="h-12 w-64 animate-pulse rounded-2xl bg-zinc-100" />
          <div className="space-y-2 pt-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-4 w-full animate-pulse rounded-full bg-zinc-100" />
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
