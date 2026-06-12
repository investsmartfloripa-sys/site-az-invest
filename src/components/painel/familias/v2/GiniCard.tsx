"use client";

import { useMemo } from "react";
import {
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { FamiliasEstruturaSocialData } from "@/lib/painel-familias";
import { AzTooltip, ChartCard, azGridProps, azXAxisProps, azYAxisProps } from "@/components/painel/core";
import { AZ_BRAND, AZ_CHART, AZ_TOOLTIP_PROPS } from "@/lib/az-chart-theme";
import { fmtNum } from "@/lib/format-br";

/**
 * "Estrutura social" D4 — índice de Gini anual. O eixo é TRUNCADO de
 * propósito (e declarado): o Gini varia centésimos, e num eixo 0–1 a série
 * viraria uma reta. Mín e máx da série anotados como pontos de referência.
 */

type Row = { ano: string; valor: number };

export function GiniCard({
  estruturaSocial,
  geradoEm,
}: {
  estruturaSocial: FamiliasEstruturaSocialData;
  geradoEm: string;
}) {
  const rows = useMemo<Row[]>(
    () =>
      (estruturaSocial.bloco_gini.serie ?? [])
        .filter((p) => Number.isFinite(p.valor))
        .map((p) => ({ ano: p.ano, valor: p.valor }))
        .sort((a, b) => (a.ano < b.ano ? -1 : 1)),
    [estruturaSocial.bloco_gini.serie],
  );

  const extremos = useMemo(() => {
    if (rows.length === 0) return null;
    let min = rows[0];
    let max = rows[0];
    for (const r of rows) {
      if (r.valor < min.valor) min = r;
      if (r.valor > max.valor) max = r;
    }
    return { min, max };
  }, [rows]);

  const ult = rows[rows.length - 1];

  const yDomain = useMemo<[number, number]>(() => {
    if (!extremos) return [0, 1];
    return [+(extremos.min.valor - 0.01).toFixed(3), +(extremos.max.valor + 0.01).toFixed(3)];
  }, [extremos]);

  const titulo =
    ult && extremos
      ? `Gini em ${fmtNum(ult.valor, 3)} em ${ult.ano}${
          ult.valor <= extremos.min.valor + 0.0001
            ? " — o piso da série"
            : ult.valor >= extremos.max.valor - 0.0001
              ? " — o teto da série"
              : ` — entre o piso (${fmtNum(extremos.min.valor, 3)}) e o teto (${fmtNum(extremos.max.valor, 3)}) da série`
        }`
      : "Índice de Gini — desigualdade de renda";

  return (
    <ChartCard
      title={titulo}
      subtitle="Gini do rendimento domiciliar per capita (0 = igualdade total; 1 = concentração total). EIXO TRUNCADO de propósito: nesta métrica, variações de 0,01 são relevantes — num eixo 0–1 a série viraria uma reta."
      footer="IBGE/SIDRA 7435 (PNADC anual). Mesmo no piso da série, o Brasil segue entre os países mais desiguais do mundo. Pontos anotados: mínimo e máximo históricos. Pesquisa anual, ~1 ano de defasagem."
      stampGiro={geradoEm}
      stampDado={ult ? `${ult.ano}-12-01` : null}
    >
      <div className="h-[260px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 16, right: 16, bottom: 4, left: 0 }}>
            <CartesianGrid {...azGridProps()} />
            <XAxis {...azXAxisProps()} dataKey="ano" minTickGap={20} />
            <YAxis {...azYAxisProps()} width={48} domain={yDomain} tickFormatter={(v: number) => fmtNum(v, 2)} />
            <Tooltip
              content={<AzTooltip labelFmt={(l) => String(l)} valueFmt={(v) => fmtNum(v, 3)} hideDot />}
              cursor={AZ_TOOLTIP_PROPS.cursor}
            />
            <Line
              type="monotone"
              dataKey="valor"
              name="Gini (PNADC)"
              stroke={AZ_BRAND.azure}
              strokeWidth={2.2}
              dot={{ r: 2.5 }}
              isAnimationActive={false}
            />
            {extremos && extremos.min.ano !== extremos.max.ano ? (
              <ReferenceDot
                x={extremos.min.ano}
                y={extremos.min.valor}
                r={3.5}
                fill={AZ_CHART.pos}
                stroke="#FFFFFF"
                strokeWidth={1.2}
                label={{
                  value: `mín ${fmtNum(extremos.min.valor, 3)} (${extremos.min.ano})`,
                  position: "bottom",
                  offset: 8,
                  fontSize: 9,
                  fill: AZ_CHART.posText,
                }}
              />
            ) : null}
            {extremos && extremos.min.ano !== extremos.max.ano ? (
              <ReferenceDot
                x={extremos.max.ano}
                y={extremos.max.valor}
                r={3.5}
                fill={AZ_CHART.neg}
                stroke="#FFFFFF"
                strokeWidth={1.2}
                label={{
                  value: `máx ${fmtNum(extremos.max.valor, 3)} (${extremos.max.ano})`,
                  position: "top",
                  offset: 8,
                  fontSize: 9,
                  fill: AZ_CHART.negText,
                }}
              />
            ) : null}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
