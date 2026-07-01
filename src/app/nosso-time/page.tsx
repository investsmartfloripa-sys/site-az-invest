import Image from "next/image";
import Link from "next/link";
import { Footer } from "@/components/common/Footer";
import { Header } from "@/components/common/Header";
import { CommunityCallout } from "@/components/home/CommunityCallout";
import {
  InstagramIcon,
  LinkedinIcon,
  WhatsappIcon,
  whatsappLink,
} from "@/components/common/SocialIcons";
import { prisma } from "@/lib/prisma";
import { SITE_MAIN_MAX_WIDTH_CLASS } from "@/lib/site-layout";

// DINÂMICA (não ISR): a lista de autores vem do banco e o render tem um
// estado degradado ("Nenhum autor cadastrado") quando a query falha/volta
// vazia. Sob ISR, uma regeneração que pegasse o banco com hiccup assava essa
// lista vazia no cache estático e a servia a todos por até 1h — mesmo com os
// autores no banco. Renderizando por request (query barata), uma falha
// transitória afeta só aquele acesso e o próximo já se corrige.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Nosso time",
  description:
    "Conheça os economistas, assessores e analistas que produzem o conteúdo do AZ Invest.",
};

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

type AuthorWithCount = Awaited<ReturnType<typeof findAuthors>>[number];

function findAuthors() {
  return prisma.author.findMany({
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { posts: { where: { status: "APPROVED", published: true } } } } },
  });
}

export default async function NossoTimePage() {
  // Guard para o prerender de build: banco indisponível degrada para lista vazia.
  let authors: AuthorWithCount[] = [];
  try {
    authors = await findAuthors();
  } catch (err) {
    console.error("[NossoTime] findMany falhou; seguindo sem autores", err);
  }

  return (
    <div className="min-h-screen text-[#132960]">
      <Header />
      <main
        className={`mx-auto flex w-full ${SITE_MAIN_MAX_WIDTH_CLASS} flex-col gap-12 px-4 py-10 md:px-8 md:py-14`}
      >
        <header className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#FF5713]">
            Quem somos
          </p>
          <h1 className="text-4xl font-semibold leading-tight text-[#027DFC] md:text-6xl">
            Nosso time
          </h1>
          <p className="max-w-3xl text-base leading-relaxed text-zinc-700 md:text-lg">
            Reunimos economistas, assessores de investimentos e analistas com experiência
            consolidada no mercado financeiro. Nosso compromisso é levar informação de
            qualidade para que você tome decisões financeiras com mais clareza e segurança.
          </p>
        </header>

        <section className="space-y-5">
          <p className="text-sm text-zinc-500">
            {authors.length} {authors.length === 1 ? "integrante" : "integrantes"}
          </p>

          {authors.length === 0 ? (
            <p className="rounded-xl border border-[#132960]/20 bg-white p-6 text-sm text-zinc-600">
              Nenhum autor cadastrado ainda. Use a área restrita para cadastrar.
            </p>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2">
              {authors.map((author) => {
                const whatsappHref = whatsappLink(author.whatsapp);
                return (
                <li
                  key={author.id}
                  className="group flex h-48 overflow-hidden rounded-2xl border border-[#132960]/15 bg-white transition hover:-translate-y-0.5 hover:border-[#027DFC]/40 hover:shadow-md"
                >
                  <Link
                    href={`/nosso-time/${author.slug}`}
                    aria-label={`Ver currículo de ${author.name}`}
                    className="relative w-36 flex-none self-stretch bg-[#132960] sm:w-40"
                  >
                    {author.photo ? (
                      <Image
                        src={author.photo}
                        alt={author.name}
                        fill
                        sizes="(min-width: 640px) 160px, 144px"
                        className="object-cover"
                      />
                    ) : (
                      <span className="absolute inset-0 flex items-center justify-center text-2xl font-semibold text-white">
                        {initials(author.name)}
                      </span>
                    )}
                  </Link>

                  <div className="flex min-w-0 flex-1 flex-col p-4">
                    <Link
                      href={`/nosso-time/${author.slug}`}
                      className="block min-w-0 flex-1"
                    >
                      <h3 className="truncate text-base font-semibold leading-tight text-[#132960] group-hover:text-[#027DFC]">
                        {author.name}
                      </h3>
                      <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-[#027DFC]">
                        {author.role}
                      </p>
                      {author.headline ? (
                        <p className="mt-2 line-clamp-2 text-xs text-zinc-700">
                          {author.headline}
                        </p>
                      ) : author.bio ? (
                        <p className="mt-2 line-clamp-2 text-xs text-zinc-600">
                          {author.bio}
                        </p>
                      ) : null}
                      <p className="mt-2 text-[11px] text-zinc-500">
                        {author._count.posts}{" "}
                        {author._count.posts === 1 ? "post publicado" : "posts publicados"}
                      </p>
                    </Link>

                    <div className="mt-3 flex items-center justify-between gap-2 border-t border-[#132960]/10 pt-3">
                      <div className="flex items-center gap-1.5">
                        {whatsappHref ? (
                          <a
                            href={whatsappHref}
                            target="_blank"
                            rel="noreferrer"
                            aria-label={`WhatsApp de ${author.name}`}
                            className="flex h-7 w-7 items-center justify-center rounded-full border border-[#132960]/15 text-[#25D366] transition hover:border-[#25D366] hover:bg-[#25D366] hover:text-white"
                          >
                            <WhatsappIcon className="h-3.5 w-3.5" />
                          </a>
                        ) : null}
                        {author.linkedin ? (
                          <a
                            href={author.linkedin}
                            target="_blank"
                            rel="noreferrer"
                            aria-label={`LinkedIn de ${author.name}`}
                            className="flex h-7 w-7 items-center justify-center rounded-full border border-[#132960]/15 text-[#0A66C2] transition hover:border-[#0A66C2] hover:bg-[#0A66C2] hover:text-white"
                          >
                            <LinkedinIcon className="h-3.5 w-3.5" />
                          </a>
                        ) : null}
                        {author.instagram ? (
                          <a
                            href={author.instagram}
                            target="_blank"
                            rel="noreferrer"
                            aria-label={`Instagram de ${author.name}`}
                            className="flex h-7 w-7 items-center justify-center rounded-full border border-[#132960]/15 text-[#E4405F] transition hover:border-[#E4405F] hover:bg-gradient-to-br hover:from-[#feda75] hover:via-[#d62976] hover:to-[#4f5bd5] hover:text-white"
                          >
                            <InstagramIcon className="h-3.5 w-3.5" />
                          </a>
                        ) : null}
                      </div>
                      <Link
                        href={`/nosso-time/${author.slug}`}
                        className="rounded-full bg-[#027DFC]/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#027DFC] transition group-hover:bg-[#027DFC] group-hover:text-white"
                      >
                        Currículo
                      </Link>
                    </div>
                  </div>
                </li>
                );
              })}
            </ul>
          )}
        </section>

        <CommunityCallout />
      </main>
      <Footer />
    </div>
  );
}
