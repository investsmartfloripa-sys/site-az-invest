import bcrypt from "bcryptjs";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createSession, destroySession, getSession, type UserRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function logoutAction() {
  "use server";
  await destroySession();
  redirect("/area-restrita/login");
}

async function loginAction(formData: FormData) {
  "use server";
  const rawLogin = String(formData.get("login") || "").trim();
  const password = String(formData.get("password") || "");

  let user = await prisma.user.findUnique({ where: { email: rawLogin } });
  if (!user) {
    user = await prisma.user.findUnique({ where: { email: rawLogin.toLowerCase() } });
  }
  if (!user) {
    redirect("/area-restrita/login?error=invalid_credentials");
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    redirect("/area-restrita/login?error=invalid_credentials");
  }

  await createSession(user.id, user.email, user.role as UserRole);
  redirect("/area-restrita/painel");
}

export default async function RestrictedLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await getSession();
  const params = await searchParams;
  const hasError = params.error === "invalid_credentials";

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md items-center px-4">
      <div className="w-full rounded-xl border border-[#132960]/25 bg-white p-6">
        <h1 className="text-2xl text-[#132960]">Login da area restrita</h1>
        <p className="mt-2 text-sm text-zinc-600">Acesso da equipe editorial do blog.</p>

        {session ? (
          <div className="mt-5 space-y-4">
            <p className="rounded-md bg-[#027DFC]/10 px-3 py-2 text-sm text-[#132960]">
              Voce ja esta logado como{" "}
              <span className="font-semibold">{session.email}</span>.
            </p>
            <Link
              href="/area-restrita/painel"
              className="flex h-10 w-full items-center justify-center rounded-md bg-[#132960] text-sm font-semibold text-white hover:bg-[#0f214d]"
            >
              Ir para o painel
            </Link>
            <form action={logoutAction}>
              <button
                type="submit"
                className="h-10 w-full rounded-md border border-zinc-300 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
              >
                Sair e trocar de usuario
              </button>
            </form>
          </div>
        ) : (
          <>
            {hasError ? (
              <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                Credenciais invalidas.
              </p>
            ) : null}
            <form action={loginAction} className="mt-5 space-y-3">
              <input
                name="login"
                type="text"
                required
                placeholder="Login (e-mail ou usuario)"
                autoComplete="username"
                className="h-10 w-full rounded-md border border-zinc-300 px-3 text-sm outline-none focus:border-[#027DFC]"
              />
              <input
                name="password"
                type="password"
                required
                placeholder="Senha"
                autoComplete="current-password"
                className="h-10 w-full rounded-md border border-zinc-300 px-3 text-sm outline-none focus:border-[#027DFC]"
              />
              <button
                type="submit"
                className="h-10 w-full rounded-md bg-[#132960] text-sm font-semibold text-white hover:bg-[#0f214d]"
              >
                Entrar
              </button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
