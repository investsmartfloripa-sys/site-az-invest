#!/usr/bin/env node
/**
 * Smoke test das rotas do AZ Workspace em producao.
 * Gera um cookie de sessao valido (mesmo AUTH_SECRET) para o admin e
 * verifica que cada aba responde 200 sem cair na pagina de erro global.
 */
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

function loadEnv() {
  try {
    const raw = readFileSync(new URL("../.env", import.meta.url), "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
      if (m && !process.env[m[1]]) {
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
      }
    }
  } catch {}
}

loadEnv();

const BASE = process.env.SMOKE_BASE || "https://site-az-invest.vercel.app";
const SECRET = process.env.AUTH_SECRET || "dev-only-change-me";
const COOKIE = "az_admin_session";
const TTL = 60 * 60 * 12;

function buildToken(user) {
  const payload = {
    userId: user.id,
    email: user.email,
    role: user.role,
    authorId: user.authorId,
    name: user.name,
    exp: Math.floor(Date.now() / 1000) + TTL,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", SECRET).update(body).digest("base64url");
  return `${body}.${sig}`;
}

const ROUTES = [
  "/area-restrita/dashboard",
  "/area-restrita/conteudo",
  "/area-restrita/conteudo/novo",
  "/area-restrita/revisao",
  "/area-restrita/autores",
  "/area-restrita/leads",
  "/area-restrita/metricas",
  "/area-restrita/dados",
  "/area-restrita/usuarios",
];

async function main() {
  const prisma = new PrismaClient();
  const admin =
    (await prisma.user.findFirst({ where: { role: "ADMIN" } })) ??
    (await prisma.user.findFirst());
  await prisma.$disconnect();

  if (!admin) {
    console.error("[smoke] Nenhum usuario no banco. Rode npm run db:seed-master.");
    process.exit(1);
  }

  const token = buildToken(admin);
  console.log(`[smoke] Base: ${BASE}`);
  console.log(`[smoke] Sessao: ${admin.email} (${admin.role})`);

  let failures = 0;
  for (const route of ROUTES) {
    try {
      const res = await fetch(`${BASE}${route}`, {
        headers: { Cookie: `${COOKIE}=${token}` },
        redirect: "manual",
        signal: AbortSignal.timeout(20000),
      });
      const body = res.status < 400 ? await res.text() : "";
      const errored = body.includes("Tivemos um problema ao carregar");
      const redirectedToLogin =
        res.status >= 300 && res.status < 400 && (res.headers.get("location") || "").includes("login");
      const ok = res.status === 200 && !errored;
      const label = ok
        ? "OK"
        : redirectedToLogin
          ? "REDIRECIONOU P/ LOGIN (sessao invalida)"
          : errored
            ? "ERRO GLOBAL (error.tsx)"
            : `HTTP ${res.status}`;
      if (!ok) failures += 1;
      console.log(`[smoke] ${route} → ${label}`);
    } catch (e) {
      failures += 1;
      console.log(`[smoke] ${route} → EXCECAO ${e instanceof Error ? e.message : e}`);
    }
  }

  console.log(failures === 0 ? "[smoke] TUDO OK" : `[smoke] ${failures} falha(s)`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("[smoke] Erro:", e);
  process.exit(1);
});
