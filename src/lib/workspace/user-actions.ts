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

  await prisma.user.create({
    data: {
      email,
      name: name || null,
      passwordHash,
      role: finalRole,
      authorId: finalRole === "AUTHOR" && authorId ? authorId : null,
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
