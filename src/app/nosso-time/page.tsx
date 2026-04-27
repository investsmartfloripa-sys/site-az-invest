import Image from "next/image";
import Link from "next/link";
import { Footer } from "@/components/common/Footer";
import { Header } from "@/components/common/Header";
import { NewsletterForm } from "@/components/home/NewsletterForm";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Nosso time | AZ Invest",
  description:
    "Conheca os economistas, assessores e analistas que produzem o conteudo do AZ Invest.",
};

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export default async function NossoTimePage() {
  const authors = await prisma.author.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { posts: { where: { published: true } } } } },
  });

  return (
    <div className="min-h-screen text-[#132960]">
      <Header />
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-8 md:px-8">
        <header className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#027DFC]">
            Quem somos
          </p>
          <h1 className="text-4xl text-[#027DFC] md:text-5xl">Nosso time</h1>
          <p className="max-w-3xl text-sm text-zinc-600">
            O AZ Invest nasceu para democratizar o conhecimento financeiro e oferecer um caminho
            claro, confiavel e acessivel para quem deseja aprender a investir com seguranca,
            mesmo sem experiencia previa.
          </p>
        </header>

        <section className="rounded-2xl border border-[#132960]/15 bg-white p-6">
          <h2 className="text-2xl text-[#027DFC]">Quem somos</h2>
          <p className="mt-3 max-w-3xl text-sm text-zinc-700">
            Reunimos economistas, assessores de investimentos e analistas com experiencia
            consolidada no mercado financeiro. Nosso compromisso e levar informacao de qualidade
            para que voce tome decisoes financeiras com mais clareza e seguranca.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl text-[#027DFC]">Autores</h2>
          {authors.length === 0 ? (
            <p className="rounded-xl border border-[#132960]/20 bg-white p-6 text-sm text-zinc-600">
              Nenhum autor cadastrado ainda. Use a area restrita para cadastrar.
            </p>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {authors.map((author) => (
                <li key={author.id}>
                  <Link
                    href={`/nosso-time/${author.slug}`}
                    className="flex h-full gap-4 rounded-2xl border border-[#132960]/15 bg-white p-4 transition hover:shadow-md"
                  >
                    <div className="relative h-20 w-20 flex-none overflow-hidden rounded-full bg-[#132960]">
                      {author.photo ? (
                        <Image
                          src={author.photo}
                          alt={author.name}
                          fill
                          sizes="80px"
                          className="object-cover"
                        />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center text-xl font-semibold text-white">
                          {initials(author.name)}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-col gap-1">
                      <h3 className="text-lg font-semibold text-[#132960]">{author.name}</h3>
                      <p className="text-xs font-semibold uppercase tracking-wider text-[#027DFC]">
                        {author.role}
                      </p>
                      {author.bio ? (
                        <p className="line-clamp-3 text-sm text-zinc-600">{author.bio}</p>
                      ) : null}
                      <p className="mt-auto text-[11px] text-zinc-500">
                        {author._count.posts} {author._count.posts === 1 ? "post" : "posts"} publicados
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <NewsletterForm />
      </main>
      <Footer />
    </div>
  );
}
