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
import { fmtMesCurto, fmtNum, fmtSignedNum } from "@/lib/format-br";

/**
 * Focus num card só e SEM estatística de pesquisa (relatório 14/08/2026:
 * média/mín–máx/DP/data "atrapalham em vez de ajudar"): o mês divulgado vira
 * três selos — realizado, o que o mercado esperava e a surpresa — e os
 * próximos meses viram uma lista simples de "o mercado espera X%". Embaixo,
 * o histórico de surpresas em gráfico curto.
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
      footer={`Mês divulgado: realizado (FGV) vs o que o mercado esperava (mediana da última pesquisa Focus, baseCalculo = 0, antes da divulgação) e a surpresa em p.p. Próximos meses: mediana da pesquisa Focus mais recente. Gráfico: surpresa = realizado − esperado, mês a mês — vermelho = veio acima do consenso, azul = abaixo, cinza = em linha (±${fmtNum(BANDA_EM_LINHA, 2)} p.p.).`}
      stampGiro={geradoEm}
      stampDado={vespera?.data_pesquisa ?? null}
    >
      <div className="space-y-4">
        <div className="overflow-hidden rounded-lg border border-zinc-100">
          {vespera ? (
            <div className="flex flex-wrap items-center gap-1.5 border-b border-zinc-100 bg-[#f8fafc] px-3 py-2.5">
              <span className="mr-1 text-xs font-semibold text-zinc-800">
                {fmtMesCurto(focusMensal.mes_referencia)} · divulgado
              </span>
              {realizadoMes != null ? (
                <span className="rounded-full bg-[#132960] px-2 py-0.5 text-[10px] font-semibold text-white">
                  realizado {fmtSignedNum(realizadoMes, 2)}%
                </span>
              ) : null}
              {vespera.mediana != null ? (
                <span className="rounded-full border border-[#132960]/20 bg-white px-2 py-0.5 text-[10px] font-semibold text-[#132960]">
                  mercado esperava {fmtSignedNum(vespera.mediana, 2)}%
                </span>
              ) : null}
              {surpresa != null ? (
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
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
            </div>
          ) : null}
          {focusMensal.proximos.length > 0 ? (
            <div className="divide-y divide-zinc-50">
              <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                O que o mercado espera adiante
              </p>
              {focusMensal.proximos.map((p) => (
                <div key={p.mes_ref} className="flex items-center justify-between px-3 py-1.5">
                  <span className="text-xs text-zinc-800">{fmtMesCurto(p.mes_ref)}</span>
                  <span className="text-xs font-semibold tabular-nums text-[#132960]">
                    {p.mediana != null ? `${fmtSignedNum(p.mediana, 2)}%` : "—"}
                  </span>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        {rows.length > 0 ? (
          <div>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              O mercado tem acertado? Surpresas mês a mês
            </p>
            <div className="h-[180px] w-full">
              <ResponsiveContainer>
                <ComposedChart data={rows} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid {...azGridProps()} />
                  <XAxis {...azXAxisProps()} dataKey="mes" interval={2} />
                  <YAxis {...azYAxisProps()} tickFormatter={(v: number) => fmtSignedNum(v, 1)} width={40} />
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
