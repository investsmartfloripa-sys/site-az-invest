#!/usr/bin/env node
/**
 * Verifica DNS/HTTPS do dominio de producao e do fallback *.vercel.app.
 * Confirma conteudo da pagina de login (AZ Workspace) e detecta pagina de erro global.
 */
import dns from "node:dns/promises";

const FALLBACK_HOST = "site-az-invest.vercel.app";
const LOGIN_PATH = "/area-restrita/login";
const LOGIN_MARKER = "Área logada";
const ERROR_MARKER = "Tivemos um problema ao carregar";
const LEGACY_LOGIN_MARKER = "Login da area restrita";

function hostnameFromSiteUrl(raw) {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  try {
    const u = new URL(s.includes("://") ? s : `https://${s}`);
    return u.hostname;
  } catch {
    return null;
  }
}

const DOMAIN =
  hostnameFromSiteUrl(process.env.NEXT_PUBLIC_SITE_URL) ??
  "investimentosdeaz.com.br";

async function resolveOk(name) {
  try {
    await dns.resolve4(name);
    return true;
  } catch {
    try {
      await dns.resolve6(name);
      return true;
    } catch {
      return false;
    }
  }
}

async function httpsFetch(host, path = "/") {
  const url = `https://${host}${path}`;
  try {
    const r = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(20000),
      headers: { "Cache-Control": "no-cache" },
    });
    const body = await r.text();
    return { status: r.status, body };
  } catch {
    return { status: 0, body: "" };
  }
}

function describeLoginPage(body) {
  if (!body) return "FALHOU (sem corpo)";
  if (body.includes(ERROR_MARKER)) return "ERRO GLOBAL (error.tsx)";
  if (body.includes(LOGIN_MARKER)) return "OK (AZ Workspace)";
  if (body.includes(LEGACY_LOGIN_MARKER)) return "DESATUALIZADO (login legado — falta deploy)";
  return "INCONCLUSIVO (marca nao encontrada)";
}

async function main() {
  console.log(`[site-check] Dominio alvo: ${DOMAIN}`);

  const dnsOk = await resolveOk(DOMAIN);
  console.log(`[site-check] DNS resolve ${DOMAIN}: ${dnsOk ? "OK" : "FALHOU"}`);

  let prodHome = 0;
  let prodLoginLabel = "pulado (DNS falhou)";
  if (dnsOk) {
    const home = await httpsFetch(DOMAIN, "/");
    prodHome = home.status;
    const login = await httpsFetch(DOMAIN, LOGIN_PATH);
    prodLoginLabel = describeLoginPage(login.body);
    console.log(
      `[site-check] HTTPS https://${DOMAIN}/ → ${prodHome || "FALHOU"}`,
    );
    console.log(
      `[site-check] Login https://${DOMAIN}${LOGIN_PATH} → HTTP ${login.status || "FALHOU"} | ${prodLoginLabel}`,
    );
  } else {
    console.log(
      "[site-check] Acao: no registrador (ex. Registro.br), configure os registros indicados na Vercel em Settings → Domains para este projeto.",
    );
    console.log(
      "[site-check] Remova registros antigos do WordPress/Elementor que apontem para outro host.",
    );
  }

  const fbHome = await httpsFetch(FALLBACK_HOST, "/");
  const fbLogin = await httpsFetch(FALLBACK_HOST, LOGIN_PATH);
  const fbLoginLabel = describeLoginPage(fbLogin.body);
  console.log(
    `[site-check] Fallback https://${FALLBACK_HOST}/ → ${fbHome.status || "FALHOU"}`,
  );
  console.log(
    `[site-check] Fallback login → HTTP ${fbLogin.status || "FALHOU"} | ${fbLoginLabel}`,
  );

  console.log(
    "[site-check] Credenciais padrao (seed): login Borbarox / senha 041291 — ver README.",
  );
  console.log(
    "[site-check] Pos-login: /area-restrita/dashboard deve carregar sem error.tsx.",
  );
  console.log(
    "[site-check] Gestao de usuarios: /area-restrita/usuarios (ADMIN/STAFF).",
  );

  const loginOk =
    prodLoginLabel.startsWith("OK") || fbLoginLabel.startsWith("OK");
  const reachable =
    (dnsOk && prodHome >= 200 && prodHome < 500) ||
    (fbHome.status >= 200 && fbHome.status < 500);

  if (!loginOk && reachable) {
    console.log(
      "[site-check] FALHA: login nao mostra AZ Workspace. Rode vercel --prod --yes e repita.",
    );
  }

  process.exit(reachable && loginOk ? 0 : reachable ? 1 : 1);
}

main().catch((e) => {
  console.error("[site-check] Erro:", e);
  process.exit(1);
});
