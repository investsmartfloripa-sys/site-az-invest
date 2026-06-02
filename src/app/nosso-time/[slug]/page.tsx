import { notFound } from "next/navigation";
import { AuthorHero } from "@/components/assessor/AuthorHero";
import { Footer } from "@/components/common/Footer";
import { Header } from "@/components/common/Header";
import { PostCard } from "@/components/common/PostCard";
import { parseSpecialties } from "@/lib/authors";
import { prisma } from "@/lib/prisma";
import { SITE_MAIN_MAX_WIDTH_CLASS } from "@/lib/site-layout";

export const dynamic = "force-dynamic";

const FALLBACK_IMAGE =
  "https://investimentosdeaz.com.br/wp-content/uploads/2026/03/Seguros-1024x666.png";

function normalizeWhatsapp(value: string | null | undefined) {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  if (digits.length < 10) return null;
  return digits;
}

async function registerWhatsappClickAction(
  authorId: number,
  name: string,
  visitorPhone?: string,
) {
  "use server";

  if (!Number.isInteger(authorId)) return "";
  const trimmed = name.trim();
  if (!trimmed) return "";

  const normalizedVisitorPhone =
    normalizeWhatsapp(visitorPhone?.trim() || null) ?? null;

  const author = await prisma.author.findUnique({
    where: { id: authorId },
    select: { id: true, name: true, whatsapp: true },
  });
  if (!author) return "";

  const digits = normalizeWhatsapp(author.whatsapp);

  await prisma.authorWhatsappClick.create({
    data: {
      authorId: author.id,
      name: trimmed,
      phone: normalizedVisitorPhone,
    },
  });

  if (!digits) return "";

  const visitorLine = normalizedVisitorPhone
    ? ` Meu telefone: ${normalizedVisitorPhone}.`
    : "";
  const greeting = encodeURIComponent(
    `Ola ${author.name.split(" ")[0]}, sou ${trimmed} e vim pelo site Investimentos de A a Z.${visitorLine}`,
  );
  return `https://wa.me/${digits}?text=${greeting}`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const author = await prisma.author.findUnique({ where: { slug } });
  if (!author) return { title: "Autor nao encontrado | AZ Invest" };
  return {
    title: `${author.name} | AZ Invest`,
    description:
      author.bio ?? author.headline ?? `Artigos publicados por ${author.name}`,
  };
}

export default async function AuthorPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const author = await prisma.author.findUnique({
    where: { slug },
    include: {
      posts: {
        where: { published: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!author) notFound();

  const specialties = parseSpecialties(author.specialtiesJson);
  const whatsappDigits = normalizeWhatsapp(author.whatsapp);
  const fallbackWhatsappUrl = whatsappDigits
    ? `https://wa.me/${whatsappDigits}`
    : "";

  const mappedPosts = author.posts.map((post) => ({
    id: post.id,
    title: post.title,
    slug: post.slug,
    category: post.category,
    authorName: author.name,
    excerpt: post.excerpt,
    date: new Date(post.createdAt).toLocaleDateString("pt-BR"),
    image: post.coverImage || FALLBACK_IMAGE,
  }));

  const firstName = author.name.split(" ")[0];

  return (
    <div className="min-h-screen text-[#132960]">
      <Header />

      <AuthorHero
        author={{
          id: author.id,
          name: author.name,
          role: author.role,
          headline: author.headline,
          photo: author.photo,
          linkedin: author.linkedin,
          instagram: author.instagram,
        }}
        specialties={specialties}
        whatsappDigits={whatsappDigits}
        fallbackWhatsappUrl={fallbackWhatsappUrl}
        registerClickAction={registerWhatsappClickAction}
      />

      <main
        className={`mx-auto flex w-full ${SITE_MAIN_MAX_WIDTH_CLASS} flex-col gap-6 px-4 py-6 md:gap-7 md:px-6 md:py-8`}
      >
        {author.bio ? (
          <section className="rounded-xl border border-[#132960]/15 bg-white p-4 shadow-sm md:p-5">
            <div className="space-y-0.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#027DFC] md:text-[11px]">
                Quem e
              </p>
              <h2 className="text-xl font-medium text-[#132960] md:text-2xl">
                Sobre {firstName}
              </h2>
            </div>
            <p className="mt-2 whitespace-pre-line text-xs leading-relaxed text-zinc-700 md:text-sm">
              {author.bio}
            </p>
          </section>
        ) : null}

        <section className="space-y-3">
          <div className="space-y-0.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#FF5713] md:text-[11px]">
              Conteudo autoral
            </p>
            <h2 className="text-xl font-medium text-[#132960] md:text-2xl">
              Artigos desta pessoa
            </h2>
          </div>
          {mappedPosts.length === 0 ? (
            <p className="rounded-xl border border-[#132960]/20 bg-white px-4 py-3 text-sm text-zinc-600">
              {firstName} ainda nao publicou nenhum artigo por aqui.
            </p>
          ) : (
            <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {mappedPosts.map((post) => (
                <li key={post.id}>
                  <PostCard post={post} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
      <Footer />
    </div>
  );
}
