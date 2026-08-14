"use client";

import { useMemo } from "react";
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { FocusMensalBlock } from "@/lib/painel-ipca";
import { AzTooltip, ChartCard, azGridProps, azTooltipProps, azXAxisProps, azYAxisProps } from "@/components/painel/core";
import { AZ_CHART } from "@/lib/az-chart-theme";
import { fmtDataBR, fmtMesCurto, fmtNum, fmtSignedNum } from "@/lib/format-br";

/**
 * Focus num card só (relatório ago/2026: "juntar esses dois gráficos"):
 * em cima, a tabela de curtíssimo prazo — o mês divulgado com realizado e
 * surpresa + o que o mercado espera para os próximos meses; embaixo, o
 * histórico de surpresas (realizado − mediana da véspera). Mesma matéria,
 * uma leitura: o mercado tem acertado o IGP-M? E o que espera agora?
 */

const BANDA_EM_LINHA = 0.05;

export function FocusCurtoPrazoCard({
  focusMensal,
  realizadoMes,
  geradoEm,
  indicador = "IGP-M",
}: {
  focusMensal: FocusMensalBlock;
  realizadoMes: number | null;
  geradoEm: string;
  indicador?: string;
}) {
  const vespera = focusMensal.vespera;
  const surpresa =
    realizadoMes != null && vespera?.mediana != null ? realizadoMes - vespera.mediana : null;

  const surpresas = focusMensal.surpresas;
  const rows = useMemo(
    () =>
      surpresas.map((s) => ({
        mes: fmtMesCurto(s.mes),
        surpresa: s.surpresa_pp,
        realizado: s.realizado,
        esperado: s.esperado,
      })),
    [surpresas],
  );

  return (
    <ChartCard
      title={`Focus — ${indicador} no curtíssimo prazo`}
      footer={`Tabela: mediana/média/dispersão da pesquisa Focus (baseCalculo = 0) para o mês divulgado (linha destacada, com realizado e surpresa) e para os próximos meses. Gráfico: surpresa = realizado − mediana da última pesquisa antes da divulgação — barra vermelha = veio acima do consenso, azul = abaixo, cinza = em linha (±${fmtNum(BANDA_EM_LINHA, 2)} p.p.).`}
      stampGiro={geradoEm}
      stampDado={vespera?.data_pesquisa ?? null}
    >
      <div className="space-y-5">
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
                          color:
                            surpresa > BANDA_EM_LINHA
                              ? AZ_CHART.negText
                              : surpresa < -BANDA_EM_LINHA
                                ? AZ_CHART.neutral
                                : "#3f3f46",
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
                    {vespera.min != null && vespera.max != null
                      ? `${fmtNum(vespera.min, 2)} a ${fmtNum(vespera.max, 2)}`
                      : "—"}
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

        {rows.length > 0 ? (
          <div>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              O mercado tem acertado? Surpresas mês a mês
            </p>
            <div className="h-[240px] w-full">
              <ResponsiveContainer>
                <ComposedChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid {...azGridProps()} />
                  <XAxis {...azXAxisProps()} dataKey="mes" interval={2} />
                  <YAxis {...azYAxisProps()} tickFormatter={(v: number) => fmtSignedNum(v, 1)} width={44} />
                  <Tooltip
                    content={
                      <AzTooltip
                        valueFmt={(v, name) =>
                          name === "Surpresa" ? `${fmtSignedNum(v, 2)} p.p.` : `${fmtNum(v, 2)}%`
                        }
                      />
                    }
                    cursor={azTooltipProps().cursor}
                  />
                  <ReferenceLine y={0} stroke="rgba(19,41,96,0.55)" strokeWidth={1} />
                  <Bar dataKey="surpresa" name="Surpresa" radius={[3, 3, 0, 0]} maxBarSize={18}>
                    {rows.map((r) => (
                      <Cell
                        key={r.mes}
                        fill={
                          r.surpresa > BANDA_EM_LINHA
                            ? AZ_CHART.neg
                            : r.surpresa < -BANDA_EM_LINHA
                              ? AZ_CHART.neutral
                              : "#94A3B8"
                        }
                      />
                    ))}
                  </Bar>
                  {/* Linhas transparentes: realizado × esperado no tooltip sem roubar largura das barras */}
                  <Line
                    dataKey="realizado"
                    name="Realizado"
                    stroke="transparent"
                    dot={false}
                    activeDot={false}
                    legendType="none"
                  />
                  <Line
                    dataKey="esperado"
                    name="Esperado (véspera)"
                    stroke="transparent"
                    dot={false}
                    activeDot={false}
                    legendType="none"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : null}
      </div>
    </ChartCard>
  );
}
