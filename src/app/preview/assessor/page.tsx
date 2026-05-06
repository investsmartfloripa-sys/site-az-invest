import Link from "next/link";
import { notFound } from "next/navigation";

import { Footer } from "@/components/common/Footer";
import { Header } from "@/components/common/Header";
import { PostCard } from "@/components/common/PostCard";
import { WhatsappContactCta } from "@/components/assessor/WhatsappContactCta";
import {
  HeroVariantA,
  HeroVariantB,
  HeroVariantC,
  HeroVariantD,
  type HeroAuthor,
  type HeroVariantProps,
} from "@/components/assessor/HeroVariants";
import {
  parseEducation,
  parseExperiences,
  parseSpecialties,
} from "@/lib/authors";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Preview hero do assessor | AZ Invest",
  description: "Comparativo das 4 variantes de hero da landing do assessor.",
  robots: { index: false, follow: false },
};

const FALLBACK_IMAGE =
  "https://investimentosdeaz.com.br/wp-content/uploads/2026/03/Seguros-1024x666.png";

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

const VARIANTS: Record<
  string,
  {
    label: string;
    title: string;
    Component: (props: HeroVariantProps) => React.ReactNode;
  }
> = {
  A: { label: "A", title: "Vertical centralizado", Component: HeroVariantA },
  B: { label: "B", title: "Horizontal compacto", Component: HeroVariantB },
  C: { label: "C", title: "Foto banner no topo", Component: HeroVariantC },
  D: { label: "D", title: "Card unico compacto", Component: HeroVariantD },
};

type SearchParams = Promise<{ slug?: string; variant?: string }>;

export default async function PreviewAssessorPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { slug = "arthur-borba", variant = "A" } = await searchParams;
  const variantKey = (variant.toUpperCase() in VARIANTS
    ? variant.toUpperCase()
    : "A") as keyof typeof VARIANTS;
  const { Component: Hero, label, title } = VARIANTS[variantKey];

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

  const experiences = parseExperiences(author.experiencesJson);
  const education = parseEducation(author.educationJson);
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

  const heroAuthor: HeroAuthor = {
    id: author.id,
    name: author.name,
    role: author.role,
    headline: author.headline,
    photo: author.photo,
    linkedin: author.linkedin,
    instagram: author.instagram,
  };

  return (
    <div className="min-h-screen bg-white text-[#132960]">
      <Header />

      <PreviewSwitcher slug={slug} active={variantKey} />

      <Hero
        author={heroAuthor}
        whatsappDigits={whatsappDigits}
        fallbackWhatsappUrl={fallbackWhatsappUrl}
        registerClickAction={registerWhatsappClickAction}
      />

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-10 md:px-8 md:py-14">
        <section className="grid gap-4 md:grid-cols-2">
          <article className="space-y-4 rounded-2xl border border-[#132960]/15 bg-white p-6 shadow-sm">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#FF5713]">
                Como posso ajudar
              </p>
              <h2 className="text-3xl text-[#132960]">Especialidades</h2>
            </div>
            {specialties.length > 0 ? (
              <ul className="grid gap-3">
                {specialties.map((item, i) => (
                  <li
                    key={i}
                    className="flex flex-col gap-2 rounded-xl border border-[#132960]/10 bg-[#f8fbff] p-4"
                  >
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#FF5713]/10 text-xs font-semibold text-[#FF5713]">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      {item.title ? (
                        <h3 className="text-base font-semibold text-[#132960]">
                          {item.title}
                        </h3>
                      ) : null}
                    </div>
                    {item.description ? (
                      <p className="text-sm leading-relaxed text-zinc-700">
                        {item.description}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-md border border-dashed border-[#132960]/20 bg-[#f8fbff] px-4 py-3 text-sm text-zinc-500">
                Especialidades em breve.
              </p>
            )}
          </article>

          <article className="space-y-4 rounded-2xl border border-[#132960]/15 bg-white p-6 shadow-sm">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#027DFC]">
                Background academico
              </p>
              <h2 className="text-3xl text-[#132960]">Formacao</h2>
            </div>
            {education.length > 0 ? (
              <ul className="grid gap-3">
                {education.map((edu, i) => (
                  <li
                    key={i}
                    className="rounded-xl border border-[#132960]/10 bg-[#f8fbff] p-4"
                  >
                    {edu.title ? (
                      <p className="font-semibold text-[#132960]">{edu.title}</p>
                    ) : null}
                    {edu.institution ? (
                      <p className="text-sm text-zinc-600">{edu.institution}</p>
                    ) : null}
                    {edu.description ? (
                      <p className="mt-1 text-sm leading-relaxed text-zinc-700">
                        {edu.description}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-md border border-dashed border-[#132960]/20 bg-[#f8fbff] px-4 py-3 text-sm text-zinc-500">
                Formacao academica em breve.
              </p>
            )}
          </article>
        </section>

        {author.bio ? (
          <section className="rounded-2xl border border-[#132960]/15 bg-white p-6 shadow-sm">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#027DFC]">
                Quem e
              </p>
              <h2 className="text-3xl text-[#132960]">Sobre {firstName}</h2>
            </div>
            <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-zinc-700">
              {author.bio}
            </p>
          </section>
        ) : null}

        {whatsappDigits ? (
          <section
            id="contato"
            className="flex flex-col items-start justify-between gap-3 rounded-xl border border-[#132960]/15 bg-white px-5 py-3 shadow-sm md:flex-row md:items-center md:gap-6"
          >
            <p className="text-sm text-[#132960]/80">
              Quer falar diretamente com {firstName}?
            </p>
            <WhatsappContactCta
              authorId={author.id}
              authorName={author.name}
              whatsappUrl={fallbackWhatsappUrl}
              registerClickAction={registerWhatsappClickAction}
              variant="primary"
              className="!px-4 !py-2 !text-xs"
            />
          </section>
        ) : null}

        {experiences.length > 0 ? (
          <section className="space-y-4">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#FF5713]">
                Trajetoria
              </p>
              <h2 className="text-3xl text-[#132960]">Experiencia profissional</h2>
            </div>
            <ul className="grid gap-4 md:grid-cols-2">
              {experiences.map((exp, i) => (
                <li
                  key={i}
                  className="flex flex-col gap-2 rounded-2xl border border-[#132960]/15 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  {exp.org ? (
                    <p className="text-xs font-semibold uppercase tracking-wider text-[#FF5713]">
                      {exp.org}
                    </p>
                  ) : null}
                  {exp.title ? (
                    <h3 className="text-lg font-semibold text-[#132960]">
                      {exp.title}
                    </h3>
                  ) : null}
                  {exp.description ? (
                    <p className="text-sm leading-relaxed text-zinc-700">
                      {exp.description}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="space-y-4">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#FF5713]">
              Conteudo autoral
            </p>
            <h2 className="text-3xl text-[#132960]">Artigos desta pessoa</h2>
          </div>
          {mappedPosts.length === 0 ? (
            <p className="rounded-xl border border-[#132960]/20 bg-white p-6 text-sm text-zinc-600">
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

      <PreviewBadge active={label} title={title} />
    </div>
  );
}

function PreviewSwitcher({
  slug,
  active,
}: {
  slug: string;
  active: keyof typeof VARIANTS;
}) {
  return (
    <div className="border-b border-amber-200 bg-amber-50">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 py-3 md:flex-row md:items-center md:justify-between md:px-8">
        <p className="text-xs text-amber-900 md:text-sm">
          <strong>Pagina interna</strong> &middot; trocando hero (slug:{" "}
          <code className="rounded bg-amber-200/60 px-1 py-0.5">{slug}</code>)
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {(Object.keys(VARIANTS) as Array<keyof typeof VARIANTS>).map((key) => {
            const isActive = key === active;
            const cfg = VARIANTS[key];
            return (
              <Link
                key={key}
                href={`/preview/assessor?slug=${slug}&variant=${key}`}
                className={
                  "rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wider transition " +
                  (isActive
                    ? "bg-[#132960] text-white shadow-sm"
                    : "border border-[#132960]/20 bg-white text-[#132960] hover:border-[#027DFC] hover:text-[#027DFC]")
                }
              >
                Variante {cfg.label}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function PreviewBadge({ active, title }: { active: string; title: string }) {
  return (
    <div className="pointer-events-none fixed bottom-4 left-1/2 z-40 -translate-x-1/2 rounded-full bg-[#132960] px-4 py-2 text-xs font-semibold text-white shadow-lg">
      Variante {active} &middot; {title}
    </div>
  );
}
