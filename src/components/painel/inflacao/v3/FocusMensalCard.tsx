"use client";

import type { FocusMensalBlock } from "@/lib/painel-ipca";
import { ChartCard } from "@/components/painel/core";
import { AZ_CHART } from "@/lib/az-chart-theme";
import { fmtDataBR, fmtMesCurto, fmtNum, fmtSignedNum } from "@/lib/format-br";

/**
 * Curtíssimo prazo do Focus: o que o mercado espera p/ os PRÓXIMOS meses
 * (mediana, dispersão, mín–máx) + a linha da véspera do mês já divulgado,
 * com o realizado e a surpresa. Tabela — dispersão pede números, não linhas.
 */
export function FocusMensalCard({
  focusMensal,
  realizadoMes,
  geradoEm,
}: {
  focusMensal: FocusMensalBlock;
  realizadoMes: number | null;
  geradoEm: string;
}) {
  const vespera = focusMensal.vespera;
  const surpresa =
    realizadoMes != null && vespera?.mediana != null ? realizadoMes - vespera.mediana : null;

  return (
    <ChartCard
      title="Curtíssimo prazo — IPCA mensal no Focus"
      subtitle="Mediana e dispersão das projeções p/ os próximos meses; primeira linha = o mês já divulgado, contra o que o mercado esperava na véspera."
      footer="BCB/Olinda ExpectativaMercadoMensais (baseCalculo = 0 — respondentes dos últimos 30 dias, convenção do boletim Focus). 'Véspera' = última pesquisa antes da divulgação do IBGE (o BC para de coletar o mês após o release). Surpresa = realizado − mediana da véspera."
      stampGiro={geradoEm}
      stampDado={vespera?.data_pesquisa ?? null}
    >
      <div className="overflow-x-auto rounded-lg border border-zinc-100">
        <table className="min-w-full text-xs">
          <thead className="bg-zinc-50">
            <tr>
              <th className="px-3 py-2 text-left font-semibold text-zinc-700">Mês de referência</th>
              <th className="whitespace-nowrap px-3 py-2 text-right font-semibold text-zinc-700">Mediana (%)</th>
              <th className="whitespace-nowrap px-3 py-2 text-right font-semibold text-zinc-700">Média (%)</th>
              <th className="whitespace-nowrap px-3 py-2 text-right font-semibold text-zinc-700">Mín–Máx (%)</th>
              <th className="whitespace-nowrap px-3 py-2 text-right font-semibold text-zinc-700">DP</th>
              <th className="whitespace-nowrap px-3 py-2 text-right font-semibold text-zinc-700">Pesquisa</th>
            </tr>
          </thead>
          <tbody className="bg-white">
            {vespera ? (
              <tr className="border-t border-zinc-50 bg-[#f8fafc]">
                <td className="whitespace-nowrap px-3 py-2 font-semibold text-zinc-800">
                  {fmtMesCurto(focusMensal.mes_referencia)} · divulgado
                  {realizadoMes != null ? (
                    <span className="ml-2 rounded-full bg-[#132960] px-2 py-0.5 text-[10px] font-semibold text-white">
                      realizado {fmtSignedNum(realizadoMes, 2)}%
                    </span>
                  ) : null}
                  {surpresa != null ? (
                    <span
                      className="ml-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                      style={{
                        color: surpresa > 0.02 ? AZ_CHART.negText : surpresa < -0.02 ? AZ_CHART.neutral : "#3f3f46",
                        background: "rgba(19,41,96,0.06)",
                      }}
                    >
                      surpresa {fmtSignedNum(surpresa, 2)} p.p.
                    </span>
                  ) : null}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right font-semibold tabular-nums text-[#132960]">
                  {vespera.mediana != null ? fmtNum(vespera.mediana, 2) : "—"}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-zinc-700">
                  {vespera.media != null ? fmtNum(vespera.media, 2) : "—"}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-zinc-700">
                  {vespera.min != null && vespera.max != null ? `${fmtNum(vespera.min, 2)} a ${fmtNum(vespera.max, 2)}` : "—"}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-zinc-700">
                  {vespera.dp != null ? fmtNum(vespera.dp, 2) : "—"}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-zinc-500">
                  {vespera.data_pesquisa ? fmtDataBR(vespera.data_pesquisa) : "—"}
                </td>
              </tr>
            ) : null}
            {focusMensal.proximos.map((p) => (
              <tr key={p.mes_ref} className="border-t border-zinc-50 hover:bg-zinc-50/60">
                <td className="whitespace-nowrap px-3 py-2 text-zinc-800">{fmtMesCurto(p.mes_ref)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right font-semibold tabular-nums text-[#132960]">
                  {p.mediana != null ? fmtNum(p.mediana, 2) : "—"}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-zinc-700">
                  {p.media != null ? fmtNum(p.media, 2) : "—"}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-zinc-700">
                  {p.min != null && p.max != null ? `${fmtNum(p.min, 2)} a ${fmtNum(p.max, 2)}` : "—"}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-zinc-700">
                  {p.dp != null ? fmtNum(p.dp, 2) : "—"}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-zinc-500">
                  {p.data_pesquisa ? fmtDataBR(p.data_pesquisa) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ChartCard>
  );
}
