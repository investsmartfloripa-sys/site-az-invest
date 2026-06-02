"use server";

import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { sendPasswordResetEmail } from "@/lib/workspace/emails";

export async function requestPasswordResetAction(formData: FormData) {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  if (!email) redirect("/area-restrita/recuperar-senha?error=1");

  const user = await prisma.user.findUnique({ where: { email } });
  if (user) {
    const token = randomBytes(32).toString("hex");
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: token,
        passwordResetExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });
    await sendPasswordResetEmail({ to: email, token });
  }

  redirect("/area-restrita/recuperar-senha?sent=1");
}

export async function resetPasswordWithTokenAction(formData: FormData) {
  const token = String(formData.get("token") || "").trim();
  const password = String(formData.get("password") || "");
  if (!token || password.length < 8) redirect("/area-restrita/recuperar-senha?error=1");

  const user = await prisma.user.findFirst({
    where: {
      passwordResetToken: token,
      passwordResetExpiresAt: { gt: new Date() },
    },
  });

  if (!user) redirect("/area-restrita/recuperar-senha?error=expired");

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      passwordResetToken: null,
      passwordResetExpiresAt: null,
    },
  });

  redirect("/area-restrita/login?reset=1");
}

export async function activateAccountAction(formData: FormData) {
  const token = String(formData.get("token") || "").trim();
  const password = String(formData.get("password") || "");
  if (!token || password.length < 8) redirect("/area-restrita/ativar?error=1");

  const user = await prisma.user.findFirst({
    where: {
      inviteToken: token,
      inviteExpiresAt: { gt: new Date() },
    },
  });

  if (!user) redirect("/area-restrita/ativar?error=expired");

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      inviteToken: null,
      inviteExpiresAt: null,
      active: true,
    },
  });

  redirect("/area-restrita/login?activated=1");
}
