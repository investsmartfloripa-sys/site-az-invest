import type { VisaoGeralPayload } from "@/lib/painel-visao-geral";
import { fraseManchete } from "@/lib/painel-visao-geral";

import type { RecessaoPonto } from "@/lib/painel-visao-geral";
import { ultimaObs } from "@/lib/painel-visao-geral";

function veredito(rec: RecessaoPonto | null): string {
  if (!rec) return "Sinal indisponível.";
  if (rec.n_modelos < 3) return "Sinal incompleto (menos de 3 modelos rodaram).";
  const sensiveis = rec.sensiveis_presentes ?? 0;
  if (sensiveis === 0) return "Sinal cauteloso — modelos sensíveis à virada (Probit/Diffusion) ausentes.";
  if (rec.sinalizacao === "vermelho") return "ALERTA — múltiplos modelos sinalizam recessão.";
  if (rec.sinalizacao === "amarelo") return "Atenção — alguns modelos cruzaram limiar de risco.";
  if (rec.sinalizacao === "verde") return "Ciclo em expansão / estabilidade — nenhum modelo em alerta.";
  return "Sinal indeterminado.";
}

export function FraseManchete({ payload }: { payload: VisaoGeralPayload }) {
  const frase = fraseManchete(payload);
  const rec = ultimaObs(payload.recessao?.serie);
  const v = veredito(rec ?? null);
  if (!frase) {
    return (
      <p className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-500">
        Dados carregando — frase-manchete será gerada quando todos os blocos estiverem disponíveis.
      </p>
    );
  }
  return (
    <div className="rounded-xl border border-[#132960]/15 bg-gradient-to-br from-white to-zinc-50 p-4 text-sm leading-relaxed text-zinc-800 space-y-2">
      <p className="text-base font-semibold text-[#132960]">{v}</p>
      <p><span className="font-semibold text-[#132960]">Resumo do ciclo:</span> {frase}</p>
    </div>
  );
}
