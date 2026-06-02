import bcrypt from "bcryptjs";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createSession, destroySession, getSession } from "@/lib/auth";
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
  const next = String(formData.get("next") || "").trim();

  let user = await prisma.user.findUnique({ where: { email: rawLogin } });
  if (!user && rawLogin !== rawLogin.toLowerCase()) {
    user = await prisma.user.findUnique({ where: { email: rawLogin.toLowerCase() } });
  }
  if (!user || !user.active) {
    redirect("/area-restrita/login?error=invalid_credentials");
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    redirect("/area-restrita/login?error=invalid_credentials");
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  await createSession(user);
  redirect(next && next.startsWith("/area-restrita") ? next : "/area-restrita/dashboard");
}

export default async function RestrictedLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const session = await getSession();
  const params = await searchParams;
  const hasError = params.error === "invalid_credentials";

  return (
    <main className="flex min-h-screen w-full flex-col items-center justify-center bg-[#132960] px-4 py-10">
      <Image
        src="/logo-az-branco.png"
        alt="AZ Invest - Investimentos de A a Z"
        width={951}
        height={310}
        priority
        className="mb-8 h-12 w-auto"
      />
      <div className="w-full max-w-md rounded-2xl border border-[#132960]/10 bg-white p-7 shadow-xl">
        <h1 className="text-2xl font-semibold text-[#132960]">Área logada</h1>
        <p className="mt-2 text-sm text-[#132960]/60">Acesso da equipe editorial do blog.</p>

        {session ? (
          <div className="mt-5 space-y-4">
            <p className="rounded-md bg-[#027DFC]/10 px-3 py-2 text-sm text-[#132960]">
              Você já está logado como <span className="font-semibold">{session.email}</span>.
            </p>
            <Link
              href="/area-restrita/dashboard"
              className="flex h-11 w-full items-center justify-center rounded-md bg-[#027DFC] text-sm font-semibold text-white hover:bg-[#0268d4]"
            >
              Ir ao dashboard
            </Link>
            <form action={logoutAction}>
              <button
                type="submit"
                className="h-11 w-full rounded-md border border-[#132960]/20 text-sm text-[#132960]/70 hover:bg-[#132960]/5"
              >
                Sair
              </button>
            </form>
          </div>
        ) : (
          <>
            {hasError ? (
              <p className="mt-3 rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-600">
                Credenciais inválidas ou conta inativa.
              </p>
            ) : null}
            <form action={loginAction} className="mt-5 space-y-3">
              {params.next ? <input type="hidden" name="next" value={params.next} /> : null}
              <input
                name="login"
                type="text"
                required
                placeholder="Login ou e-mail"
                autoComplete="username"
                className="h-11 w-full rounded-md border border-[#132960]/20 bg-white px-3 text-sm text-[#132960] outline-none focus:border-[#027DFC]"
              />
              <input
                name="password"
                type="password"
                required
                placeholder="Senha"
                autoComplete="current-password"
                className="h-11 w-full rounded-md border border-[#132960]/20 bg-white px-3 text-sm text-[#132960] outline-none focus:border-[#027DFC]"
              />
              <button
                type="submit"
                className="h-11 w-full rounded-md bg-[#FF5713] text-sm font-semibold text-white hover:bg-[#d94a10]"
              >
                Entrar
              </button>
            </form>
            <p className="mt-4 text-center text-xs text-[#132960]/50">
              <Link href="/area-restrita/recuperar-senha" className="text-[#027DFC] hover:underline">
                Esqueci minha senha
              </Link>
            </p>
          </>
        )}
      </div>
    </main>
  );
}
