"use server";

import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { UserRole } from "@prisma/client";
import { requireSession, isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendInviteEmail } from "@/lib/workspace/emails";
import { writeAuditLog } from "@/lib/workspace/audit";
import { slugify } from "@/lib/slugify";
import { assertPasswordPolicy } from "@/lib/workspace/password-policy";

export async function createUserAction(formData: FormData) {
  const session = await requireSession();
  if (!isAdmin(session.role)) redirect("/area-restrita/dashboard");

  const email = String(formData.get("login") || "").trim().toLowerCase();
  const name = String(formData.get("name") || "").trim();
  const password = String(formData.get("password") || "");
  const role = String(formData.get("role") || "AUTHOR") as UserRole;
  const authorIdRaw = String(formData.get("authorId") || "").trim();
  const authorId = authorIdRaw ? Number(authorIdRaw) : null;

  if (!email) return;
  // Senha em branco = convite por e-mail; quando digitada, precisa cumprir a política.
  if (password.length > 0 && assertPasswordPolicy(password)) {
    redirect("/area-restrita/usuarios?error=password");
  }
  const finalRole: UserRole = ["ADMIN", "AUTHOR", "STAFF"].includes(role) ? role : "AUTHOR";

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return;

  const inviteToken = randomBytes(32).toString("hex");
  const inviteExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  // Convite por e-mail SOMENTE quando o admin deixa a senha em branco.
  // Se uma senha foi digitada, ela e' usada como esta' (nada de descartar em silencio).
  const wantsInvite = password.length === 0;
  const passwordHash = wantsInvite
    ? await bcrypt.hash(randomBytes(16).toString("hex"), 12)
    : await bcrypt.hash(password, 12);

  // AUTHOR sempre sai com um perfil de autor vinculado: usa o escolhido, ou cria
  // um perfil generico (a pessoa refina depois em "Meu perfil").
  let linkedAuthorId: number | null = null;
  if (finalRole === "AUTHOR") {
    if (authorId) {
      linkedAuthorId = authorId;
    } else {
      const displayName = name || email.split("@")[0];
      const baseSlug = slugify(displayName) || "autor";
      let slug = baseSlug;
      let n = 1;
      while (await prisma.author.findUnique({ where: { slug } })) {
        slug = `${baseSlug}-${n}`;
        n += 1;
      }
      const createdAuthor = await prisma.author.create({
        data: { slug, name: displayName, role: "Assessor de Investimentos", email },
      });
      linkedAuthorId = createdAuthor.id;
    }
  }

  await prisma.user.create({
    data: {
      email,
      name: name || null,
      passwordHash,
      role: finalRole,
      authorId: linkedAuthorId,
      inviteToken: wantsInvite ? inviteToken : null,
      inviteExpiresAt: wantsInvite ? inviteExpiresAt : null,
    },
  });

  if (wantsInvite) {
    await sendInviteEmail({ to: email, token: inviteToken, name });
  }

  await writeAuditLog({
    userId: session.userId,
    action: "user.create",
    entity: "User",
    meta: { email, role: finalRole },
  });

  revalidatePath("/area-restrita/usuarios");
}

export async function resetPasswordAction(formData: FormData) {
  const session = await requireSession();
  if (!isAdmin(session.role)) redirect("/area-restrita/dashboard");

  const id = Number(formData.get("id"));
  const password = String(formData.get("password") || "");
  if (!Number.isInteger(id) || password.length === 0) return;
  if (assertPasswordPolicy(password)) {
    redirect("/area-restrita/usuarios?error=password");
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.update({
    where: { id },
    data: {
      passwordHash,
      passwordResetToken: null,
      passwordResetExpiresAt: null,
      inviteToken: null,
      inviteExpiresAt: null,
    },
  });

  revalidatePath("/area-restrita/usuarios");
}

export async function changeRoleAction(formData: FormData) {
  const session = await requireSession();
  if (!isAdmin(session.role)) redirect("/area-restrita/dashboard");

  const id = Number(formData.get("id"));
  const role = String(formData.get("role") || "AUTHOR") as UserRole;
  const authorIdRaw = String(formData.get("authorId") || "").trim();
  const authorId = authorIdRaw ? Number(authorIdRaw) : null;

  const finalRole: UserRole = ["ADMIN", "AUTHOR", "STAFF"].includes(role) ? role : "AUTHOR";
  if (!Number.isInteger(id)) return;
  if (id === session.userId && finalRole !== "ADMIN") return;

  await prisma.user.update({
    where: { id },
    data: {
      role: finalRole,
      authorId: finalRole === "AUTHOR" && authorId ? authorId : null,
    },
  });

  revalidatePath("/area-restrita/usuarios");
}

export async function toggleActiveAction(formData: FormData) {
  const session = await requireSession();
  if (!isAdmin(session.role)) redirect("/area-restrita/dashboard");

  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id === session.userId) return;

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return;

  await prisma.user.update({ where: { id }, data: { active: !user.active } });
  revalidatePath("/area-restrita/usuarios");
}

export async function deleteUserAction(formData: FormData) {
  const session = await requireSession();
  if (!isAdmin(session.role)) redirect("/area-restrita/dashboard");

  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id === session.userId) return;

  await prisma.user.delete({ where: { id } });
  revalidatePath("/area-restrita/usuarios");
}
