import type { VisaoGeralPayload } from "@/lib/painel-visao-geral";
import { fraseManchete } from "@/lib/painel-visao-geral";

export function FraseManchete({ payload }: { payload: VisaoGeralPayload }) {
  const frase = fraseManchete(payload);
  if (!frase) {
    return (
      <p className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-500">
        Dados carregando — frase-manchete será gerada quando todos os blocos estiverem disponíveis.
      </p>
    );
  }
  return (
    <p className="rounded-xl border border-[#132960]/15 bg-gradient-to-br from-white to-zinc-50 p-4 text-sm leading-relaxed text-zinc-800">
      <span className="font-semibold text-[#132960]">Resumo do ciclo:</span> {frase}
    </p>
  );
}
