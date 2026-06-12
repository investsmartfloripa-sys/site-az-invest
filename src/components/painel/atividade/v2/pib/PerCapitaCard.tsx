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

import type { AtividadePibData } from "@/lib/painel-atividade";
import { AzTooltip, ChartCard, azGridProps, azXAxisProps, azYAxisProps } from "@/components/painel/core";
import { AZ_CHART, AZ_TOOLTIP_PROPS, variationFill } from "@/lib/az-chart-theme";
import { fmtBRL, fmtSignedPct } from "@/lib/format-br";

/**
 * PIB per capita — "o brasileiro médio está ficando mais rico?". Crescer 1%
 * com a população crescendo 0,4% é outra história: as barras são a variação
 * REAL per capita (oficial, SIDRA 6784 v9814) e a linha cinza é o PIB total,
 * para o leitor ver o quanto a demografia come do crescimento.
 */

export function PerCapitaCard({ pib, geradoEm }: { pib: AtividadePibData; geradoEm: string }) {
  const rows = useMemo(
    () =>
      (pib.per_capita?.serie ?? [])
        .filter((r) => r.var_real_per_capita != null)
        .map((r) => ({
          ano: r.ano,
          perCapita: r.var_real_per_capita as number,
          pibTotal: r.var_real_pib,
          nominal: r.per_capita_nominal,
        })),
    [pib.per_capita],
  );

  const ult = rows[rows.length - 1];

  if (rows.length === 0) return null;

  return (
    <ChartCard
      title="O brasileiro médio está ficando mais rico?"
      subtitle={
        ult
          ? `Em ${ult.ano}, o PIB por habitante cresceu ${fmtSignedPct(ult.perCapita, 1)} em termos reais (${
              ult.nominal != null ? `${fmtBRL(ult.nominal, 0)} por pessoa no ano` : "SCN anual"
            }). A diferença para a linha do PIB total é o crescimento populacional.`
          : undefined
      }
      footer="IBGE SIDRA 6784 (SCN anual): variação em volume do PIB per capita (v9814, oficial) e do PIB (v9810). O SCN anual definitivo sai com ~2 anos de defasagem — a série termina antes do PIB trimestral."
      stampGiro={geradoEm}
      stampDado={ult ? `${ult.ano}-12-01` : null}
    >
      <div className="h-[260px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
            <CartesianGrid {...azGridProps()} />
            <XAxis {...azXAxisProps()} dataKey="ano" minTickGap={20} />
            <YAxis {...azYAxisProps()} width={44} tickFormatter={(v: number) => fmtSignedPct(v, 0)} />
            <ReferenceLine y={0} stroke={AZ_CHART.zero} strokeOpacity={AZ_CHART.zeroOpacity} strokeWidth={1.5} />
            <Tooltip
              content={<AzTooltip labelFmt={(l) => String(l)} valueFmt={(v) => fmtSignedPct(v, 1)} />}
              cursor={AZ_TOOLTIP_PROPS.cursor}
            />
            <Bar dataKey="perCapita" name="PIB per capita (real)" isAnimationActive={false} maxBarSize={18} radius={[2, 2, 0, 0]}>
              {rows.map((r) => (
                <Cell key={r.ano} fill={variationFill(r.perCapita)} />
              ))}
            </Bar>
            <Line
              type="monotone"
              dataKey="pibTotal"
              name="PIB total (real)"
              stroke="#94A3B8"
              strokeWidth={1.8}
              strokeDasharray="5 3"
              dot={false}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
