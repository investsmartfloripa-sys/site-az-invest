"use client";

import type { VisaoGeralPayload } from "@/lib/painel-visao-geral";
import { ultimaObs } from "@/lib/painel-visao-geral";

type Sinal = "verde" | "amarelo" | "vermelho" | "neutro";

function corClasses(s: Sinal): { bg: string; text: string; ring: string; label: string } {
  switch (s) {
    case "verde":
      return { bg: "bg-emerald-50", text: "text-emerald-700", ring: "ring-emerald-300", label: "Expansão" };
    case "amarelo":
      return { bg: "bg-amber-50", text: "text-amber-700", ring: "ring-amber-300", label: "Cautela" };
    case "vermelho":
      return { bg: "bg-rose-50", text: "text-rose-700", ring: "ring-rose-300", label: "Alerta" };
    default:
      return { bg: "bg-zinc-50", text: "text-zinc-600", ring: "ring-zinc-200", label: "—" };
  }
}

export function TermometroSintese({ payload }: { payload: VisaoGeralPayload }) {
  const ibc = ultimaObs(payload.ibcbr?.serie);
  const rec = ultimaObs(payload.recessao?.serie);
  const icf = ultimaObs(payload.icf?.serie);
  const ice = ultimaObs(payload.fgvConfianca?.ice);

  // 1) Atividade — IBC-Br MoM + YoY
  let atividade: Sinal = "neutro";
  if (ibc?.var_mom !== null && ibc?.var_mom !== undefined) {
    if (ibc.var_mom > 0.2 && (ibc.var_yoy ?? 0) > 1.5) atividade = "verde";
    else if (ibc.var_mom < -0.3 || (ibc.var_yoy ?? 0) < 0) atividade = "vermelho";
    else atividade = "amarelo";
  }

  // 2) Antecedentes — mediana ponderada (composto AZ): Selic real ex-ante (peso 30%), ICE (40%), CNI ICEI (15%), OCDE CLI var (15%)
  const selic = icf?.selic_real_ex_ante_pct;
  const iceVal = ice?.valor;
  const iceiVal = (payload.cni?.icei ?? []).slice(-1)[0]?.valor;
  const oecdUlt = (payload.oecdCli?.serie ?? []).slice(-1)[0];
  // Normalizar pra 0-100 (50 = neutro)
  let score = 0,
    wTotal = 0;
  if (selic !== null && selic !== undefined) {
    // Selic real alta = restritivo = baixo score
    const s = Math.max(0, Math.min(100, 60 - (selic - 4) * 10));
    score += s * 0.3;
    wTotal += 0.3;
  }
  if (iceVal !== null && iceVal !== undefined) {
    const s = Math.max(0, Math.min(100, iceVal - 50)); // 100=50, 90=40, 110=60
    score += s * 0.4;
    wTotal += 0.4;
  }
  if (iceiVal !== null && iceiVal !== undefined) {
    const s = Math.max(0, Math.min(100, iceiVal)); // ICEI ~50 = neutro
    score += s * 0.15;
    wTotal += 0.15;
  }
  if (oecdUlt?.var_6m_anualizada !== null && oecdUlt?.var_6m_anualizada !== undefined) {
    const s = Math.max(0, Math.min(100, 50 + oecdUlt.var_6m_anualizada * 5));
    score += s * 0.15;
    wTotal += 0.15;
  }
  const compostoAZ = wTotal > 0 ? score / wTotal : null;
  let antecedentes: Sinal = "neutro";
  if (compostoAZ !== null) {
    antecedentes = compostoAZ >= 55 ? "verde" : compostoAZ < 45 ? "vermelho" : "amarelo";
  }

  // 3) Confiança — média ICE + ICEI normalizada
  let confianca: Sinal = "neutro";
  if (iceVal !== null && iceVal !== undefined) {
    confianca = iceVal > 100 ? "verde" : iceVal < 90 ? "vermelho" : "amarelo";
  }

  // 4) Crédito — ICF regime + Selic real
  let credito: Sinal = "neutro";
  if (icf?.regime === "estimulativo") credito = "verde";
  else if (icf?.regime === "restritivo") credito = "vermelho";
  else if (icf?.regime === "neutro") credito = "amarelo";

  const dims = [
    { titulo: "Atividade", sinal: atividade, valor: ibc?.var_mom !== null && ibc?.var_mom !== undefined ? `${ibc.var_mom >= 0 ? "+" : ""}${ibc.var_mom.toFixed(1)}% m/m` : "—", tec: "IBC-Br dessaz." },
    { titulo: "Antecedentes", sinal: antecedentes, valor: compostoAZ !== null ? compostoAZ.toFixed(0) : "—", tec: "Composto AZ (0-100, 50=neutro)" },
    { titulo: "Confiança", sinal: confianca, valor: iceVal !== null && iceVal !== undefined ? iceVal.toFixed(1) : "—", tec: "ICE FGV (100=neutro)" },
    { titulo: "Crédito/Financ.", sinal: credito, valor: icf?.icf_zscore !== null && icf?.icf_zscore !== undefined ? icf.icf_zscore.toFixed(2) : "—", tec: "ICF próprio (z-score)" },
  ];

  // Sentence-level reading
  const sentencas: string[] = [];
  if (atividade === "verde") sentencas.push("atividade em expansão");
  else if (atividade === "vermelho") sentencas.push("atividade desacelerando");
  else if (atividade === "amarelo") sentencas.push("atividade estagnada");

  if (antecedentes === "verde") sentencas.push("antecedentes positivos");
  else if (antecedentes === "vermelho") sentencas.push("antecedentes negativos");
  else if (antecedentes === "amarelo") sentencas.push("antecedentes mistos");

  if (confianca === "verde") sentencas.push("confiança alta");
  else if (confianca === "vermelho") sentencas.push("confiança baixa");

  if (credito === "vermelho") sentencas.push("condições financeiras restritivas");
  else if (credito === "verde") sentencas.push("condições financeiras estimulativas");

  // Avaliar coerência
  const coresUnicas = new Set(dims.map((d) => d.sinal).filter((s) => s !== "neutro"));
  const conflito = coresUnicas.size >= 3 || (coresUnicas.has("verde") && coresUnicas.has("vermelho"));

  return (
    <section className="rounded-2xl border-2 border-[#132960]/30 bg-gradient-to-br from-white to-zinc-50 p-5 shadow-md">
      <div className="mb-3 flex items-baseline justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-base font-bold text-[#132960]">Termômetro Síntese</h2>
          <p className="text-xs text-zinc-600">
            Semáforo em 4 dimensões + composto AZ (mediana ponderada de Selic real 30%, ICE FGV 40%, CNI ICEI 15%, OCDE CLI 15%).
          </p>
        </div>
        {compostoAZ !== null && (
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wider text-zinc-500">Composto AZ</div>
            <div className={`text-3xl font-bold ${compostoAZ >= 55 ? "text-emerald-700" : compostoAZ < 45 ? "text-rose-700" : "text-amber-700"}`}>
              {compostoAZ.toFixed(0)}
            </div>
            <div className="text-[10px] text-zinc-500">0-100, 50 = neutro</div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {dims.map((d) => {
          const c = corClasses(d.sinal);
          return (
            <div key={d.titulo} className={`rounded-lg ${c.bg} ring-1 ${c.ring} p-3`}>
              <div className={`text-[10px] uppercase tracking-wider font-bold ${c.text}`}>{c.label}</div>
              <div className="mt-0.5 text-sm font-semibold text-zinc-800">{d.titulo}</div>
              <div className={`mt-1 text-lg font-bold ${c.text}`}>{d.valor}</div>
              <div className="mt-0.5 text-[9px] text-zinc-500">{d.tec}</div>
            </div>
          );
        })}
      </div>

      {sentencas.length > 0 && (
        <p className="mt-3 text-xs text-zinc-700">
          <span className="font-semibold">Leitura:</span> {sentencas.join(" · ")}.
          {conflito && <span className="ml-1 font-semibold text-amber-700">Dimensões divergem — ler com cautela.</span>}
        </p>
      )}
    </section>
  );
}
