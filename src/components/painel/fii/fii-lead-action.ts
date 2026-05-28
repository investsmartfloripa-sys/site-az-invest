"use server";

import { prisma } from "@/lib/prisma";

type Result = { ok: true } | { ok: false; error: string };

function parseFloatSafe(v: FormDataEntryValue | null): number | null {
  if (v == null) return null;
  const s = String(v).trim().replace(",", ".");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/**
 * Server Action chamada pelo form do `FiiComunidadeCta`.
 * Grava o lead no banco via Prisma (model `FiiLead`).
 *
 * Falha graciosa: se a tabela ainda não existir (migration `20260528150000_fii_leads`
 * não aplicada em produção), o erro é capturado e retorna ok:false com mensagem
 * neutra pro usuário; o erro técnico vai pro log.
 */
export async function saveFiiLead(formData: FormData): Promise<Result> {
  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim();
  const aporteMensal = parseFloatSafe(formData.get("aporteMensal"));
  const patrimonio = parseFloatSafe(formData.get("patrimonio"));

  if (!name) return { ok: false, error: "Nome é obrigatório." };
  if (!email || !email.includes("@")) return { ok: false, error: "E-mail inválido." };

  try {
    await prisma.fiiLead.create({
      data: { name, email, aporteMensal, patrimonio, source: "PAINEL_FII" },
    });
    return { ok: true };
  } catch (e) {
    console.error("[saveFiiLead] failed:", e);
    return {
      ok: false,
      error: "Não foi possível registrar agora. Tente novamente em instantes.",
    };
  }
}
