import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  buildSessionToken,
  parseSessionToken,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE,
  type SessionUser,
} from "@/lib/auth-token";

export type { SessionUser, UserRole };

export async function createSession(user: {
  id: number;
  email: string;
  role: UserRole;
  authorId: number | null;
  name: string | null;
}) {
  const token = buildSessionToken({
    userId: user.id,
    email: user.email,
    role: user.role,
    authorId: user.authorId,
    name: user.name,
  });

  const store = await cookies();
  store.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function destroySession() {
  const store = await cookies();
  store.delete(SESSION_COOKIE_NAME);
}

export async function getSession(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  return parseSessionToken(token);
}

export async function getVerifiedSession(): Promise<SessionUser | null> {
  const session = await getSession();
  if (!session) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      email: true,
      role: true,
      authorId: true,
      name: true,
      active: true,
    },
  });

  // Nao alterar cookies aqui: esta funcao roda durante a renderizacao de
  // Server Components e o Next so permite mutar cookies em Server Actions /
  // Route Handlers — mutar aqui derruba a pagina com erro global (foi o caso
  // do autor com sessao criada antes do vinculo do authorId). O retorno usa
  // sempre os dados frescos do banco; o cookie se corrige no proximo login.
  if (!user || !user.active) {
    return null;
  }

  return {
    userId: user.id,
    email: user.email,
    role: user.role,
    authorId: user.authorId,
    name: user.name,
    exp: session.exp,
  };
}

export async function requireSession(loginPath = "/area-restrita/login") {
  const session = await getVerifiedSession();
  if (!session) redirect(loginPath);
  return session;
}

export function isAdmin(role: UserRole) {
  return role === "ADMIN";
}

export function isStaffOrAdmin(role: UserRole) {
  return role === "ADMIN" || role === "STAFF";
}

export async function requireRole(roles: UserRole[], redirectTo = "/area-restrita/dashboard") {
  const session = await requireSession();
  if (!roles.includes(session.role)) redirect(redirectTo);
  return session;
}

export { SESSION_COOKIE_NAME, parseSessionToken } from "@/lib/auth-token";
