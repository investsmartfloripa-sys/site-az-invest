import { Footer } from "@/components/common/Footer";
import { Header } from "@/components/common/Header";
import { SITE_MAIN_MAX_WIDTH_CLASS } from "@/lib/site-layout";

/** Skeleton do time (cobre /nosso-time e /nosso-time/[slug]). */
export default function NossoTimeLoading() {
  return (
    <div className="min-h-screen text-[#132960]">
      <Header />
      <main
        className={`mx-auto flex w-full ${SITE_MAIN_MAX_WIDTH_CLASS} flex-col gap-10 px-4 py-10 md:px-8`}
      >
        <div className="space-y-3">
          <div className="h-4 w-32 animate-pulse rounded-full bg-zinc-100" />
          <div className="h-10 w-96 max-w-full animate-pulse rounded-2xl bg-zinc-100" />
          <div className="h-4 w-72 max-w-full animate-pulse rounded-full bg-zinc-100" />
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="space-y-3 rounded-2xl border border-[#132960]/10 bg-white p-5">
              <div className="h-16 w-16 animate-pulse rounded-full bg-zinc-100" />
              <div className="h-5 w-2/3 animate-pulse rounded-full bg-zinc-100" />
              <div className="h-4 w-1/2 animate-pulse rounded-full bg-zinc-100" />
            </div>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
}
