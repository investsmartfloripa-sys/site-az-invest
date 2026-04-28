#!/usr/bin/env node
/**
 * Verifica variaveis minimas para o painel economico (Blob).
 * Le chaves de .env na raiz do projeto (sem dependencia extra).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

function loadDotEnv() {
  const p = path.join(root, ".env");
  if (!fs.existsSync(p)) return {};
  const out = {};
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

const fileEnv = loadDotEnv();
const env = { ...fileEnv, ...process.env };

const required = ["NEXT_PUBLIC_BLOB_BASE_URL"];
let ok = true;
for (const key of required) {
  if (!String(env[key] ?? "").trim()) {
    console.error(`[go-live-check] Falta ${key} (defina no .env ou no ambiente).`);
    ok = false;
  }
}

if (ok) {
  console.log("[go-live-check] OK — NEXT_PUBLIC_BLOB_BASE_URL definido.");
}

process.exit(ok ? 0 : 1);
