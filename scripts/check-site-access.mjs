#!/usr/bin/env node
/**
 * Verifica DNS/HTTPS do dominio de producao e do fallback *.vercel.app.
 * Imprime como usar login e senha Master (trocar em /area-restrita/usuarios).
 */
import dns from "node:dns/promises";

const FALLBACK_HOST = "site-az-invest.vercel.app";

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

async function httpsStatus(host, path = "/") {
  const url = `https://${host}${path}`;
  try {
    const r = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(20000),
    });
    return r.status;
  } catch {
    return 0;
  }
}

async function main() {
  console.log(`[site-check] Dominio alvo: ${DOMAIN}`);

  const dnsOk = await resolveOk(DOMAIN);
  console.log(`[site-check] DNS resolve ${DOMAIN}: ${dnsOk ? "OK" : "FALHOU"}`);

  let prodHome = 0;
  let prodLogin = 0;
  if (dnsOk) {
    prodHome = await httpsStatus(DOMAIN, "/");
    prodLogin = await httpsStatus(DOMAIN, "/area-restrita/login");
    console.log(
      `[site-check] HTTPS https://${DOMAIN}/ → ${prodHome || "FALHOU"}`,
    );
    console.log(
      `[site-check] HTTPS https://${DOMAIN}/area-restrita/login → ${prodLogin || "FALHOU"}`,
    );
  } else {
    console.log(
      "[site-check] Acao: no registrador (ex. Registro.br), configure os registros indicados na Vercel em Settings → Domains para este projeto.",
    );
    console.log(
      "[site-check] Remova registros antigos do WordPress/Elementor que apontem para outro host.",
    );
  }

  const fbHome = await httpsStatus(FALLBACK_HOST, "/");
  const fbLogin = await httpsStatus(FALLBACK_HOST, "/area-restrita/login");
  console.log(
    `[site-check] Fallback https://${FALLBACK_HOST}/ → ${fbHome || "FALHOU"}`,
  );
  console.log(
    `[site-check] Fallback /area-restrita/login → ${fbLogin || "FALHOU"}`,
  );

  console.log(
    "[site-check] Uso: acesse /area-restrita/login (credenciais padrao do seed no README).",
  );
  console.log(
    "[site-check] Troca de senha Master: apos login, /area-restrita/usuarios → campo Nova senha + Resetar na linha do usuario Master.",
  );

  console.log(
    "[site-check] Opcional na Vercel (so se for usar o recurso): NEXT_PUBLIC_WHATSAPP_COMMUNITY_URL, RESEND_API_KEY, EMAIL_FROM. YouTube: YOUTUBE_API_KEY + YOUTUBE_CHANNEL_ID.",
  );

  const ok =
    (dnsOk && prodHome >= 200 && prodHome < 500) ||
    (fbHome >= 200 && fbHome < 500);
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error("[site-check] Erro:", e);
  process.exit(1);
});
