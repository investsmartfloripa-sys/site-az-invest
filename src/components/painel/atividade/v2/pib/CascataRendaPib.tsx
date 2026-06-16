"use client";

import { useMemo } from "react";

import type { AtividadeCodaceData, AtividadePibData } from "@/lib/painel-atividade";
import { ChartCard } from "@/components/painel/core";
import { variationText } from "@/lib/az-chart-theme";
import { fmtNum, fmtSignedNum } from "@/lib/format-br";
import { fmtTrimCurto, num } from "../shared";

/**
 * Da produção à renda disponível — a cascata (waterfall) das contas econômicas
 * integradas no trimestre mais recente, tudo em % do PIB nominal
 * (`contas_economicas_pct_pib`, SIDRA 2072). Parte do PIB = 100 e percorre a
 * sequência contábil das Contas Nacionais até a capacidade/necessidade líquida
 * de financiamento, alternando NÍVEIS (barras ancoradas no zero) e PONTES
 * (deltas que ligam um nível ao próximo, verdes quando somam, vermelhas quando
 * subtraem):
 *
 *   PIB (100)
 *     (+) Salários e rendas de propriedade do exterior   → Renda nacional bruta
 *     (+) Outras transferências correntes                → Renda nacional disp. bruta
 *     (−) Despesa de consumo final                       → Poupança bruta
 *     (−) Formação bruta de capital (+ cap. residual)    → Capac./necess. de financ.
 *
 * Sem cálculo derivado: os níveis vêm prontos do JSON (linhas "(=)") e as pontes
 * são a soma dos componentes "(+)/(−)" entre dois níveis — a leitura econômica é
 * "para onde foi cada real do PIB". `contas_economicas_pct_pib` não está no tipo
 * exportado; acessamos via leitura segura (num) e tratamos ausência sem quebrar.
 */

// Chaves EXATAS do JSON (com acentos/parênteses) — copiadas de atividade_pib.json.
const K = {
  pib: "Produto Interno Bruto",
  salarios: "(+) Salários (líquidos recebidos do exterior)",
  rendasProp: "(+) Rendas de propriedade (líquidas recebidas do exterior)",
  rnb: "(=) Renda nacional bruta",
  outrasTransf: "(+) Outras transferências correntes (líquidas recebidas do exterior)",
  rndb: "(=) Renda nacional disponível bruta",
  consumo: "(-) Despesa de consumo final",
  poupanca: "(=) Poupança bruta",
  fbc: "(-) Formação bruta de capital",
  cessao: "(+) Cessão de ativos não financeiros não produzidos (aquisições líquidas)",
  transfCapital: "(+) Transferências de capital (líquidas recebidas do exterior)",
  capacidade: "(=) Capacidade / necessidade líquida de financiamento",
} as const;

/** Componente de uma ponte: rótulo + valor (em % do PIB) que entra na soma do delta. */
type PonteComp = { rotulo: string; valor: number | null };

/** Passo da cascata: um NÍVEL (barra ancorada no zero) ou uma PONTE (delta entre dois níveis). */
type Passo =
  | { tipo: "nivel"; rotulo: string; valor: number }
  | { tipo: "ponte"; rotulo: string; delta: number; de: number; ate: number; componentes: PonteComp[] };

/** Lê um registro de contas_economicas_pct_pib de forma segura (não está no tipo). */
type PctRow = Record<string, unknown> & { trim?: string };

export function CascataRendaPib({
  pib,
  // codace aceito por simetria com os demais cards da face; não usado (snapshot de um trimestre, sem eixo de tempo).
  geradoEm,
}: {
  pib: AtividadePibData;
  codace?: AtividadeCodaceData | null;
  geradoEm: string;
}) {
  // contas_economicas_pct_pib não consta no tipo AtividadePibData — leitura defensiva.
  const seriePct = ((pib as unknown as { contas_economicas_pct_pib?: { serie?: PctRow[] } })
    .contas_economicas_pct_pib?.serie ?? []) as PctRow[];

  const { passos, trimRef, semDado } = useMemo(() => {
    const ult = seriePct.length ? seriePct[seriePct.length - 1] : null;
    if (!ult) return { passos: [] as Passo[], trimRef: pib.trim_recente, semDado: true };

    const v = (k: string) => num(ult, k);

    const vPib = v(K.pib);
    const vRnb = v(K.rnb);
    const vRndb = v(K.rndb);
    const vPoupanca = v(K.poupanca);
    const vCapacidade = v(K.capacidade);

    // Sem os níveis não há cascata — exige PIB e os três "(=)" estruturais.
    if (vPib == null || vRnb == null || vRndb == null || vPoupanca == null || vCapacidade == null) {
      return { passos: [] as Passo[], trimRef: String(ult.trim ?? pib.trim_recente), semDado: true };
    }

    const salarios = v(K.salarios);
    const rendasProp = v(K.rendasProp);
    const outrasTransf = v(K.outrasTransf);
    const consumo = v(K.consumo);
    const fbc = v(K.fbc);
    const cessao = v(K.cessao);
    const transfCapital = v(K.transfCapital);

    const out: Passo[] = [];

    // Nível 1 — PIB (sempre 100 em % do PIB, mas lido do JSON por consistência).
    out.push({ tipo: "nivel", rotulo: "PIB", valor: vPib });

    // Ponte PIB → RNB: renda primária recebida/paga ao exterior.
    out.push({
      tipo: "ponte",
      rotulo: "Renda do exterior (salários + propriedade)",
      delta: +(vRnb - vPib).toFixed(2),
      de: vPib,
      ate: vRnb,
      componentes: [
        { rotulo: "(+) Salários (líq. do exterior)", valor: salarios },
        { rotulo: "(+) Rendas de propriedade (líq. do exterior)", valor: rendasProp },
      ],
    });

    // Nível 2 — Renda nacional bruta.
    out.push({ tipo: "nivel", rotulo: "Renda nacional bruta", valor: vRnb });

    // Ponte RNB → RNDB: outras transferências correntes.
    out.push({
      tipo: "ponte",
      rotulo: "Outras transferências correntes (líq.)",
      delta: +(vRndb - vRnb).toFixed(2),
      de: vRnb,
      ate: vRndb,
      componentes: [{ rotulo: "(+) Outras transferências correntes (líq. do exterior)", valor: outrasTransf }],
    });

    // Nível 3 — Renda nacional disponível bruta.
    out.push({ tipo: "nivel", rotulo: "Renda nacional disponível bruta", valor: vRndb });

    // Ponte RNDB → Poupança bruta: o que não foi consumido.
    out.push({
      tipo: "ponte",
      rotulo: "Despesa de consumo final",
      delta: +(vPoupanca - vRndb).toFixed(2),
      de: vRndb,
      ate: vPoupanca,
      componentes: [{ rotulo: "(−) Despesa de consumo final", valor: consumo }],
    });

    // Nível 4 — Poupança bruta.
    out.push({ tipo: "nivel", rotulo: "Poupança bruta", valor: vPoupanca });

    // Ponte Poupança → Capac./necess. de financiamento: investimento (FBC) + capital residual.
    out.push({
      tipo: "ponte",
      rotulo: "Investimento (FBC) e contas de capital",
      delta: +(vCapacidade - vPoupanca).toFixed(2),
      de: vPoupanca,
      ate: vCapacidade,
      componentes: [
        { rotulo: "(−) Formação bruta de capital", valor: fbc },
        { rotulo: "(+) Cessão de ativos não financeiros não produzidos", valor: cessao },
        { rotulo: "(+) Transferências de capital (líq.)", valor: transfCapital },
      ],
    });

    // Nível 5 — Capacidade / necessidade líquida de financiamento.
    out.push({ tipo: "nivel", rotulo: "Capacidade / necessidade de financiamento", valor: vCapacidade });

    return { passos: out, trimRef: String(ult.trim ?? pib.trim_recente), semDado: false };
  }, [seriePct, pib.trim_recente]);

  // Escala comum: do menor valor (pode ser negativo) ao maior entre níveis e extremos das pontes.
  const { minVal, maxVal } = useMemo(() => {
    const vals: number[] = [0];
    for (const p of passos) {
      if (p.tipo === "nivel") vals.push(p.valor);
      else vals.push(p.de, p.ate);
    }
    return { minVal: Math.min(...vals), maxVal: Math.max(...vals) };
  }, [passos]);

  // Posição (%) de um valor no trilho [minVal, maxVal].
  const span = Math.max(0.0001, maxVal - minVal);
  const posOf = (x: number) => ((x - minVal) / span) * 100;

  return (
    <ChartCard
      title="Da produção à renda disponível"
      subtitle={`Cascata das contas econômicas integradas no ${fmtTrimCurto(trimRef)}, em % do PIB. Cada real produzido (PIB = 100) percorre a sequência contábil até sobrar (ou faltar) financiamento. Verde soma, vermelho subtrai.`}
      footer="Fonte: IBGE/SIDRA — Contas Nacionais Trimestrais, Contas econômicas integradas (2072), valores a preços correntes expressos em % do PIB nominal. Níveis (PIB, Renda nacional bruta, Renda nacional disponível bruta, Poupança bruta, Capacidade/necessidade de financiamento) lidos diretamente; pontes = soma dos componentes (+/−) entre dois níveis. Renda nacional bruta = PIB + renda primária líquida do exterior; Poupança = renda disponível − consumo; Capac./necess. de financiamento = poupança − investimento (± contas de capital)."
      stampGiro={geradoEm}
      stampDado={trimRef}
    >
      {semDado || passos.length === 0 ? (
        <p className="flex h-48 items-center justify-center text-center text-sm text-zinc-400">
          Sem dados de contas econômicas em % do PIB nesta carga.
        </p>
      ) : (
        <>
          {/* Cascata: cada linha alinha rótulo, trilho (barra de nível OU ponte flutuante) e valor. */}
          <div className="flex flex-col gap-1.5">
            {passos.map((p, i) => {
              if (p.tipo === "nivel") {
                const x0 = posOf(Math.min(0, p.valor));
                const x1 = posOf(Math.max(0, p.valor));
                const left = Math.min(x0, x1);
                const width = Math.max(0.6, Math.abs(x1 - x0));
                const negativo = p.valor < 0;
                return (
                  <div key={`n-${i}`} className="flex items-center gap-2">
                    <div className="w-[44%] shrink-0 truncate text-right text-xs font-bold text-[#132960] sm:w-[38%]">
                      {p.rotulo}
                    </div>
                    <div className="relative h-6 flex-1 rounded bg-zinc-50">
                      <div
                        className="absolute inset-y-0 rounded"
                        style={{
                          left: `${left}%`,
                          width: `${width}%`,
                          backgroundColor: negativo ? "#B91C1C" : AZ_NIVEL,
                        }}
                      />
                    </div>
                    <div className="w-14 shrink-0 text-right text-xs font-bold tabular-nums text-[#132960]">
                      {fmtNum(p.valor, 1)}
                    </div>
                  </div>
                );
              }
              // Ponte: segmento flutuante entre o nível anterior (de) e o seguinte (ate).
              const a = posOf(p.de);
              const b = posOf(p.ate);
              const left = Math.min(a, b);
              const width = Math.max(0.6, Math.abs(b - a));
              const cor = variationText(p.delta, 0.005);
              const fundo = p.delta >= 0 ? "#16A34A" : "#DC2626";
              return (
                <div key={`p-${i}`} className="flex items-center gap-2">
                  <div className="w-[44%] shrink-0 truncate text-right text-[11px] text-zinc-500 sm:w-[38%]">
                    {p.rotulo}
                  </div>
                  <div className="relative h-4 flex-1">
                    <div
                      className="absolute inset-y-0 rounded-sm opacity-80"
                      style={{ left: `${left}%`, width: `${width}%`, backgroundColor: fundo }}
                    />
                  </div>
                  <div className="w-14 shrink-0 text-right text-[11px] font-semibold tabular-nums" style={{ color: cor }}>
                    {fmtSignedNum(p.delta, 2)}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Tabela-cascata: leitura precisa dos níveis e das pontes que os ligam. */}
          <div className="mt-4 -mx-1 overflow-x-auto">
            <table className="w-full min-w-[380px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-[#132960]/10 text-[11px] uppercase tracking-wide text-zinc-500">
                  <th scope="col" className="py-2 pl-1 pr-2 text-left font-semibold">
                    Conta
                  </th>
                  <th scope="col" className="py-2 px-2 text-right font-semibold">
                    % do PIB
                  </th>
                </tr>
              </thead>
              <tbody>
                {passos.map((p, i) => {
                  if (p.tipo === "nivel") {
                    return (
                      <tr key={`tn-${i}`} className="border-b border-zinc-100 bg-[#132960]/[0.035]">
                        <th scope="row" className="py-1.5 pl-1 pr-2 text-left font-semibold text-[#132960]">
                          {p.rotulo}
                        </th>
                        <td className="py-1.5 px-2 text-right font-bold tabular-nums text-[#132960]">
                          {fmtNum(p.valor, 2)}
                        </td>
                      </tr>
                    );
                  }
                  return (
                    <tr key={`tp-${i}`} className="border-b border-zinc-100">
                      <td className="py-1 pl-3 pr-2 text-left text-[12px] text-zinc-500">
                        {p.componentes
                          .filter((c) => c.valor != null)
                          .map((c) => c.rotulo)
                          .join("  ")}
                        {p.componentes.every((c) => c.valor == null) ? p.rotulo : null}
                      </td>
                      <td
                        className="py-1 px-2 text-right text-[12px] font-semibold tabular-nums"
                        style={{ color: variationText(p.delta, 0.005) }}
                      >
                        {fmtSignedNum(p.delta, 2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </ChartCard>
  );
}

// Cor dos níveis (barras ancoradas no zero) — azure AZ, mais leve que o navy do rótulo.
const AZ_NIVEL = "#027DFC";
