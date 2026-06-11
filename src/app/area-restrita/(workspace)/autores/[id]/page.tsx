import Link from "next/link";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  parseEducation,
  parseExperiences,
  parseSpecialties,
  serializeEducation,
  serializeExperiences,
  serializeSpecialties,
  type AuthorEducation,
  type AuthorExperience,
  type AuthorSpecialty,
} from "@/lib/authors";
import { canManageAllAuthors } from "@/lib/workspace/permissions";
import {
  EducationEditor,
  ExperienceEditor,
  SpecialtyEditor,
} from "@/components/workspace/AuthorListEditor";
import { PhotoField } from "@/components/workspace/PhotoField";
import { SubmitButton } from "@/components/workspace/SubmitButton";

async function updateAuthorAction(formData: FormData) {
  "use server";
  const session = await requireSession();
  if (!canManageAllAuthors(session)) redirect("/area-restrita/dashboard");

  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) return;

  const name = String(formData.get("name") || "").trim();
  const role = String(formData.get("role") || "").trim();
  const headline = String(formData.get("headline") || "").trim();
  const bio = String(formData.get("bio") || "").trim();
  const photo = String(formData.get("photo") || "").trim();
  const email = String(formData.get("email") || "").trim();
  const linkedin = String(formData.get("linkedin") || "").trim();
  const instagram = String(formData.get("instagram") || "").trim();
  const whatsapp = String(formData.get("whatsapp") || "").trim();
  const experiencesRaw = String(formData.get("experiencesJson") || "[]");
  const educationRaw = String(formData.get("educationJson") || "[]");
  const specialtiesRaw = String(formData.get("specialtiesJson") || "[]");

  if (!name || !role) return;

  let experiences: AuthorExperience[] = [];
  let education: AuthorEducation[] = [];
  let specialties: AuthorSpecialty[] = [];
  try {
    const parsed = JSON.parse(experiencesRaw);
    if (Array.isArray(parsed)) {
      experiences = parsed.map((item) => ({
        org: String(item?.org ?? ""),
        title: String(item?.title ?? ""),
        description: String(item?.description ?? ""),
      }));
    }
  } catch {}
  try {
    const parsed = JSON.parse(educationRaw);
    if (Array.isArray(parsed)) {
      education = parsed.map((item) => ({
        title: String(item?.title ?? ""),
        institution: String(item?.institution ?? ""),
        period: String(item?.period ?? ""),
        description: String(item?.description ?? ""),
      }));
    }
  } catch {}
  try {
    const parsed = JSON.parse(specialtiesRaw);
    if (Array.isArray(parsed)) {
      specialties = parsed.map((item) => ({
        title: String(item?.title ?? ""),
        description: String(item?.description ?? ""),
      }));
    }
  } catch {}

  const updated = await prisma.author.update({
    where: { id },
    data: {
      name,
      role,
      headline: headline || null,
      bio: bio || null,
      photo: photo || null,
      email: email || null,
      linkedin: linkedin || null,
      instagram: instagram || null,
      whatsapp: whatsapp || null,
      experiencesJson: serializeExperiences(experiences),
      educationJson: serializeEducation(education),
      specialtiesJson: serializeSpecialties(specialties),
    },
  });

  revalidatePath("/area-restrita/autores");
  revalidatePath(`/area-restrita/autores/${updated.id}`);
  revalidatePath("/nosso-time");
  revalidatePath(`/nosso-time/${updated.slug}`);
  redirect(`/area-restrita/autores/${updated.id}?ok=1`);
}

const inputClass =
  "mt-1 w-full rounded-md border border-[#132960]/20 bg-white px-3 py-2 text-sm text-[#132960] outline-none focus:border-[#027DFC]";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditAuthorPage({ params }: PageProps) {
  const session = await requireSession();
  if (!canManageAllAuthors(session)) redirect("/area-restrita/dashboard");

  const { id } = await params;
  const numericId = Number(id);
  if (!Number.isInteger(numericId)) notFound();

  const author = await prisma.author.findUnique({ where: { id: numericId } });
  if (!author) notFound();

  const experiences = parseExperiences(author.experiencesJson);
  const education = parseEducation(author.educationJson);
  const specialties = parseSpecialties(author.specialtiesJson);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[#132960]">{author.name}</h1>
          <Link href={`/nosso-time/${author.slug}`} target="_blank" className="text-sm text-[#027DFC] hover:underline">
            Ver página pública
          </Link>
        </div>
        <Link href="/area-restrita/autores" className="text-sm text-[#132960]/60 hover:text-[#132960]">
          Voltar
        </Link>
      </div>

      <form action={updateAuthorAction} className="space-y-6">
        <input type="hidden" name="id" value={author.id} />

        <section className="space-y-3 rounded-lg border border-[#132960]/12 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-[#132960]">Identidade</h2>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-sm text-[#132960]/65">
              Nome
              <input name="name" required defaultValue={author.name} className={inputClass} />
            </label>
            <label className="text-sm text-[#132960]/65">
              Cargo (card)
              <input name="role" required defaultValue={author.role} className={inputClass} />
            </label>
            <label className="text-sm text-[#132960]/65 md:col-span-2">
              Headline
              <input name="headline" defaultValue={author.headline ?? ""} className={inputClass} />
            </label>
            <label className="text-sm text-[#132960]/65 md:col-span-2">
              Foto
              <PhotoField defaultValue={author.photo ?? ""} />
            </label>
            <label className="text-sm text-[#132960]/65">
              E-mail
              <input name="email" type="email" defaultValue={author.email ?? ""} className={inputClass} />
            </label>
            <label className="text-sm text-[#132960]/65">
              WhatsApp
              <input name="whatsapp" defaultValue={author.whatsapp ?? ""} className={inputClass} />
            </label>
            <label className="text-sm text-[#132960]/65">
              LinkedIn
              <input name="linkedin" defaultValue={author.linkedin ?? ""} className={inputClass} />
            </label>
            <label className="text-sm text-[#132960]/65">
              Instagram
              <input name="instagram" defaultValue={author.instagram ?? ""} className={inputClass} />
            </label>
            <label className="text-sm text-[#132960]/65 md:col-span-2">
              Bio
              <textarea name="bio" defaultValue={author.bio ?? ""} rows={4} className={inputClass} />
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

        <SubmitButton className="rounded-md bg-[#027DFC] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#0268d4]">
          Salvar
        </SubmitButton>
      </form>
    </div>
  );
}
