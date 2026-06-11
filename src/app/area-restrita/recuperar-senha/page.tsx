import Link from "next/link";
import {
  activateAccountAction,
  requestPasswordResetAction,
  resetPasswordWithTokenAction,
} from "@/lib/workspace/auth-actions";
import { PASSWORD_MIN_LENGTH } from "@/lib/workspace/password-policy";

export default async function RecuperarSenhaPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string; token?: string }>;
}) {
  const params = await searchParams;
  const hasToken = Boolean(params.token);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#132960] px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-[#132960]/10 bg-white p-7 shadow-xl">
        <h1 className="text-xl font-semibold text-[#132960]">Recuperar senha</h1>

        {params.sent ? (
          <p className="mt-4 text-sm text-emerald-700">
            Se o e-mail existir, enviamos um link de redefinição.
          </p>
        ) : null}
        {params.error ? (
          <p className="mt-4 text-sm text-red-600">Não foi possível processar. Tente novamente.</p>
        ) : null}

        {hasToken ? (
          <form action={resetPasswordWithTokenAction} className="mt-5 space-y-3">
            <input type="hidden" name="token" value={params.token} />
            <input
              name="password"
              type="password"
              required
              minLength={PASSWORD_MIN_LENGTH}
              placeholder="Nova senha"
              className="h-11 w-full rounded-md border border-[#132960]/20 bg-white px-3 text-sm text-[#132960] outline-none focus:border-[#027DFC]"
            />
            <p className="text-xs text-[#132960]/55">Mínimo de {PASSWORD_MIN_LENGTH} caracteres.</p>
            <button type="submit" className="h-11 w-full rounded-md bg-[#027DFC] text-sm font-semibold text-white hover:bg-[#0268d4]">
              Definir nova senha
            </button>
          </form>
        ) : (
          <form action={requestPasswordResetAction} className="mt-5 space-y-3">
            <input
              name="email"
              type="email"
              required
              placeholder="Seu e-mail"
              className="h-11 w-full rounded-md border border-[#132960]/20 bg-white px-3 text-sm text-[#132960] outline-none focus:border-[#027DFC]"
            />
            <button type="submit" className="h-11 w-full rounded-md bg-[#027DFC] text-sm font-semibold text-white hover:bg-[#0268d4]">
              Enviar link
            </button>
          </form>
        )}

        <p className="mt-4 text-center text-xs">
          <Link href="/area-restrita/login" className="text-[#027DFC] hover:underline">
            Voltar ao login
          </Link>
        </p>
      </div>
    </main>
  );
}
