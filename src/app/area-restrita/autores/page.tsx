import Image from "next/image";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slugify";

async function createAuthorAction(formData: FormData) {
  "use server";
  const session = await getSession();
  if (!session) redirect("/area-restrita/login");

  const name = String(formData.get("name") || "").trim();
  const role = String(formData.get("role") || "").trim();
  const bio = String(formData.get("bio") || "").trim();
  const photo = String(formData.get("photo") || "").trim();
  const email = String(formData.get("email") || "").trim();
  const linkedin = String(formData.get("linkedin") || "").trim();
  const instagram = String(formData.get("instagram") || "").trim();
  const whatsapp = String(formData.get("whatsapp") || "").trim();

  if (!name || !role) return;

  const baseSlug = slugify(name);
  let slug = baseSlug;
  let counter = 1;
  while (await prisma.author.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${counter}`;
    counter += 1;
  }

  await prisma.author.create({
    data: {
      slug,
      name,
      role,
      bio: bio || null,
      photo: photo || null,
      email: email || null,
      linkedin: linkedin || null,
      instagram: instagram || null,
      whatsapp: whatsapp || null,
    },
  });

  revalidatePath("/area-restrita/autores");
  revalidatePath("/nosso-time");
  revalidatePath("/area-restrita/painel");
}

async function deleteAuthorAction(formData: FormData) {
  "use server";
  const session = await getSession();
  if (!session) redirect("/area-restrita/login");
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) return;

  await prisma.post.updateMany({ where: { authorId: id }, data: { authorId: null } });
  await prisma.author.delete({ where: { id } });

  revalidatePath("/area-restrita/autores");
  revalidatePath("/nosso-time");
}

export default async function AutoresPage() {
  const session = await getSession();
  if (!session) redirect("/area-restrita/login");

  const authors = await prisma.author.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { posts: true } } },
  });

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 md:px-8">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl text-[#132960]">Autores</h1>
          <p className="text-sm text-zinc-500">
            Cadastre os autores que assinam os posts e aparecem em Nosso time.
          </p>
        </div>
        <Link
          href="/area-restrita/painel"
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
        >
          Voltar ao painel
        </Link>
      </div>

      <section className="rounded-xl border border-[#132960]/20 bg-white p-5">
        <h2 className="text-xl text-[#132960]">Novo autor</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Apos cadastrar, clique em <strong>Editar</strong> para preencher cargo
          profissional, experiencias e formacao.
        </p>
        <form action={createAuthorAction} className="mt-4 grid gap-3 md:grid-cols-2">
          <input
            name="name"
            required
            placeholder="Nome completo"
            className="h-10 rounded-md border border-zinc-300 px-3 text-sm"
          />
          <input
            name="role"
            required
            placeholder="Cargo (ex: Economista)"
            className="h-10 rounded-md border border-zinc-300 px-3 text-sm"
          />
          <input
            name="photo"
            placeholder="URL da foto (opcional)"
            className="h-10 rounded-md border border-zinc-300 px-3 text-sm md:col-span-2"
          />
          <input
            name="email"
            type="email"
            placeholder="Email profissional (recebe leads do site)"
            className="h-10 rounded-md border border-zinc-300 px-3 text-sm"
          />
          <input
            name="whatsapp"
            placeholder="WhatsApp (ex: +5548999386708)"
            className="h-10 rounded-md border border-zinc-300 px-3 text-sm"
          />
          <input
            name="linkedin"
            placeholder="LinkedIn URL (opcional)"
            className="h-10 rounded-md border border-zinc-300 px-3 text-sm"
          />
          <input
            name="instagram"
            placeholder="Instagram URL (opcional)"
            className="h-10 rounded-md border border-zinc-300 px-3 text-sm md:col-span-2"
          />
          <textarea
            name="bio"
            placeholder="Bio (opcional)"
            className="min-h-28 rounded-md border border-zinc-300 px-3 py-2 text-sm md:col-span-2"
          />
          <div className="md:col-span-2">
            <button
              type="submit"
              className="rounded-md bg-[#132960] px-4 py-2 text-sm font-semibold text-white"
            >
              Cadastrar autor
            </button>
          </div>
        </form>
      </section>

      <section className="mt-8 rounded-xl border border-[#132960]/20 bg-white p-5">
        <h2 className="text-xl text-[#132960]">Autores cadastrados</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {authors.map((author) => (
            <article
              key={author.id}
              className="flex gap-3 rounded-lg border border-zinc-200 p-3"
            >
              <div className="relative h-16 w-16 flex-none overflow-hidden rounded-full bg-zinc-200">
                {author.photo ? (
                  <Image
                    src={author.photo}
                    alt={author.name}
                    fill
                    sizes="64px"
                    className="object-cover"
                  />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-sm font-semibold text-zinc-500">
                    {author.name
                      .split(" ")
                      .slice(0, 2)
                      .map((p) => p[0])
                      .join("")
                      .toUpperCase()}
                  </span>
                )}
              </div>
              <div className="flex-1 space-y-1">
                <p className="font-semibold text-[#132960]">{author.name}</p>
                <p className="text-xs text-zinc-500">{author.role}</p>
                <p className="text-xs text-zinc-500">
                  /nosso-time/{author.slug} | {author._count.posts} posts
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/area-restrita/autores/${author.id}`}
                    className="rounded-md border border-[#132960]/30 px-2 py-0.5 text-xs font-semibold text-[#132960] hover:bg-[#132960]/5"
                  >
                    Editar
                  </Link>
                  <Link
                    href={`/nosso-time/${author.slug}`}
                    className="text-xs text-[#027DFC] hover:underline"
                    target="_blank"
                  >
                    Ver pagina
                  </Link>
                  <form action={deleteAuthorAction}>
                    <input type="hidden" name="id" value={author.id} />
                    <button
                      type="submit"
                      className="rounded-md border border-red-200 px-2 py-0.5 text-xs text-red-600 hover:bg-red-50"
                    >
                      Excluir
                    </button>
                  </form>
                </div>
              </div>
            </article>
          ))}
          {authors.length === 0 ? (
            <p className="text-sm text-zinc-500">Nenhum autor cadastrado.</p>
          ) : null}
        </div>
      </section>
    </main>
  );
}
