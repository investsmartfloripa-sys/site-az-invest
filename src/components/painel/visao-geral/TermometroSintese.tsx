"use client";

import { useState } from "react";
import { CartesianGrid, Line, LineChart, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import type { CodaceFaixa, VisaoGeralPayload } from "@/lib/painel-visao-geral";
import { formatMes, ultimaObs } from "@/lib/painel-visao-geral";
import DataStamp from "@/components/painel/DataStamp";

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

// Composto AZ: mediana ponderada normalizada 0-100
// selic_real (peso 30%, invertido) + ICE FGV (peso 40%) + CNI ICEI (15%) + OCDE CLI (15%)
function calcularComposto(selic: number | null | undefined, ice: number | null | undefined, icei: number | null | undefined, oecdVar: number | null | undefined): number | null {
  let score = 0;
  let wTotal = 0;
  if (selic !== null && selic !== undefined) {
    score += Math.max(0, Math.min(100, 60 - (selic - 4) * 10)) * 0.3;
    wTotal += 0.3;
  }
  if (ice !== null && ice !== undefined) {
    score += Math.max(0, Math.min(100, ice - 50)) * 0.4;
    wTotal += 0.4;
  }
  if (icei !== null && icei !== undefined) {
    score += Math.max(0, Math.min(100, icei)) * 0.15;
    wTotal += 0.15;
  }
  if (oecdVar !== null && oecdVar !== undefined) {
    score += Math.max(0, Math.min(100, 50 + oecdVar * 5)) * 0.15;
    wTotal += 0.15;
  }
  return wTotal > 0 ? score / wTotal : null;
}

export function TermometroSintese({ payload, codace = [] }: { payload: VisaoGeralPayload; codace?: CodaceFaixa[] }) {
  const [tooltipAberto, setTooltipAberto] = useState(false);

  const ibc = ultimaObs(payload.ibcbr?.serie);
  const icf = ultimaObs(payload.icf?.serie);
  const ice = ultimaObs(payload.fgvConfianca?.ice);

  // Serie historica composto AZ - merge das 4 series, mes a mes
  const mapPorMes = new Map<string, { selic?: number; ice?: number; icei?: number; oecdVar?: number }>();
  (payload.icf?.serie ?? []).forEach((p) => {
    if (p.selic_real_ex_ante_pct !== null && p.selic_real_ex_ante_pct !== undefined) {
      const obj = mapPorMes.get(p.mes) ?? {};
      obj.selic = p.selic_real_ex_ante_pct;
      mapPorMes.set(p.mes, obj);
    }
  });
  (payload.fgvConfianca?.ice ?? []).forEach((p) => {
    if (p.valor !== null && p.valor !== undefined) {
      const obj = mapPorMes.get(p.mes) ?? {};
      obj.ice = p.valor;
      mapPorMes.set(p.mes, obj);
    }
  });
  (payload.cni?.icei ?? []).forEach((p) => {
    if (p.valor !== null && p.valor !== undefined) {
      const obj = mapPorMes.get(p.mes) ?? {};
      obj.icei = p.valor;
      mapPorMes.set(p.mes, obj);
    }
  });
  (payload.oecdCli?.serie ?? []).forEach((p) => {
    if (p.var_6m_anualizada !== null && p.var_6m_anualizada !== undefined) {
      const obj = mapPorMes.get(p.mes) ?? {};
      obj.oecdVar = p.var_6m_anualizada;
      mapPorMes.set(p.mes, obj);
    }
  });
  const compostoHistorico = Array.from(mapPorMes.entries())
    .map(([mes, obj]) => ({ mes, composto: calcularComposto(obj.selic, obj.ice, obj.icei, obj.oecdVar) }))
    .filter((p) => p.composto !== null)
    .sort((a, b) => (a.mes > b.mes ? 1 : -1));

  const compostoAZ = compostoHistorico[compostoHistorico.length - 1]?.composto ?? null;

  // 4 dimensões (mantém lógica anterior)
  let atividade: Sinal = "neutro";
  if (ibc?.var_mom !== null && ibc?.var_mom !== undefined) {
    if (ibc.var_mom > 0.2 && (ibc.var_yoy ?? 0) > 1.5) atividade = "verde";
    else if (ibc.var_mom < -0.3 || (ibc.var_yoy ?? 0) < 0) atividade = "vermelho";
    else atividade = "amarelo";
  }
  let antecedentes: Sinal = "neutro";
  if (compostoAZ !== null) {
    antecedentes = compostoAZ >= 55 ? "verde" : compostoAZ < 45 ? "vermelho" : "amarelo";
  }
  let confianca: Sinal = "neutro";
  if (ice?.valor !== null && ice?.valor !== undefined) {
    confianca = ice.valor > 100 ? "verde" : ice.valor < 90 ? "vermelho" : "amarelo";
  }
  let credito: Sinal = "neutro";
  if (icf?.regime === "estimulativo") credito = "verde";
  else if (icf?.regime === "restritivo") credito = "vermelho";
  else if (icf?.regime === "neutro") credito = "amarelo";

  const dims = [
    { titulo: "Atividade", sinal: atividade, valor: ibc?.var_mom !== null && ibc?.var_mom !== undefined ? `${ibc.var_mom >= 0 ? "+" : ""}${ibc.var_mom.toFixed(1)}% m/m` : "—", tec: "IBC-Br dessaz." },
    { titulo: "Antecedentes", sinal: antecedentes, valor: compostoAZ !== null ? compostoAZ.toFixed(0) : "—", tec: "Composto AZ (0-100, 50=neutro)" },
    { titulo: "Confiança", sinal: confianca, valor: ice?.valor !== null && ice?.valor !== undefined ? ice.valor.toFixed(1) : "—", tec: "ICE FGV (100=neutro)" },
    { titulo: "Crédito/Financ.", sinal: credito, valor: icf?.icf_zscore !== null && icf?.icf_zscore !== undefined ? icf.icf_zscore.toFixed(2) : "—", tec: "ICF próprio (z-score)" },
  ];

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
          <div className="text-right relative">
            <button
              type="button"
              onClick={() => setTooltipAberto((o) => !o)}
              className="text-[10px] uppercase tracking-wider text-zinc-500 hover:text-[#132960] cursor-help inline-flex items-center gap-1"
              title="Clique para ver a fórmula"
            >
              Composto AZ <span className="text-zinc-400">ⓘ</span>
            </button>
            <div className={`text-3xl font-bold ${compostoAZ >= 55 ? "text-emerald-700" : compostoAZ < 45 ? "text-rose-700" : "text-amber-700"}`}>
              {compostoAZ.toFixed(0)}
            </div>
            <div className="text-[10px] text-zinc-500">0-100 · 50 = neutro</div>
            {tooltipAberto && (
              <div className="absolute right-0 mt-1 w-72 rounded-md border border-zinc-200 bg-white p-3 text-left text-[10px] text-zinc-700 shadow-lg z-10">
                <p className="font-semibold mb-1">Como interpretar:</p>
                <ul className="space-y-0.5 list-disc list-inside text-[10px]">
                  <li><strong>≥55</strong>: antecedentes em zona expansionista</li>
                  <li><strong>45-55</strong>: zona neutra/transição</li>
                  <li><strong>&lt;45</strong>: antecedentes contracionistas</li>
                </ul>
                <p className="mt-2 font-semibold">Fórmula:</p>
                <p className="text-[10px]">Selic real 30% (invertida) + ICE FGV 40% + CNI ICEI 15% + OCDE CLI var 6m 15%, normalizado 0-100.</p>
                <button onClick={() => setTooltipAberto(false)} className="mt-2 text-[10px] text-[#027DFC] hover:underline">Fechar</button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Serie historica do composto */}
      {compostoHistorico.length > 12 && (
        <div className="mb-3 rounded-lg border border-zinc-200 bg-white p-2">
          <div className="mb-1 flex items-baseline justify-between">
            <span className="text-[10px] uppercase tracking-wider text-zinc-500">Histórico do Composto AZ ({compostoHistorico[0].mes.slice(0, 4)}-{compostoHistorico[compostoHistorico.length - 1].mes.slice(0, 4)})</span>
            <span className="text-[9px] text-zinc-400">faixas cinzas = recessões CODACE</span>
          </div>
          <div className="h-[100px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={compostoHistorico} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
                <CartesianGrid stroke="#eee" strokeDasharray="3 3" />
                <XAxis dataKey="mes" tick={{ fontSize: 8 }} interval={Math.max(1, Math.floor(compostoHistorico.length / 8))} />
                <YAxis tick={{ fontSize: 8 }} domain={[0, 100]} />
                <Tooltip
                  formatter={(v: unknown) => (typeof v === "number" ? v.toFixed(0) : "—")}
                  labelFormatter={(l: unknown) => formatMes(String(l ?? ""))}
                />
                <ReferenceLine y={50} stroke="#000" strokeDasharray="2 4" />
                {codace.map((f, i) => (
                  <ReferenceArea key={`ts-${f.pico}-${i}`} x1={f.pico} x2={f.vale} fill="#9CA3AF" fillOpacity={0.15} ifOverflow="visible" />
                ))}
                <Line type="monotone" dataKey="composto" stroke="#132960" strokeWidth={1.8} dot={false} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2"><DataStamp dado={compostoHistorico[compostoHistorico.length - 1]?.mes} /></p>
        </div>
      )}

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
