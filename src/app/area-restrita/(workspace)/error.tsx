"use client";

import { useEffect } from "react";
import { RotateCcw, TriangleAlert } from "lucide-react";

/**
 * Error boundary do workspace: mostra uma mensagem amigável e o botão
 * "Tentar de novo" (reset re-renderiza o segmento que falhou).
 */
export default function WorkspaceError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Mantém o detalhe técnico no console para diagnóstico.
    console.error("[workspace]", error);
  }, [error]);

  return (
    <div className="mx-auto mt-10 max-w-lg rounded-2xl border border-[#132960]/10 bg-white p-8 text-center shadow-sm">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#9C2B24]/10">
        <TriangleAlert aria-hidden className="h-6 w-6 text-[#9C2B24]" />
      </span>
      <h1 className="mt-4 text-lg font-semibold text-[#132960]">
        Algo deu errado ao carregar esta página
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-[#132960]/65">
        Pode ter sido uma instabilidade momentânea. Tente de novo — se o problema
        continuar, avise a equipe.
      </p>
      {error.digest ? (
        <p className="mt-2 text-xs text-[#132960]/40">Código: {error.digest}</p>
      ) : null}
      <button
        type="button"
        onClick={reset}
        className="mt-6 inline-flex items-center gap-2 rounded-md bg-[#027DFC] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#0268d4]"
      >
        <RotateCcw aria-hidden className="h-4 w-4" />
        Tentar de novo
      </button>
    </div>
  );
}
