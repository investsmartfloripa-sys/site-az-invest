"use client";

import Link from "next/link";
import { useEffect } from "react";

type ErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GlobalError({ error, reset }: ErrorProps) {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      console.error("[app error]", error);
    }
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[60vh] w-full max-w-3xl flex-col items-center justify-center gap-6 px-4 py-20 text-center text-[#132960] md:px-8">
      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#FF5713]">
        Algo deu errado
      </p>
      <h1 className="text-4xl font-semibold leading-tight text-[#027DFC] md:text-5xl">
        Tivemos um problema ao carregar essa página
      </h1>
      <p className="max-w-xl text-sm text-zinc-600 md:text-base">
        O erro foi registrado e nossa equipe já foi avisada. Você pode tentar novamente ou
        voltar para a home.
      </p>
      {error.digest ? (
        <p className="text-xs text-zinc-400">Código: {error.digest}</p>
      ) : null}
      <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-full bg-[#027DFC] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#0268d6]"
        >
          Tentar novamente
        </button>
        <Link
          href="/"
          className="rounded-full border border-[#132960]/25 px-5 py-2.5 text-sm font-semibold text-[#132960] transition hover:bg-[#132960]/5"
        >
          Voltar para a home
        </Link>
      </div>
    </main>
  );
}
