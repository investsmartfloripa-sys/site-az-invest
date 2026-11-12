import type { VisaoGeralPayload } from "@/lib/painel-visao-geral";
import { fraseManchete, resumoProbabilidade, ultimaObs } from "@/lib/painel-visao-geral";
import { fmtPct } from "@/lib/format-br";

// FONTE ÚNICA de probabilidade: probabilidades.mediana / sinal_principal do JSON
// (resumoProbabilidade), compartilhada com HeroKpis e CardProbitAz.
// Revisão 12/11/2026: o rótulo era "Veredito Probit AZ: Ciclo em expansão", mas o número é a
// MEDIANA dos modelos (não o Probit AZ) e "expansão" contradizia a atividade em queda e o
// quadrante do relógio na mesma tela. Agora a linha diz só o nível de risco e de onde ele vem.
function leituraModelos(payload: VisaoGeralPayload): string {
  const prob = resumoProbabilidade(payload.probitAz);
  if (prob.valor === null || prob.valor === undefined) {
    return "sem leitura nesta rodada.";
  }
  const pct = fmtPct(prob.valor * 100, 0);
  if (prob.usaFallback) {
    return `Probit AZ em ${pct}; só ${prob.nModelos} de 4 modelos saíram nesta rodada, sem mediana.`;
  }
  const base = `mediana de ${prob.nModelos} de 4 modelos em ${pct}.`;
  // Limites 65/35 (Chauvet-Hamilton 2006)
  if (prob.valor >= 0.65) return `risco alto — ${base}`;
  if (prob.valor >= 0.35) return `risco moderado — ${base}`;
  return `risco baixo — ${base}`;
}

/**
 * Uma linha quando as medidas da aba apontam para lados opostos (modelos de recessão ×
 * IBC-Br e relógio do hiato). Qual leitura prevalece é decisão editorial; aqui só se avisa.
 */
function avisoDivergencia(payload: VisaoGeralPayload): string | null {
  const prob = resumoProbabilidade(payload.probitAz);
  if (prob.valor === null || prob.valor === undefined) return null;
  const ritmo = ultimaObs(payload.ibcbr?.serie)?.var_ritmo_trimestral ?? null;
  const gaps = (payload.hiato?.serie ?? [])
    .map((p) => p.gap_hp_pct)
    .filter((v): v is number => typeof v === "number");
  const gap = gaps.length >= 4 ? gaps[gaps.length - 1] : null;
  const dGap = gap !== null ? gap - gaps[gaps.length - 4] : null;
  const atividadeCai = ritmo !== null && ritmo < 0;
  const abaixoECaindo = gap !== null && dGap !== null && gap < 0 && dGap < 0;
  if (prob.valor < 0.35 && (atividadeCai || abaixoECaindo)) {
    const partes: string[] = [];
    if (atividadeCai) partes.push("caiu no trimestre");
    if (abaixoECaindo) partes.push("está abaixo da tendência e se afastando dela");
    return `Os sinais não apontam para o mesmo lado: os modelos combinam vários indicadores e veem risco baixo, mas o IBC-Br, sozinho, ${partes.join(" e ")}. Cada cartão abaixo diz de qual medida vem a leitura.`;
  }
  if (prob.valor >= 0.65 && ritmo !== null && ritmo > 0) {
    return "Os sinais não apontam para o mesmo lado: os modelos veem risco alto, mas o IBC-Br ainda cresceu no trimestre. Cada cartão abaixo diz de qual medida vem a leitura.";
  }
  return null;
}

export function FraseManchete({ payload }: { payload: VisaoGeralPayload }) {
  const frase = fraseManchete(payload);
  const v = leituraModelos(payload);
  const divergencia = avisoDivergencia(payload);
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
      <p className="mt-2 text-xs text-zinc-600 leading-relaxed">
        <strong className="text-zinc-700">Modelos de recessão:</strong> {v}
      </p>
      {divergencia ? <p className="mt-1 text-xs text-zinc-600 leading-relaxed">{divergencia}</p> : null}
    </div>
  );
}
