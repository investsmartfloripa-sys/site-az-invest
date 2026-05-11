/**
 * cleanup-blob-v2.mjs
 *
 * Remove os 4 SVGs órfãos `*_v2.svg` do Vercel Blob.
 * RODAR SOMENTE depois que o branch sem `_v2` (fix/painel-juros-selic-implicita)
 * tiver sido mergeado pro main e a Vercel tiver feito o redeploy. Caso contrário,
 * o site em produção ainda busca esses arquivos e o painel quebra até o deploy ficar pronto.
 *
 * Uso:
 *   node scripts/cleanup-blob-v2.mjs            # dry-run (só lista, não deleta)
 *   node scripts/cleanup-blob-v2.mjs --apply    # executa a deleção
 *
 * Requer BLOB_READ_WRITE_TOKEN no ambiente (ou .env / .env.vercel.local).
 */

import { del } from "@vercel/blob";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ORPHAN_FILES = [
  "charts/static/juros_prefixado_v2.svg",
  "charts/static/juros_ipca_v2.svg",
  "charts/static/selic_implicita_v2.svg",
  "charts/static/juros_treasury_us_v2.svg",
];

function loadEnv() {
  if (process.env.BLOB_READ_WRITE_TOKEN) return;
  for (const f of [".env.vercel.local", ".env"]) {
    const p = join(process.cwd(), f);
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*"?([^"\n]*)"?\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  }
}

async function main() {
  loadEnv();
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error("Erro: BLOB_READ_WRITE_TOKEN não definido. Pegue em https://vercel.com/dashboard → Storage → Blob.");
    process.exit(1);
  }

  const base = (process.env.NEXT_PUBLIC_BLOB_BASE_URL || "").replace(/\/$/, "");
  if (!base) {
    console.error("Erro: NEXT_PUBLIC_BLOB_BASE_URL não definido.");
    process.exit(1);
  }

  const apply = process.argv.includes("--apply");
  console.log(apply ? "MODO: APLICAR (deleta os arquivos)" : "MODO: DRY-RUN (só lista, use --apply para deletar)");
  console.log("");

  for (const path of ORPHAN_FILES) {
    const url = `${base}/${path}`;
    if (apply) {
      try {
        await del(url, { token: process.env.BLOB_READ_WRITE_TOKEN });
        console.log(`  DELETADO   ${path}`);
      } catch (err) {
        console.log(`  ERRO       ${path}  (${err?.message || err})`);
      }
    } else {
      console.log(`  marcaria   ${path}`);
    }
  }

  console.log("");
  console.log(apply ? "Pronto." : "Use `node scripts/cleanup-blob-v2.mjs --apply` quando quiser executar.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
