import { notFound } from "next/navigation";

import { Footer } from "@/components/common/Footer";
import { Header } from "@/components/common/Header";
import {
  HeroVariantA,
  HeroVariantB,
  HeroVariantC,
  HeroVariantD,
} from "@/components/assessor/HeroVariants";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Preview hero do assessor | AZ Invest",
  description: "Comparativo das 4 variantes de hero da landing do assessor.",
  robots: { index: false, follow: false },
};

function normalizeWhatsapp(value: string | null | undefined) {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  if (digits.length < 10) return null;
  return digits;
}

async function registerWhatsappClickAction(authorId: number, name: string) {
  "use server";

  if (!Number.isInteger(authorId)) return "";
  const trimmed = name.trim();
  if (!trimmed) return "";

  const author = await prisma.author.findUnique({
    where: { id: authorId },
    select: { id: true, name: true, whatsapp: true },
  });
  if (!author) return "";

  const digits = normalizeWhatsapp(author.whatsapp);

  await prisma.authorWhatsappClick.create({
    data: { authorId: author.id, name: trimmed },
  });

  if (!digits) return "";

  const greeting = encodeURIComponent(
    `Ola ${author.name.split(" ")[0]}, sou ${trimmed} e vim pelo site Investimentos de A a Z.`,
  );
  return `https://wa.me/${digits}?text=${greeting}`;
}

type SearchParams = Promise<{ slug?: string }>;

const VARIANTS = [
  {
    id: "A",
    label: "Variante A",
    title: "Vertical centralizado",
    note: "Mobile com foto centralizada e botao do WhatsApp full-width. Desktop continua com foto a esquerda e conteudo a direita.",
    Component: HeroVariantA,
  },
  {
    id: "B",
    label: "Variante B",
    title: "Horizontal compacto",
    note: "Foto sempre a esquerda (pequena no mobile, maior no desktop). CTAs em uma linha cheia abaixo.",
    Component: HeroVariantB,
  },
  {
    id: "C",
    label: "Variante C",
    title: "Foto banner no topo",
    note: "Foto cobre full-width como banner (estilo perfil de rede social). Conteudo abaixo.",
    Component: HeroVariantC,
  },
  {
    id: "D",
    label: "Variante D",
    title: "Card unico compacto",
    note: "Tudo dentro de um card com sombra. Linha de CTAs separada do bloco identidade.",
    Component: HeroVariantD,
  },
];

export default async function PreviewAssessorPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { slug = "arthur-borba" } = await searchParams;
  const author = await prisma.author.findUnique({ where: { slug } });
  if (!author) notFound();

  const whatsappDigits = normalizeWhatsapp(author.whatsapp);
  const fallbackWhatsappUrl = whatsappDigits
    ? `https://wa.me/${whatsappDigits}`
    : "";

  const heroProps = {
    author: {
      id: author.id,
      name: author.name,
      role: author.role,
      headline: author.headline,
      photo: author.photo,
      linkedin: author.linkedin,
      instagram: author.instagram,
    },
    whatsappDigits,
    fallbackWhatsappUrl,
    registerClickAction: registerWhatsappClickAction,
  };

  return (
    <div className="min-h-screen bg-[#f5f7fb] text-[#132960]">
      <Header />

      <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-center text-xs text-amber-900 md:text-sm">
        <strong>Pagina interna</strong> &middot; comparativo das 4 variantes do
        hero. Nao indexada. Use{" "}
        <code className="rounded bg-amber-200/60 px-1 py-0.5">?slug=...</code>{" "}
        pra trocar de assessor (atual:{" "}
        <code className="rounded bg-amber-200/60 px-1 py-0.5">{slug}</code>).
      </div>

      {VARIANTS.map(({ id, label, title, note, Component }) => (
        <div key={id} className="border-t-4 border-[#027DFC]/20">
          <div className="mx-auto w-full max-w-6xl px-4 pt-6 md:px-8">
            <div className="rounded-2xl bg-[#132960] px-4 py-3 text-white shadow-sm md:px-6 md:py-4">
              <div className="flex flex-col gap-1 md:flex-row md:items-baseline md:gap-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-[#FFB489]">
                  {label}
                </p>
                <p className="text-base font-semibold md:text-lg">{title}</p>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-white/80 md:text-sm">
                {note}
              </p>
            </div>
          </div>

          <div className="mt-4 md:mt-6">
            <Component {...heroProps} />
          </div>
        </div>
      ))}

      <Footer />
    </div>
  );
}
