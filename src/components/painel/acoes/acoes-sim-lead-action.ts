"use server";

import { prisma } from "@/lib/prisma";

type Result = { ok: true } | { ok: false; error: string };

/**
 * Server Action do gate do simulador de carteira (renda variável).
 * Grava o lead com a CARTEIRA SIMULADA em JSON (tickers + pesos + valor) —
 * contexto de interesse pro comercial no CRM (/area-restrita/leads).
 *
 * Mesma filosofia do `saveFiiLead`: falha graciosa se a migration
 * `20260701230000_acoes_sim_lead` ainda não estiver aplicada.
 */
export async function saveAcoesSimLead(formData: FormData): Promise<Result> {
  const name = String(formData.get("name") || "").trim();
  const phone = String(formData.get("phone") || "").trim();
  const email = String(formData.get("email") || "").trim();
  const valorInicialRaw = String(formData.get("valorInicial") || "").replace(/\./g, "").replace(",", ".");
  const carteiraRaw = String(formData.get("carteira") || "");

  if (name.length < 2) return { ok: false, error: "Nome é obrigatório." };
  const phoneDigits = phone.replace(/\D/g, "");
  if (phoneDigits.length < 10) {
    return { ok: false, error: "Telefone inválido — use DDD + número." };
  }
  if (email && !email.includes("@")) return { ok: false, error: "E-mail inválido." };

  let carteira: unknown = null;
  try {
    carteira = JSON.parse(carteiraRaw);
  } catch {
    carteira = { raw: carteiraRaw.slice(0, 500) };
  }
  const valorInicial = Number(valorInicialRaw);

  try {
    await prisma.acoesSimLead.create({
      data: {
        name,
        phone,
        email: email || null,
        valorInicial: Number.isFinite(valorInicial) && valorInicial > 0 ? valorInicial : null,
        carteira: carteira as object,
        source: "SIMULADOR_ACOES",
      },
    });
    return { ok: true };
  } catch (e) {
    console.error("[saveAcoesSimLead] failed:", e);
    return {
      ok: false,
      error: "Não foi possível registrar agora. Tente novamente em instantes.",
    };
  }
}
