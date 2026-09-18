#!/usr/bin/env node
/**
 * Normaliza os links de contato dos autores (Author.linkedin / instagram /
 * whatsapp) com as mesmas regras que o site usa ao salvar e ao renderizar
 * (src/lib/social-links.ts): linkedin/instagram viram URL canônica https sem
 * rastreio (ou null quando não é perfil da rede); whatsapp vira E.164
 * "+55DDD9XXXXXXXX", com o nono dígito inserido em celular de 8 dígitos.
 *
 * ATENÇÃO: o .env local aponta para o MESMO banco Neon de produção. O que
 * este script grava vale em produção na hora.
 *
 *   node scripts/normalize-author-links.mjs           # dry-run (padrão): só lista
 *   node scripts/normalize-author-links.mjs --apply   # grava as mudanças
 *   --keep-invalid   não apaga campo que normaliza para null (ex.: site pessoal
 *                    no campo LinkedIn) — só corrige/limpa o que tem valor
 *
 * O import do .ts abaixo dispensa build: Node 24 faz type stripping nativo
 * (o lib só usa sintaxe TS apagável).
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { normalizeProfileUrl, whatsappE164 } from "../src/lib/social-links.ts";

const APPLY = process.argv.includes("--apply");
const KEEP_INVALID = process.argv.includes("--keep-invalid");
const FIELDS = ["linkedin", "instagram", "whatsapp"];

const prisma = new PrismaClient();

function planned(author) {
  return {
    linkedin: normalizeProfileUrl(author.linkedin, "linkedin"),
    instagram: normalizeProfileUrl(author.instagram, "instagram"),
    whatsapp: whatsappE164(author.whatsapp),
  };
}

// Observação por linha: apagado, nono dígito (confirmar com o dono), DDI ou só limpeza.
function describe(field, before, after) {
  if (after === null) {
    return field === "whatsapp" ? "apagado: número inválido" : "apagado: não é perfil da rede";
  }
  if (field !== "whatsapp") return "limpeza (esquema/rastreio/barra)";
  const raw = before.replace(/\D/g, "").replace(/^0+/, "");
  const withDdi = raw.length <= 11 ? `55${raw}` : raw;
  if (after.replace(/\D/g, "").length === withDdi.length + 1) return "NONO DÍGITO inserido: confirmar";
  if (raw.length <= 11) return "DDI 55 adicionado";
  return "formato E.164";
}

function printTable(rows) {
  const header = ["id", "slug", "campo", "antes", "depois", "obs"];
  const cells = rows.map((r) => [
    String(r.id),
    r.slug,
    r.field,
    r.before || "(vazio)",
    r.after ?? "(null)",
    r.obs,
  ]);
  const widths = header.map((h, i) => Math.max(h.length, ...cells.map((c) => c[i].length)));
  const line = (c) => c.map((v, i) => v.padEnd(widths[i])).join(" | ");
  console.log(line(header));
  console.log(widths.map((w) => "-".repeat(w)).join("-+-"));
  for (const c of cells) console.log(line(c));
}

async function main() {
  const authors = await prisma.author.findMany({
    orderBy: { id: "asc" },
    select: { id: true, slug: true, linkedin: true, instagram: true, whatsapp: true },
  });

  const rows = [];
  const perAuthor = new Map();
  for (const author of authors) {
    const next = planned(author);
    for (const field of FIELDS) {
      const before = author[field] ?? null;
      const after = next[field];
      if (before === after) continue;
      if (KEEP_INVALID && after === null) continue;
      rows.push({ id: author.id, slug: author.slug, field, before, after, obs: describe(field, before, after) });
      if (!perAuthor.has(author.id)) perAuthor.set(author.id, {});
      perAuthor.get(author.id)[field] = after;
    }
  }

  console.log(
    `${APPLY ? "APLICANDO" : "DRY-RUN"}: ${authors.length} autores no banco, ${perAuthor.size} com mudança, ${rows.length} campo(s).\n`,
  );
  if (rows.length === 0) {
    console.log("Nada a mudar.");
    return;
  }
  printTable(rows);

  const count = (fn) => rows.filter(fn).length;
  console.log(
    `\nResumo: linkedin ${count((r) => r.field === "linkedin")} · instagram ${count((r) => r.field === "instagram")} · whatsapp ${count((r) => r.field === "whatsapp")} · apagados ${count((r) => r.after === null)} · nono dígito ${count((r) => r.obs.startsWith("NONO"))}`,
  );

  if (!APPLY) {
    console.log("\nDry-run: nada foi gravado. Rode com --apply para gravar (o banco é o de produção).");
    return;
  }

  await prisma.$transaction(
    [...perAuthor].map(([id, data]) => prisma.author.update({ where: { id }, data })),
  );
  console.log(
    `\nGravado: ${perAuthor.size} autor(es). /nosso-time é dinâmica; /nosso-time/<slug> (ISR) atualiza em até 1h.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
