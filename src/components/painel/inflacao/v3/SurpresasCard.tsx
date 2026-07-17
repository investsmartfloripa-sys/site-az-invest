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
import { AzTooltip, azGridProps, azTooltipProps, azXAxisProps, azYAxisProps, ChartCard } from "@/components/painel/core";
import { AZ_CHART } from "@/lib/az-chart-theme";
import { fmtMesCurto, fmtNum, fmtSignedNum } from "@/lib/format-br";

/**
 * Surpresa inflacionária: realizado − mediana Focus da véspera, mês a mês.
 * Barra vermelha = veio acima do esperado; azul = abaixo. A matéria-prima
 * do texto de release ("o IPCA veio X p.p. acima/abaixo do consenso").
 */

const BANDA_EM_LINHA = 0.05;

export function SurpresasCard({ focusMensal, geradoEm }: { focusMensal: FocusMensalBlock; geradoEm: string }) {
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

  if (rows.length === 0) return null;

  return (
    <ChartCard
      title="Surpresa inflacionária"
      stampGiro={geradoEm}
      stampDado={surpresas.at(-1)?.mes ?? null}
    >
      <div className="h-[260px] w-full">
        <ResponsiveContainer>
          <ComposedChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid {...azGridProps} />
            <XAxis {...azXAxisProps} dataKey="mes" interval={2} />
            <YAxis {...azYAxisProps} tickFormatter={(v: number) => fmtSignedNum(v, 1)} width={44} />
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
            <Line dataKey="realizado" name="Realizado" stroke="transparent" dot={false} activeDot={false} legendType="none" />
            <Line dataKey="esperado" name="Esperado (véspera)" stroke="transparent" dot={false} activeDot={false} legendType="none" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
