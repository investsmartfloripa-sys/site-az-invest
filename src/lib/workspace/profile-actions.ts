"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
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
import { writeAuditLog } from "@/lib/workspace/audit";

export async function updateOwnProfileAction(formData: FormData) {
  const session = await requireSession();
  if (session.role !== "AUTHOR" || !session.authorId) {
    redirect("/area-restrita/dashboard");
  }

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
    where: { id: session.authorId },
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

  await writeAuditLog({
    userId: session.userId,
    action: "author.update_profile",
    entity: "Author",
    entityId: updated.id,
  });

  revalidatePath("/area-restrita/perfil");
  revalidatePath("/nosso-time");
  revalidatePath(`/nosso-time/${updated.slug}`);
  redirect("/area-restrita/perfil?ok=1");
}
