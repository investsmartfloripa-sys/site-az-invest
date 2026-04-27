import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const COOKIE_NAME = "az_admin_session";
const SESSION_TTL_SECONDS = 60 * 60 * 12;

export type UserRole = "MASTER" | "EDITOR";

type SessionPayload = {
  userId: number;
  email: string;
  role: UserRole;
  exp: number;
};

function getSecret() {
  return process.env.AUTH_SECRET || "dev-only-change-me";
}

function toBase64Url(input: string) {
  return Buffer.from(input).toString("base64url");
}

function signPayload(payload: SessionPayload) {
  const body = toBase64Url(JSON.stringify(payload));
  const signature = createHmac("sha256", getSecret()).update(body).digest("base64url");
  return `${body}.${signature}`;
}

function parseSession(token: string): SessionPayload | null {
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

export async function createSession(userId: number, email: string, role: UserRole) {
  const payload: SessionPayload = {
    userId,
    email,
    role,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  };

  const token = signPayload(payload);
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function destroySession() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export async function getSession() {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return parseSession(token);
}
