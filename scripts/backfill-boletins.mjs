#!/usr/bin/env node
/**
 * Reclassifica como boletim os posts que o robô Publisher gravou antes de os
 * boletins terem categoria própria (nasciam como "Economia"). Depois disso eles
 * saem das listagens de artigos e passam a responder pela URL de boletim.
 *
 * Critério (qualquer um): slug no padrão do robô (ipca-AAAA-MM, igpm-AAAA-MM)
 * OU capa em .../releases/... — e categoria ainda diferente de boletim.
 *
 * ATENÇÃO: o .env local aponta para o MESMO banco Neon de produção. O que
 * este script grava vale em produção na hora.
 *
 *   node scripts/backfill-boletins.mjs           # dry-run (padrão): só lista
 *   node scripts/backfill-boletins.mjs --apply   # grava as mudanças
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const APPLY = process.argv.includes("--apply");

// Mesmo valor de BOLETIM_CATEGORY em src/data/blog-categories.ts. Não dá para
// importar o módulo daqui: ele puxa "@/data/home" pelo alias, que o Node não resolve.
const BOLETIM_CATEGORY = "Boletim";
const ROBOT_SLUG = /^(ipca|igpm)-\d{4}-\d{2}$/;
const RELEASE_COVER = "/releases/";

const prisma = new PrismaClient();

function isRobotPost(post) {
  return ROBOT_SLUG.test(post.slug) || (post.coverImage ?? "").includes(RELEASE_COVER);
}

function printTable(rows) {
  const header = ["id", "slug", "categoria antes", "depois"];
  const cells = rows.map((r) => [String(r.id), r.slug, r.category, BOLETIM_CATEGORY]);
  const widths = header.map((h, i) => Math.max(h.length, ...cells.map((c) => c[i].length)));
  const line = (c) => c.map((v, i) => v.padEnd(widths[i])).join(" | ");
  console.log(line(header));
  console.log(widths.map((w) => "-".repeat(w)).join("-+-"));
  for (const c of cells) console.log(line(c));
}

async function main() {
  // Pré-filtro no banco (Prisma não faz regex); o padrão exato é conferido em JS.
  const candidates = await prisma.post.findMany({
    where: {
      category: { not: BOLETIM_CATEGORY },
      OR: [
        { slug: { startsWith: "ipca-" } },
        { slug: { startsWith: "igpm-" } },
        { coverImage: { contains: RELEASE_COVER } },
      ],
    },
    orderBy: { id: "asc" },
    select: { id: true, slug: true, category: true, coverImage: true },
  });
  const rows = candidates.filter(isRobotPost);

  console.log(
    `${APPLY ? "APLICANDO" : "DRY-RUN"}: ${candidates.length} candidato(s) no banco, ${rows.length} a reclassificar como "${BOLETIM_CATEGORY}".\n`,
  );
  if (rows.length === 0) {
    console.log("Nada a mudar.");
    return;
  }
  printTable(rows);

  if (!APPLY) {
    console.log("\nDry-run: nada foi gravado. Rode com --apply para gravar (o banco é o de produção).");
    return;
  }

  const [result] = await prisma.$transaction([
    prisma.post.updateMany({
      where: { id: { in: rows.map((r) => r.id) } },
      data: { category: BOLETIM_CATEGORY },
    }),
  ]);
  console.log(
    `\nGravado: ${result.count} post(s). Rotas dinâmicas refletem no próximo request; as em ISR, em até 1h.`,
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
