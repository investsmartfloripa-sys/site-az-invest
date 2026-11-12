"use client";

import { useMemo } from "react";
import { CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import type { FamiliasEstruturaSocialData } from "@/lib/painel-familias";
import { AzTooltip, ChartCard, azGridProps, azXAxisProps, azYAxisProps, ticksRedondos } from "@/components/painel/core";
import { AZ_BRAND, AZ_CHART, AZ_TOOLTIP_PROPS } from "@/lib/az-chart-theme";
import { fmtNum } from "@/lib/format-br";

/**
 * "Estrutura social" D4 — índice de Gini anual. O eixo é TRUNCADO de
 * propósito (e declarado): o Gini varia centésimos, e num eixo 0–1 a série
 * viraria uma reta. Mín e máx da série vão no tooltip e na nota sob o gráfico — os
 * rótulos de ReferenceDot ficavam colados na borda ("min 0,504 (2024" cortado) e
 * ReferenceDot na borda é proibido pelo AGENTS.md (travava as páginas).
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

  const yEixo = useMemo(() => {
    if (!extremos) return { ticks: [0, 1], domain: [0, 1] as [number, number] };
    return ticksRedondos(extremos.min.valor - 0.005, extremos.max.valor + 0.005);
  }, [extremos]);

  // Casas do eixo pelo passo das marcas (0,02 → 2 casas; 0,005 → 3), sem marcas repetidas.
  const passoEixo = yEixo.ticks.length > 1 ? yEixo.ticks[1] - yEixo.ticks[0] : 0.01;
  const decEixo = passoEixo < 0.01 - 1e-9 ? 3 : 2;

  const rotuloAno = (l: string | number): string => {
    const ano = String(l);
    if (extremos && extremos.min.ano !== extremos.max.ano) {
      if (ano === extremos.min.ano) return `${ano} · mínimo da série`;
      if (ano === extremos.max.ano) return `${ano} · máximo da série`;
    }
    return ano;
  };

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
      footer="IBGE/SIDRA 7435 (PNADC anual). Mesmo no piso da série, o Brasil segue entre os países mais desiguais do mundo. Mínimo e máximo históricos: na nota abaixo do gráfico e no tooltip. Pesquisa anual, ~1 ano de defasagem."
      stampGiro={geradoEm}
      stampDado={ult ? `${ult.ano}-12-01` : null}
    >
      {/* Mesma altura de plot que o cartão vizinho (IPCA por faixa, dois painéis) no xl: antes sobravam ~250 px vazios. */}
      <div className="h-[260px] w-full xl:h-[400px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
            <CartesianGrid {...azGridProps()} />
            <XAxis {...azXAxisProps()} dataKey="ano" minTickGap={20} />
            <YAxis
              {...azYAxisProps()}
              width={48}
              domain={yEixo.domain}
              ticks={yEixo.ticks}
              tickFormatter={(v: number) => fmtNum(v, decEixo)}
            />
            <Tooltip
              content={<AzTooltip labelFmt={rotuloAno} valueFmt={(v) => fmtNum(v, 3)} hideDot />}
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
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      {extremos && extremos.min.ano !== extremos.max.ano ? (
        <p className="mt-2 text-xs text-zinc-600">
          Mínimo da série: <strong style={{ color: AZ_CHART.posText }}>{fmtNum(extremos.min.valor, 3)}</strong> (
          {extremos.min.ano}) · máximo: <strong style={{ color: AZ_CHART.negText }}>{fmtNum(extremos.max.valor, 3)}</strong> (
          {extremos.max.ano})
        </p>
      ) : null}
    </ChartCard>
  );
}
