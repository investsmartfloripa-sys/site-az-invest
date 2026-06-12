"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/workspace/audit";

export type LeadTipo = "whatsapp" | "fii" | "consorcio" | "form";
export type LeadStatusValue = "novo" | "contactado" | "convertido" | "descartado";

export type SetLeadStatusResult =
  | { ok: true }
  | { ok: false; reason: "invalid" | "forbidden" | "migration" | "error" };

const LEAD_TIPOS: readonly LeadTipo[] = ["whatsapp", "fii", "consorcio", "form"];
const LEAD_STATUSES: readonly LeadStatusValue[] = [
  "novo",
  "contactado",
  "convertido",
  "descartado",
];

/** P2021 = tabela inexistente no banco (migration do LeadStatus ainda não aplicada). */
function isMissingTableError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2021"
  );
}

/**
 * Confere se o lead existe e se o usuário pode anotá-lo. AUTHOR só anota leads
 * do próprio perfil (cliques de WhatsApp e formulário); FII/consórcio são
 * exclusivos de ADMIN/STAFF — mesmo escopo da página de leads.
 */
async function canAnnotateLead(
  session: { role: string; authorId: number | null },
  leadTipo: LeadTipo,
  leadId: number,
): Promise<"ok" | "invalid" | "forbidden"> {
  const isAuthor = session.role === "AUTHOR";

  switch (leadTipo) {
    case "whatsapp": {
      const lead = await prisma.authorWhatsappClick.findUnique({
        where: { id: leadId },
        select: { authorId: true },
      });
      if (!lead) return "invalid";
      if (isAuthor && lead.authorId !== session.authorId) return "forbidden";
      return "ok";
    }
    case "form": {
      const lead = await prisma.authorLead.findUnique({
        where: { id: leadId },
        select: { authorId: true },
      });
      if (!lead) return "invalid";
      if (isAuthor && lead.authorId !== session.authorId) return "forbidden";
      return "ok";
    }
    case "fii": {
      if (isAuthor) return "forbidden";
      const lead = await prisma.fiiLead.findUnique({
        where: { id: leadId },
        select: { id: true },
      });
      return lead ? "ok" : "invalid";
    }
    case "consorcio": {
      if (isAuthor) return "forbidden";
      const lead = await prisma.consorcioLead.findUnique({
        where: { id: leadId },
        select: { id: true },
      });
      return lead ? "ok" : "invalid";
    }
  }
}

/**
 * Define o status de atendimento de um lead (upsert em LeadStatus) e grava a
 * trilha de auditoria. Funciona mesmo antes da migration: se a tabela ainda
 * não existir no banco, retorna { ok: false, reason: "migration" }.
 */
export async function setLeadStatusAction(
  leadTipo: LeadTipo,
  leadId: number,
  status: LeadStatusValue,
): Promise<SetLeadStatusResult> {
  const session = await requireSession();

  if (
    !LEAD_TIPOS.includes(leadTipo) ||
    !LEAD_STATUSES.includes(status) ||
    !Number.isInteger(leadId) ||
    leadId <= 0
  ) {
    return { ok: false, reason: "invalid" };
  }

  const access = await canAnnotateLead(session, leadTipo, leadId);
  if (access !== "ok") return { ok: false, reason: access };

  try {
    await prisma.leadStatus.upsert({
      where: { leadTipo_leadId: { leadTipo, leadId } },
      create: { leadTipo, leadId, status, updatedBy: session.userId },
      update: { status, updatedBy: session.userId },
    });
  } catch (error) {
    if (isMissingTableError(error)) return { ok: false, reason: "migration" };
    return { ok: false, reason: "error" };
  }

  await writeAuditLog({
    userId: session.userId,
    action: "lead.set_status",
    entity: "Lead",
    entityId: leadId,
    meta: { leadTipo, status },
  });

  revalidatePath("/area-restrita/leads");
  return { ok: true };
}
