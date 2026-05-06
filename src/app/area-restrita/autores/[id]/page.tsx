import Link from "next/link";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
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
import {
  EducationEditor,
  ExperienceEditor,
  SpecialtyEditor,
} from "./AuthorListEditor";

async function updateAuthorAction(formData: FormData) {
  "use server";
  const session = await getSession();
  if (!session) redirect("/area-restrita/login");

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

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string }>;
};

export default async function EditAuthorPage({ params, searchParams }: PageProps) {
  const session = await getSession();
  if (!session) redirect("/area-restrita/login");

  const { id } = await params;
  const { ok } = await searchParams;
  const numericId = Number(id);
  if (!Number.isInteger(numericId)) notFound();

  const author = await prisma.author.findUnique({ where: { id: numericId } });
  if (!author) notFound();

  const experiences = parseExperiences(author.experiencesJson);
  const education = parseEducation(author.educationJson);
  const specialties = parseSpecialties(author.specialtiesJson);

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8 md:px-8">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[#027DFC]">
            Editar autor
          </p>
          <h1 className="text-2xl text-[#132960]">{author.name}</h1>
          <p className="text-sm text-zinc-500">
            Pagina publica:{" "}
            <Link
              href={`/nosso-time/${author.slug}`}
              target="_blank"
              className="text-[#027DFC] hover:underline"
            >
              /nosso-time/{author.slug}
            </Link>
          </p>
        </div>
        <Link
          href="/area-restrita/autores"
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
        >
          Voltar
        </Link>
      </div>

      {ok ? (
        <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700">
          Alteracoes salvas com sucesso.
        </div>
      ) : null}

      <form action={updateAuthorAction} className="space-y-6">
        <input type="hidden" name="id" value={author.id} />

        <section className="space-y-3 rounded-xl border border-[#132960]/20 bg-white p-5">
          <h2 className="text-lg font-semibold text-[#132960]">Identidade</h2>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="font-medium text-[#132960]">Nome completo</span>
              <input
                name="name"
                required
                defaultValue={author.name}
                className="h-10 w-full rounded-md border border-zinc-300 px-3 text-sm"
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium text-[#132960]">
                Cargo curto (aparece no card)
              </span>
              <input
                name="role"
                required
                defaultValue={author.role}
                placeholder="Ex: Economista"
                className="h-10 w-full rounded-md border border-zinc-300 px-3 text-sm"
              />
            </label>
            <label className="space-y-1 text-sm md:col-span-2">
              <span className="font-medium text-[#132960]">
                Cargo / titulo profissional (subtitulo no perfil)
              </span>
              <input
                name="headline"
                defaultValue={author.headline ?? ""}
                placeholder="Ex: Economista e Estrategista Global de Alocacao"
                className="h-10 w-full rounded-md border border-zinc-300 px-3 text-sm"
              />
            </label>
            <label className="space-y-1 text-sm md:col-span-2">
              <span className="font-medium text-[#132960]">URL da foto</span>
              <input
                name="photo"
                defaultValue={author.photo ?? ""}
                placeholder="https://..."
                className="h-10 w-full rounded-md border border-zinc-300 px-3 text-sm"
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium text-[#132960]">Email profissional</span>
              <input
                name="email"
                type="email"
                defaultValue={author.email ?? ""}
                placeholder="seuemail@empresa.com"
                className="h-10 w-full rounded-md border border-zinc-300 px-3 text-sm"
              />
              <span className="block text-[11px] text-zinc-500">
                E os leads enviados pelo formulario do site chegarao aqui.
              </span>
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium text-[#132960]">WhatsApp</span>
              <input
                name="whatsapp"
                defaultValue={author.whatsapp ?? ""}
                placeholder="+5548999386708"
                className="h-10 w-full rounded-md border border-zinc-300 px-3 text-sm"
              />
              <span className="block text-[11px] text-zinc-500">
                Use formato internacional (DDI + DDD + numero), sem espacos.
              </span>
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium text-[#132960]">LinkedIn (URL)</span>
              <input
                name="linkedin"
                defaultValue={author.linkedin ?? ""}
                placeholder="https://www.linkedin.com/in/..."
                className="h-10 w-full rounded-md border border-zinc-300 px-3 text-sm"
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium text-[#132960]">Instagram (URL)</span>
              <input
                name="instagram"
                defaultValue={author.instagram ?? ""}
                placeholder="https://www.instagram.com/..."
                className="h-10 w-full rounded-md border border-zinc-300 px-3 text-sm"
              />
            </label>
            <label className="space-y-1 text-sm md:col-span-2">
              <span className="font-medium text-[#132960]">Sobre (bio)</span>
              <textarea
                name="bio"
                defaultValue={author.bio ?? ""}
                placeholder="Texto descritivo sobre a pessoa, trajetoria e atuacao."
                className="min-h-32 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              />
            </label>
          </div>
        </section>

        <section className="space-y-3 rounded-xl border border-[#132960]/20 bg-white p-5">
          <div>
            <h2 className="text-lg font-semibold text-[#132960]">
              Especialidades (max 3)
            </h2>
            <p className="text-xs text-zinc-500">
              Tres caixinhas de destaque que aparecem no topo da landing publica.
              Use titulos curtos (ex: Financas familiares) e uma descricao de 1 a 2
              linhas.
            </p>
          </div>
          <SpecialtyEditor initial={specialties} hiddenName="specialtiesJson" />
        </section>

        <section className="space-y-3 rounded-xl border border-[#132960]/20 bg-white p-5">
          <div>
            <h2 className="text-lg font-semibold text-[#132960]">
              Experiencias profissionais
            </h2>
            <p className="text-xs text-zinc-500">
              Cada bloco vira um card com empresa, cargo e descricao na pagina publica.
            </p>
          </div>
          <ExperienceEditor initial={experiences} hiddenName="experiencesJson" />
        </section>

        <section className="space-y-3 rounded-xl border border-[#132960]/20 bg-white p-5">
          <div>
            <h2 className="text-lg font-semibold text-[#132960]">Formacao</h2>
            <p className="text-xs text-zinc-500">
              Graduacoes, especializacoes, certificacoes e detalhes que aparecem no perfil
              publico.
            </p>
          </div>
          <EducationEditor initial={education} hiddenName="educationJson" />
        </section>

        <div className="flex items-center justify-end gap-2">
          <Link
            href="/area-restrita/autores"
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            className="rounded-md bg-[#132960] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0d1f4a]"
          >
            Salvar alteracoes
          </button>
        </div>
      </form>
    </main>
  );
}
