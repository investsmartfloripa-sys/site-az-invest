import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Footer } from "@/components/common/Footer";
import { Header } from "@/components/common/Header";
import { PostMarkdownBody } from "@/components/blog/PostMarkdownBody";
import {
  formatDateBR,
  getBriefing,
  listBriefingDates,
} from "@/lib/cafe-com-mercado";

type Props = {
  params: Promise<{ date: string }>;
};

export async function generateStaticParams() {
  const dates = await listBriefingDates();
  return dates.map((date) => ({ date }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { date } = await params;
  const briefing = await getBriefing(date);
  if (!briefing) return { title: "Briefing não encontrado" };

  const ogImage = briefing.image || "/opengraph-image.png";

  return {
    title: briefing.title,
    description: briefing.description,
    openGraph: {
      images: [{ url: ogImage, alt: briefing.imageAlt || briefing.title }],
      title: briefing.title,
      description: briefing.description,
      type: "article",
      publishedTime: briefing.publishedAt || undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: briefing.title,
      description: briefing.description,
      images: [ogImage],
    },
  };
}

export default async function MorningCallPage({ params }: Props) {
  const { date } = await params;
  const briefing = await getBriefing(date);
  if (!briefing) notFound();

  const allDates = await listBriefingDates();
  const idx = allDates.indexOf(date);
  // allDates está em ordem decrescente — índice maior = data mais antiga.
  const prev = idx >= 0 && idx < allDates.length - 1 ? allDates[idx + 1] : null;
  const next = idx > 0 ? allDates[idx - 1] : null;

  return (
    <div className="min-h-screen text-[#132960]">
      <Header />
      <main className="mx-auto w-full max-w-3xl px-4 py-8 md:px-8">
        <Link href="/cafe-com-mercado" className="text-sm text-[#027DFC] hover:underline">
          {"<-"} Voltar para Café com Mercado
        </Link>

        <article className="az-card mt-6 space-y-4 p-6 md:p-10">
          {briefing.image ? (
            <div className="relative aspect-[1200/630] w-full overflow-hidden rounded-2xl">
              <Image
                src={briefing.image}
                alt={briefing.imageAlt || briefing.title}
                fill
                priority
                sizes="(max-width: 768px) 100vw, 768px"
                className="object-cover"
              />
            </div>
          ) : null}
          <p className="text-xs font-semibold uppercase tracking-wider text-[#027DFC]">
            {briefing.weekday ? `${briefing.weekday}, ` : ""}
            {formatDateBR(briefing.date)}
          </p>
          <h1 className="text-4xl font-semibold text-[#132960] md:text-5xl">
            {briefing.title}
          </h1>
          {briefing.hora ? (
            <p className="text-sm text-zinc-600">{briefing.hora}</p>
          ) : null}
          {briefing.description ? (
            <p className="border-y border-[#132960]/10 py-3 text-lg text-zinc-700">
              {briefing.description}
            </p>
          ) : null}

          <div className="pt-2">
            <PostMarkdownBody markdown={briefing.body} />
          </div>
        </article>

        <nav className="mt-10 flex flex-col gap-3 text-sm sm:flex-row sm:justify-between">
          {prev ? (
            <Link
              href={`/cafe-com