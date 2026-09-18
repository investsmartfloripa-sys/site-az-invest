/**
 * Normalização dos links de contato do time (LinkedIn, Instagram, WhatsApp).
 *
 * A mesma regra vale nas três camadas: no salvar (server actions do
 * workspace), no render (Nosso time e JSON-LD — corrige o que já está no
 * banco) e no script scripts/normalize-author-links.mjs, que importa este
 * arquivo direto pelo type stripping do Node 24. Por isso: puro, sem import
 * do Next e só sintaxe TS "apagável" (sem enum, namespace ou parameter
 * properties).
 */

export type ProfileKind = "linkedin" | "instagram";

// Domínio raiz aceito por rede; subdomínios (www., br.) passam.
const PROFILE_HOST: Record<ProfileKind, string> = {
  linkedin: "linkedin.com",
  instagram: "instagram.com",
};

// Caminhos que não levam a um perfil (home, feed): o link é inútil e vira null.
const NON_PROFILE_PATHS: Record<ProfileKind, string[]> = {
  linkedin: ["/", "/feed"],
  instagram: ["/"],
};

/**
 * URL canônica do perfil (https, sem query/hash, sem barra final) ou null
 * quando o valor não é um perfil daquela rede.
 * Aceita "www.linkedin.com/in/x" (sem esquema) e "@handle" (Instagram);
 * descarta rastreio (utm_*, igsh, isSelfProfile, hl…), "/feed/" e sites de
 * fora da rede (um site pessoal no campo LinkedIn ganharia o ícone errado).
 */
export function normalizeProfileUrl(
  value: string | null | undefined,
  kind: ProfileKind,
): string | null {
  let candidate = (value ?? "").trim();
  if (!candidate) return null;

  if (kind === "instagram" && candidate.startsWith("@")) {
    candidate = `https://www.instagram.com/${candidate.slice(1).trim()}`;
  }
  // Sem esquema, o <a href> vira caminho relativo do próprio site (404).
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(candidate)) {
    candidate = `https://${candidate}`;
  }

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;

  const host = url.hostname.toLowerCase();
  const root = PROFILE_HOST[kind];
  if (host !== root && !host.endsWith(`.${root}`)) return null;

  const path = url.pathname.replace(/\/{2,}/g, "/").replace(/\/+$/, "") || "/";
  if (NON_PROFILE_PATHS[kind].includes(path)) return null;

  return `https://${host}${path}`;
}

/**
 * Número em dígitos com DDI, pronto para wa.me ("5548996222778"), ou null.
 * Aceita "+55 48 9622-2778", "48 9146-2888", "48996717501" e URLs
 * (https://wa.me/55…, ?phone=55…). Sem DDI (10-11 dígitos) assume Brasil.
 * Celular brasileiro com 8 dígitos depois do DDD (primeiro dígito 6-9)
 * ganha o nono dígito; fixo (2-5) fica como está.
 */
export function whatsappDigits(value: string | null | undefined): string | null {
  if (!value) return null;
  // Em URL só o número interessa: o texto da mensagem também pode ter dígitos.
  const fromUrl = value.match(/(?:wa\.me\/|[?&]phone=)\+?([\d\s().-]+)/i);
  let digits = (fromUrl ? fromUrl[1] : value).replace(/\D/g, "");
  // "00" de discagem internacional e zero à esquerda ("048 9…") caem fora.
  digits = digits.replace(/^0+/, "");

  if (digits.length < 10 || digits.length > 13) return null;
  if (digits.length <= 11) {
    digits = `55${digits}`;
  } else if (!digits.startsWith("55")) {
    // 12-13 dígitos sem 55 na frente: DDI estrangeiro, fica como veio.
    return digits;
  }

  // 55 + DDD + 8 dígitos começando em 6-9: celular sem o nono dígito.
  if (digits.length === 12 && /[6-9]/.test(digits[4])) {
    digits = `${digits.slice(0, 4)}9${digits.slice(4)}`;
  }
  return digits;
}

/** Formato de persistência (E.164): "+5548996222778" ou null. */
export function whatsappE164(value: string | null | undefined): string | null {
  const digits = whatsappDigits(value);
  return digits ? `+${digits}` : null;
}

/** Link wa.me pronto para href ("https://wa.me/5548996222778") ou null. */
export function whatsappLink(value: string | null | undefined): string | null {
  const digits = whatsappDigits(value);
  return digits ? `https://wa.me/${digits}` : null;
}
