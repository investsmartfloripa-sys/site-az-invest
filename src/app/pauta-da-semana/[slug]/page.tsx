import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Footer } from "@/components/common/Footer";
import { Header } from "@/components/common/Header";
import { PostMarkdownBody } from "@/components/blog/PostMarkdownBody";
import { getPauta, listPautaSlugs } from "@/lib/pauta-da-semana";
import { formatDateBR } from "@/lib/cafe-com-mercado";

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateStaticParams() {
  const slugs = await listPautaSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const pauta = await getPauta(slug);
  if (!pauta) return { title: "Pauta não encontrada" };

  return {
    title: pauta.title,
    description: pauta.description,
    openGraph: { images: ["/opengraph-image.png"],
      title: pauta.title,
      description: pauta.description,
      type: "article",
      publishedTime: pauta.publishedAt || undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: pauta.title,
      description: pauta.description,
    },
  };
}

function extractYouTubeId(url: string): string | null {
  if (!url) return null;
  const patterns = [
    /youtube\.com\/watch\?v=([\w-]{11})/,
    /youtu\.be\/([\w-]{11})/,
    /youtube\.com\/embed\/([\w-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

export default async function PautaPage({ params }: Props) {
  const { slug } = await params;
  const pauta = await getPauta(slug);
  if (!pauta) notFound();

  const allSlugs = await listPautaSlugs();
  const idx = allSlugs.indexOf(slug);
  const prev = idx >= 0 && idx < allSlugs.length - 1 ? allSlugs[idx + 1] : null;
  const next = idx > 0 ? allSlugs[idx - 1] : null;
  const ytId = pauta.videoUrl ? extractYouTubeId(pauta.videoUrl) : null;

  return (
    <div className="min-h-screen text-[#132960]">
      <Header />
      <main className="mx-auto w-full max-w-3xl px-4 py-8 md:px-8">
        <Link href="/pauta-da-semana" className="text-sm text-[#027DFC] hover:underline">
          {"<-"} Voltar para Pauta da Semana
        </Link>

        <article className="az-card mt-6 space-y-4 p-6 md:p-10">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#027DFC]">
            Semana de {formatDateBR(pauta.date)}
          </p>
          <h1 className="text-4xl font-semibold text-[#132960] md:text-5xl">
            {pauta.title}
          </h1>
          {pauta.description ? (
            <p className="border-y border-[#132960]/10 py-3 text-lg text-zinc-700">
              {pauta.description}
            </p>
          ) : null}

          {ytId ? (
            <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-[#132960]/15">
              <iframe
                src={`https://www.youtube.com/embed/${ytId}`}
                title={pauta.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="absolute inset-0 h-full w-full"
              />
            </div>
          ) : null}

          <div className="pt-2">
            <PostMarkdownBody markdown={pauta.body} />
          </div>
        </article>

        <nav className="mt-10 flex flex-col gap-3 text-sm sm:flex-row sm:justify-between">
          {prev ? (
            <Link
              href={`/pauta-da-semana/${prev}`}
              className="text-[#027DFC] hover:underline"
            >
              {"<-"} Pauta anterior
            </Link>
          ) : (
            <span />
          )}
          {next ? (
            <Link
              href={`/pauta-da-semana/${next}`}
              className="text-[#027DFC] hover:underline sm:text-right"
            >
              Pauta seguinte {"->"}
            </Link>
          ) : (
            <span />
          )}
        </nav>
      </main>
      <Footer />
    </div>
  );
}
