import type { VisaoGeralPayload } from "@/lib/painel-visao-geral";
import { fraseManchete } from "@/lib/painel-visao-geral";

// Loop 33: fonte canonica unica - probit_az.json
function vereditoProbitAz(payload: VisaoGeralPayload): string {
  const probAz = payload.probitAz?.probabilidades;
  if (!probAz) return "Sinal indisponivel - pipeline Probit AZ aguardando dados.";

  const valores = [probAz.diffusion, probAz.gap_hp, probAz.probit_fin, probAz.probit_az]
    .filter((v): v is number => typeof v === "number");

  if (valores.length === 0) return "Sinal indisponivel - todos os modelos retornaram null.";
  if (valores.length < 2) return "Sinal incompleto - menos de 2 modelos com dados.";

  // Mediana estatistica
  const ord = valores.slice().sort((a, b) => a - b);
  const m = Math.floor(ord.length / 2);
  const mediana = ord.length % 2 === 0 ? (ord[m - 1] + ord[m]) / 2 : ord[m];
  const medianaPct = mediana * 100;

  // Hamilton 2011 thresholds
  if (medianaPct >= 65) return `ALERTA - mediana dos ${valores.length} modelos em ${medianaPct.toFixed(0)}% sinaliza recessao.`;
  if (medianaPct >= 35) return `Atencao - mediana dos ${valores.length} modelos em ${medianaPct.toFixed(0)}% (zona de risco moderado).`;
  return `Ciclo em expansao - mediana dos ${valores.length} modelos em ${medianaPct.toFixed(0)}% (regime estavel).`;
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