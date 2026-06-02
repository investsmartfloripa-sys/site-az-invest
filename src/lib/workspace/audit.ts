import { prisma } from "@/lib/prisma";

export async function writeAuditLog(input: {
  userId?: number | null;
  action: string;
  entity: string;
  entityId?: number | null;
  meta?: Record<string, unknown>;
}) {
  await prisma.auditLog.create({
    data: {
      userId: input.userId ?? null,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId ?? null,
      meta: input.meta ? JSON.stringify(input.meta) : null,
    },
  });
}
