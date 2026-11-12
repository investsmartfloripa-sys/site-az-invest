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

/** Origens aceitas do formulário da comunidade (uma por aba de Mercado). */
const ORIGENS = new Set([
  "PAINEL_FII",
  "PAINEL_ACOES",
  "PAINEL_RENDA_FIXA",
  "PAINEL_FUNDOS",
  "PAINEL_INDICES",
  "PAINEL_MOEDAS",
  "PAINEL_JUROS",
  "PAINEL_COMMODITIES",
]);

/**
 * Server Action chamada pelo form da comunidade nas abas de Mercado (`ComunidadeMercado`).
 * Grava o lead no banco via Prisma (model `FiiLead`; `source` diz de qual aba veio).
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
  const origem = String(formData.get("origem") || "");
  const source = ORIGENS.has(origem) ? origem : "PAINEL_FII";

  if (!name) return { ok: false, error: "Nome é obrigatório." };
  if (!email || !email.includes("@")) return { ok: false, error: "E-mail inválido." };

  try {
    await prisma.fiiLead.create({
      data: { name, email, aporteMensal, patrimonio, source },
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
