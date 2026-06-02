import Image from "next/image";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slugify";
import { canManageAllAuthors } from "@/lib/workspace/permissions";
import { PhotoField } from "@/components/workspace/PhotoField";

async function createAuthorAction(formData: FormData) {
  "use server";
  const session = await requireSession();
  if (!canManageAllAuthors(session)) redirect("/area-restrita/dashboard");

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
}

async function deleteAuthorAction(formData: FormData) {
  "use server";
  const session = await requireSession();
  if (!canManageAllAuthors(session)) redirect("/area-restrita/dashboard");
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) return;

  await prisma.post.updateMany({ where: { authorId: id }, data: { authorId: null } });
  await prisma.author.delete({ where: { id } });

  revalidatePath("/area-restrita/autores");
  revalidatePath("/nosso-time");
}

const inputClass =
  "mt-1 w-full rounded-md border border-[#132960]/20 bg-white px-3 py-2 text-sm text-[#132960] outline-none focus:border-[#027DFC]";

export default async function AutoresPage() {
  const session = await requireSession();
  if (!canManageAllAuthors(session)) redirect("/area-restrita/dashboard");

  const authors = await prisma.author.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { posts: true } }, workspaceUser: { select: { id: true } } },
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold text-[#132960]">Autores</h1>
      <p className="text-sm text-[#132960]/60">Perfis públicos em Nosso time.</p>

      <section className="mt-6 rounded-lg border border-[#132960]/12 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-[#132960]">Novo autor</h2>
        <form action={createAuthorAction} className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="text-sm text-[#132960]/65">
            Nome
            <input name="name" required className={inputClass} />
          </label>
          <label className="text-sm text-[#132960]/65">
            Cargo
            <input name="role" required placeholder="Economista" className={inputClass} />
          </label>
          <label className="text-sm text-[#132960]/65 md:col-span-2">
            Foto
            <PhotoField />
          </label>
          <label className="text-sm text-[#132960]/65">
            E-mail
            <input name="email" type="email" className={inputClass} />
          </label>
          <label className="text-sm text-[#132960]/65">
            WhatsApp
            <input name="whatsapp" className={inputClass} />
          </label>
          <label className="text-sm text-[#132960]/65 md:col-span-2">
            Bio
            <textarea name="bio" rows={3} className={inputClass} />
          </label>
          <div className="md:col-span-2">
            <button type="submit" className="rounded-md bg-[#027DFC] px-4 py-2 text-sm font-semibold text-white">
              Cadastrar
            </button>
          </div>
        </form>
      </section>

      <section className="mt-8 grid gap-3 md:grid-cols-2">
        {authors.map((author) => (
          <article key={author.id} className="flex gap-3 rounded-lg border border-[#132960]/12 bg-white p-3 shadow-sm">
            <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full bg-[#132960]/10">
              {author.photo ? (
                <Image src={author.photo} alt={author.name} fill sizes="56px" className="object-cover" />
              ) : (
                <span className="flex h-full items-center justify-center text-xs text-[#132960]/55">
                  {author.name.slice(0, 2).toUpperCase()}
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-[#132960]">{author.name}</p>
              <p className="text-xs text-[#132960]/55">
                {author._count.posts} posts
                {author.workspaceUser ? " · login vinculado" : ""}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Link
                  href={`/area-restrita/autores/${author.id}`}
                  className="text-xs text-[#027DFC] hover:underline"
                >
                  Editar
                </Link>
                <Link href={`/nosso-time/${author.slug}`} target="_blank" className="text-xs text-[#132960]/60 hover:underline">
                  Ver página
                </Link>
                <form action={deleteAuthorAction}>
                  <input type="hidden" name="id" value={author.id} />
                  <button type="submit" className="text-xs text-red-600 hover:underline">
                    Excluir
                  </button>
                </form>
              </div>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
