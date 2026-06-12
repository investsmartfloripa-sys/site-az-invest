import type { VisaoGeralPayload } from "@/lib/painel-visao-geral";
import { fraseManchete, resumoProbabilidade } from "@/lib/painel-visao-geral";

// FONTE ÚNICA de probabilidade: probabilidades.mediana / sinal_principal do JSON
// (resumoProbabilidade), compartilhada com HeroKpis e CardProbitAz.
function vereditoProbitAz(payload: VisaoGeralPayload): string {
  const prob = resumoProbabilidade(payload.probitAz);
  if (prob.valor === null || prob.valor === undefined) {
    return "Sinal indisponível — modelos de recessão aguardando pipeline.";
  }
  const pct = prob.valor * 100;
  if (prob.usaFallback) {
    return `Probit AZ em ${pct.toFixed(0)}% — ${prob.nModelos} de 4 modelos disponíveis; mediana indisponível nesta rodada.`;
  }
  // Thresholds 65/35 (Chauvet-Hamilton 2006)
  if (pct >= 65) return `ALERTA — mediana de ${prob.nModelos} de 4 modelos em ${pct.toFixed(0)}% sinaliza recessão.`;
  if (pct >= 35) return `Atenção — mediana de ${prob.nModelos} de 4 modelos em ${pct.toFixed(0)}% (zona de risco moderado).`;
  return `Ciclo em expansão — mediana de ${prob.nModelos} de 4 modelos em ${pct.toFixed(0)}% (regime estável).`;
}

export function FraseManchete({ payload }: { payload: VisaoGeralPayload }) {
  const frase = fraseManchete(payload);
  const v = vereditoProbitAz(payload);
  if (!frase || frase.trim().length === 0) {
    return (
      <p className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-500">
        Dados carregando — frase-manchete será gerada quando todos os blocos estiverem disponíveis.
      </p>
    );
  }
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
      <p className="text-sm text-zinc-700 leading-relaxed">{frase}</p>
      <p className="mt-2 text-xs text-zinc-500 leading-relaxed">
        <strong className="text-zinc-700">Veredito Probit AZ:</strong> {v}
      </p>
    </div>
  );
}
