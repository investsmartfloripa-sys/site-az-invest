import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { createSession, getSession, type UserRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
  if (session) {
    redirect("/area-restrita/painel");
  }

  const params = await searchParams;
  const hasError = params.error === "invalid_credentials";

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md items-center px-4">
      <div className="w-full rounded-xl border border-[#132960]/25 bg-white p-6">
        <h1 className="text-2xl text-[#132960]">Login da area restrita</h1>
        <p className="mt-2 text-sm text-zinc-600">Acesso da equipe editorial do blog.</p>
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
      </div>
    </main>
  );
}
