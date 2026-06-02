import { createHmac, timingSafeEqual } from "node:crypto";
import type { UserRole } from "@prisma/client";

export type SessionUser = {
  userId: number;
  email: string;
  role: UserRole;
  authorId: number | null;
  name: string | null;
  exp: number;
};

export const SESSION_COOKIE_NAME = "az_admin_session";
const SESSION_TTL_SECONDS = 60 * 60 * 12;

type SessionPayload = SessionUser;

function getSecret() {
  const secret = process.env.AUTH_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET ausente em produção — configure a variável de ambiente.");
  }
  return "dev-only-change-me";
}

function toBase64Url(input: string) {
  return Buffer.from(input).toString("base64url");
}

function signPayload(payload: SessionPayload) {
  const body = toBase64Url(JSON.stringify(payload));
  const signature = createHmac("sha256", getSecret()).update(body).digest("base64url");
  return `${body}.${signature}`;
}

export function parseSessionToken(token: string): SessionUser | null {
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;

  const expected = createHmac("sha256", getSecret()).update(body).digest();
  const received = Buffer.from(signature, "base64url");

  if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
    return null;
  }

  const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionPayload;
  if (Date.now() / 1000 > payload.exp) return null;
  return payload;
}

export function buildSessionToken(user: Omit<SessionUser, "exp">) {
  const payload: SessionPayload = {
    ...user,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  };
  return signPayload(payload);
}

export const SESSION_MAX_AGE = SESSION_TTL_SECONDS;
