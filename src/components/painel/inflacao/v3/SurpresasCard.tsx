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

  const stats = useMemo(() => {
    if (surpresas.length === 0) return null;
    const acima = surpresas.filter((s) => s.surpresa_pp > BANDA_EM_LINHA).length;
    const abaixo = surpresas.filter((s) => s.surpresa_pp < -BANDA_EM_LINHA).length;
    const emLinha = surpresas.length - acima - abaixo;
    const mediaAbs = surpresas.reduce((acc, s) => acc + Math.abs(s.surpresa_pp), 0) / surpresas.length;
    return { acima, abaixo, emLinha, mediaAbs, n: surpresas.length };
  }, [surpresas]);

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

  if (rows.length === 0 || !stats) return null;

  return (
    <ChartCard
      title={`Surpresa inflacionária — últimos ${stats.n} meses`}
      subtitle="Realizado menos a mediana Focus da véspera da divulgação, em pontos percentuais."
      footer={`Esperado = mediana da última pesquisa Focus (baseCalculo = 0) antes do release do IBGE. "Em linha" = |surpresa| ≤ ${BANDA_EM_LINHA.toLocaleString("pt-BR")} p.p. Vermelho = acima do consenso (pressão); azul = abaixo.`}
      stampGiro={geradoEm}
      stampDado={surpresas.at(-1)?.mes ?? null}
    >
      <p className="mb-2 text-xs text-zinc-600">
        <strong className="text-[#132960]">{stats.acima}</strong> acima ·{" "}
        <strong className="text-[#132960]">{stats.emLinha}</strong> em linha ·{" "}
        <strong className="text-[#132960]">{stats.abaixo}</strong> abaixo do consenso · desvio absoluto médio{" "}
        <strong className="text-[#132960]">{fmtNum(stats.mediaAbs, 3)} p.p.</strong>
      </p>
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
