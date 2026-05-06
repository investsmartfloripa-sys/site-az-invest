"use server";

import { prisma } from "@/lib/prisma";

export type ConsorcioLeadInput = {
  name: string;
  phone: string;
  tipoBem?: string | null;
  objetivo?: string | null;
  valorCarta?: number | null;
  prazoMeses?: number | null;
  parcela?: number | null;
};

export type ConsorcioLeadResult =
  | { ok: true }
  | { ok: false; error: string };

function sanitize(value: string | null | undefined, max = 200): string | null {
  if (!value) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

export async function submitConsorcioLead(
  input: ConsorcioLeadInput,
): Promise<ConsorcioLeadResult> {
  const name = sanitize(input.name, 120);
  const phoneRaw = sanitize(input.phone, 40);

  if (!name) return { ok: false, error: "Informe seu nome." };
  if (!phoneRaw) return { ok: false, error: "Informe um WhatsApp valido." };

  const phoneDigits = digitsOnly(phoneRaw);
  if (phoneDigits.length < 10) {
    return { ok: false, error: "Informe um WhatsApp com DDD e numero." };
  }

  try {
    await prisma.consorcioLead.create({
      data: {
        name,
        phone: phoneDigits,
        tipoBem: sanitize(input.tipoBem, 60),
        objetivo: sanitize(input.objetivo, 60),
        valorCarta: Number.isFinite(input.valorCarta) ? Number(input.valorCarta) : null,
        prazoMeses:
          Number.isFinite(input.prazoMeses) && Number(input.prazoMeses) > 0
            ? Math.round(Number(input.prazoMeses))
            : null,
        parcela: Number.isFinite(input.parcela) ? Number(input.parcela) : null,
      },
    });
    return { ok: true };
  } catch (err) {
    console.error("[consorcio-lead] erro ao salvar", err);
    return { ok: false, error: "Nao foi possivel registrar agora. Tente novamente." };
  }
}
