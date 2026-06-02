import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  parseEducation,
  parseExperiences,
  parseSpecialties,
} from "@/lib/authors";
import { updateOwnProfileAction } from "@/lib/workspace/profile-actions";
import {
  EducationEditor,
  ExperienceEditor,
  SpecialtyEditor,
} from "@/components/workspace/AuthorListEditor";

export default async function PerfilPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const session = await requireSession();
  if (session.role !== "AUTHOR") redirect("/area-restrita/dashboard");
  if (!session.authorId) {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-[#132960]">Perfil</h1>
        <p className="mt-4 rounded-md bg-amber-50 px-3 py-2 text-amber-800">
          Sua conta ainda não está vinculada a um perfil de autor. Peça ao admin para
          configurar em Usuários.
        </p>
      </div>
    );
  }

  const author = await prisma.author.findUnique({ where: { id: session.authorId } });
  if (!author) notFound();

  const params = await searchParams;
  const experiences = parseExperiences(author.experiencesJson);
  const education = parseEducation(author.educationJson);
  const specialties = parseSpecialties(author.specialtiesJson);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-[#132960]">Meu perfil</h1>
      <p className="mt-1 text-sm text-[#132960]/60">
        Página pública:{" "}
        <Link href={`/nosso-time/${author.slug}`} target="_blank" className="text-[#027DFC]">
          /nosso-time/{author.slug}
        </Link>
      </p>

      {params.ok ? (
        <p className="mt-4 rounded-md bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700">
          Perfil atualizado.
        </p>
      ) : null}

      <form action={updateOwnProfileAction} className="mt-6 space-y-6">
        <section className="space-y-3 rounded-lg border border-[#132960]/12 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-[#132960]">Identidade</h2>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="block text-sm">
              <span className="text-[#132960]/65">Nome</span>
              <input
                name="name"
                required
                defaultValue={author.name}
                className="mt-1 w-full rounded-md border border-[#132960]/20 bg-white px-3 py-2 text-[#132960] outline-none focus:border-[#027DFC]"
              />
            </label>
            <label className="block text-sm">
              <span className="text-[#132960]/65">Cargo (card)</span>
              <input
                name="role"
                required
                defaultValue={author.role}
                className="mt-1 w-full rounded-md border border-[#132960]/20 bg-white px-3 py-2 text-[#132960] outline-none focus:border-[#027DFC]"
              />
            </label>
            <label className="block text-sm md:col-span-2">
              <span className="text-[#132960]/65">Headline</span>
              <input
                name="headline"
                defaultValue={author.headline ?? ""}
                className="mt-1 w-full rounded-md border border-[#132960]/20 bg-white px-3 py-2 text-[#132960] outline-none focus:border-[#027DFC]"
              />
            </label>
            <label className="block text-sm md:col-span-2">
              <span className="text-[#132960]/65">Foto (URL)</span>
              <input
                name="photo"
                defaultValue={author.photo ?? ""}
                className="mt-1 w-full rounded-md border border-[#132960]/20 bg-white px-3 py-2 text-[#132960] outline-none focus:border-[#027DFC]"
              />
            </label>
            <label className="block text-sm">
              <span className="text-[#132960]/65">E-mail</span>
              <input
                name="email"
                type="email"
                defaultValue={author.email ?? ""}
                className="mt-1 w-full rounded-md border border-[#132960]/20 bg-white px-3 py-2 text-[#132960] outline-none focus:border-[#027DFC]"
              />
            </label>
            <label className="block text-sm">
              <span className="text-[#132960]/65">WhatsApp</span>
              <input
                name="whatsapp"
                defaultValue={author.whatsapp ?? ""}
                className="mt-1 w-full rounded-md border border-[#132960]/20 bg-white px-3 py-2 text-[#132960] outline-none focus:border-[#027DFC]"
              />
            </label>
            <label className="block text-sm">
              <span className="text-[#132960]/65">LinkedIn</span>
              <input
                name="linkedin"
                defaultValue={author.linkedin ?? ""}
                className="mt-1 w-full rounded-md border border-[#132960]/20 bg-white px-3 py-2 text-[#132960] outline-none focus:border-[#027DFC]"
              />
            </label>
            <label className="block text-sm">
              <span className="text-[#132960]/65">Instagram</span>
              <input
                name="instagram"
                defaultValue={author.instagram ?? ""}
                className="mt-1 w-full rounded-md border border-[#132960]/20 bg-white px-3 py-2 text-[#132960] outline-none focus:border-[#027DFC]"
              />
            </label>
            <label className="block text-sm md:col-span-2">
              <span className="text-[#132960]/65">Bio</span>
              <textarea
                name="bio"
                defaultValue={author.bio ?? ""}
                rows={4}
                className="mt-1 w-full rounded-md border border-[#132960]/20 bg-white px-3 py-2 text-[#132960] outline-none focus:border-[#027DFC]"
              />
            </label>
          </div>
        </section>

        <section className="rounded-lg border border-[#132960]/12 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-[#132960]">Especialidades</h2>
          <SpecialtyEditor initial={specialties} hiddenName="specialtiesJson" />
        </section>

        <section className="rounded-lg border border-[#132960]/12 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-[#132960]">Experiências</h2>
          <ExperienceEditor initial={experiences} hiddenName="experiencesJson" />
        </section>

        <section className="rounded-lg border border-[#132960]/12 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-[#132960]">Formação</h2>
          <EducationEditor initial={education} hiddenName="educationJson" />
        </section>

        <button
          type="submit"
          className="rounded-md bg-[#027DFC] px-4 py-2 text-sm font-semibold text-white"
        >
          Salvar perfil
        </button>
      </form>
    </div>
  );
}
