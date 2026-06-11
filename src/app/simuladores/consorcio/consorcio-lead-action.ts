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

function parseIntSafe(v: FormDataEntryValue | null): number | null {
  const n = parseFloatSafe(v);
  return n == null ? null : Math.round(n);
}

/**
 * Server Action chamada pelo formulário de lead do simulador de consórcio.
 * Valida e grava o lead no banco via Prisma (model `ConsorcioLead`), junto
 * com o contexto da simulação (tipo de bem, objetivo, valor da carta,
 * prazo e parcela), lido no painel /area-restrita/leads.
 *
 * Falha graciosa: se o banco estiver indisponível, o erro é capturado e
 * retorna ok:false com mensagem neutra para o usuário; o erro técnico vai
 * para o log.
 */
export async function saveConsorcioLead(formData: FormData): Promise<Result> {
  const name = String(formData.get("name") || "").trim();
  const phone = String(formData.get("phone") || "").trim();
  const tipoBem = String(formData.get("tipoBem") || "").trim() || null;
  const objetivo = String(formData.get("objetivo") || "").trim() || null;
  const valorCarta = parseFloatSafe(formData.get("valorCarta"));
  const prazoMeses = parseIntSafe(formData.get("prazoMeses"));
  const parcela = parseFloatSafe(formData.get("parcela"));

  if (!name) return { ok: false, error: "Nome é obrigatório." };

  const phoneDigits = phone.replace(/\D/g, "");
  if (phoneDigits.length < 10 || phoneDigits.length > 13) {
    return { ok: false, error: "Informe um WhatsApp válido com DDD (ex.: 48 99999-9999)." };
  }

  try {
    await prisma.consorcioLead.create({
      data: {
        name,
        phone,
        tipoBem,
        objetivo,
        valorCarta,
        prazoMeses,
        parcela,
        source: "SIMULADOR_CONSORCIO",
      },
    });
    return { ok: true };
  } catch (e) {
    console.error("[saveConsorcioLead] failed:", e);
    return {
      ok: false,
      error: "Não foi possível registrar agora. Tente novamente em instantes.",
    };
  }
}
