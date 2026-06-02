import Link from "next/link";
import { activateAccountAction } from "@/lib/workspace/auth-actions";

export default async function AtivarContaPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const params = await searchParams;

  if (!params.token) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md items-center px-4">
        <p className="text-red-600">Link de convite inválido.</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#132960] px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-[#132960]/10 bg-white p-7 shadow-xl">
        <h1 className="text-xl font-semibold text-[#132960]">Ativar conta</h1>
        <p className="mt-2 text-sm text-[#132960]/60">Defina sua senha para acessar o workspace.</p>

        {params.error ? (
          <p className="mt-4 text-sm text-red-600">Convite expirado ou inválido.</p>
        ) : null}

        <form action={activateAccountAction} className="mt-5 space-y-3">
          <input type="hidden" name="token" value={params.token} />
          <input
            name="password"
            type="password"
            required
            minLength={4}
            placeholder="Nova senha"
            className="h-11 w-full rounded-md border border-[#132960]/20 bg-white px-3 text-sm text-[#132960] outline-none focus:border-[#027DFC]"
          />
          <button type="submit" className="h-11 w-full rounded-md bg-[#027DFC] text-sm font-semibold text-white hover:bg-[#0268d4]">
            Ativar
          </button>
        </form>

        <p className="mt-4 text-center text-xs">
          <Link href="/area-restrita/login" className="text-[#027DFC] hover:underline">
            Já tenho senha
          </Link>
        </p>
      </div>
    </main>
  );
}
