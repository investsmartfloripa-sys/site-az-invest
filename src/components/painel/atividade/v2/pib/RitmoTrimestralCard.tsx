"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { AtividadePibData, CodaceFaixaAtividade } from "@/lib/painel-atividade";
import { AzTooltip, ChartCard, azGridProps, azXAxisProps, azYAxisProps } from "@/components/painel/core";
import { AzPeriodSelector, resolvePeriodRange, type AzPeriodValue } from "@/components/painel/charts/AzPeriodSelector";
import { AzTimeSeriesChart } from "@/components/painel/charts/AzTimeSeriesChart";
import { AZ_BRAND, AZ_CHART, AZ_TOOLTIP_PROPS, variationFill } from "@/lib/az-chart-theme";
import { fmtSignedPct } from "@/lib/format-br";
import { codaceAreas, fmtTrimCurto, num, toPointsTrim, trimIsoCentral } from "../shared";

/**
 * Ritmo trimestral do PIB em DOIS painéis empilhados (nunca eixo duplo, nunca
 * QoQ e YoY na mesma escala — em janelas com 2020 o eixo único esmaga tudo):
 * (a) QoQ SA em barras com a MEDIANA de 10 anos como régua de "ritmo normal"
 *     (mediana, não média — robusta aos outliers de 2020);
 * (b) YoY em linha com recessões CODACE sombreadas.
 */

export function RitmoTrimestralCard({
  pib,
  codaceTrimestral,
  geradoEm,
}: {
  pib: AtividadePibData;
  codaceTrimestral?: CodaceFaixaAtividade[];
  geradoEm: string;
}) {
  const [period, setPeriod] = useState<AzPeriodValue>({ id: "5y" });

  const serie = pib.variacao.serie;
  const minIso = serie.length > 0 ? trimIsoCentral(serie[0].trim) : "";
  const maxIso = serie.length > 0 ? trimIsoCentral(serie[serie.length - 1].trim) : "";

  const rowsQoq = useMemo(() => {
    const { from, to } = resolvePeriodRange(period, minIso, maxIso);
    return serie
      .filter((r) => {
        const iso = trimIsoCentral(r.trim);
        return iso >= from && iso <= to;
      })
      .map((r) => ({ trim: r.trim, qoq: num(r, "qoq_sa_pib") }))
      .filter((r) => r.qoq != null) as { trim: string; qoq: number }[];
  }, [serie, period, minIso, maxIso]);

  // Mediana do QoQ SA nos últimos 40 trimestres (10 anos) — régua do "ritmo normal".
  const medianaQoq = useMemo(() => {
    const vals = serie
      .slice(-40)
      .map((r) => num(r, "qoq_sa_pib"))
      .filter((v): v is number => v != null)
      .sort((a, b) => a - b);
    if (vals.length === 0) return null;
    const meio = Math.floor(vals.length / 2);
    return vals.length % 2 === 1 ? vals[meio] : +((vals[meio - 1] + vals[meio]) / 2).toFixed(2);
  }, [serie]);

  const yoyPoints = useMemo(() => toPointsTrim(serie, "yoy_pib"), [serie]);
  const faixas = useMemo(() => codaceAreas(codaceTrimestral), [codaceTrimestral]);

  return (
    <ChartCard
      title="A economia cresceu neste trimestre — e o ritmo está acima do normal?"
      subtitle="Painel de cima: variação trimestral com ajuste sazonal (o número-manchete do IBGE) contra a mediana de 10 anos. Painel de baixo: variação interanual, com as recessões datadas pelo CODACE sombreadas."
      toolbar={<AzPeriodSelector value={period} onChange={setPeriod} min={minIso} max={maxIso} periods={["1y", "5y", "max"]} />}
      footer="QoQ SA: SIDRA 5932 var. 6564. Mediana de 10 anos (40 trim) — mediana, não média: robusta aos extremos de 2020 (−9,2% / +7,7%). YoY sobre o mesmo trimestre do ano anterior (var. 6561)."
      stampGiro={geradoEm}
      stampDado={serie.length > 0 ? trimIsoCentral(serie[serie.length - 1].trim) : null}
    >
      <div className="flex flex-col gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Variação trimestral (ajuste sazonal)</p>
        <div className="h-[200px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={rowsQoq} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
              <CartesianGrid {...azGridProps()} />
              <XAxis {...azXAxisProps()} dataKey="trim" tickFormatter={fmtTrimCurto} minTickGap={28} />
              <YAxis {...azYAxisProps()} width={44} tickFormatter={(v: number) => fmtSignedPct(v, 0)} />
              <ReferenceLine y={0} stroke={AZ_CHART.zero} strokeOpacity={AZ_CHART.zeroOpacity} strokeWidth={1.5} />
              {medianaQoq != null ? (
                <ReferenceLine
                  y={medianaQoq}
                  stroke={AZ_BRAND.navy}
                  strokeDasharray="4 4"
                  strokeWidth={1.2}
                  label={{
                    value: `mediana 10a ${fmtSignedPct(medianaQoq, 1)}`,
                    position: "insideTopRight",
                    fontSize: 9,
                    fill: AZ_BRAND.navy,
                  }}
                />
              ) : null}
              <Tooltip
                content={<AzTooltip labelFmt={(l) => fmtTrimCurto(String(l))} valueFmt={(v) => fmtSignedPct(v, 1)} />}
                cursor={AZ_TOOLTIP_PROPS.cursor}
              />
              <Bar dataKey="qoq" name="QoQ SA" isAnimationActive={false} maxBarSize={18} radius={[2, 2, 0, 0]}>
                {rowsQoq.map((r) => (
                  <Cell key={r.trim} fill={variationFill(r.qoq)} />
                ))}
              </Bar>
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <p className="mt-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Variação interanual (YoY)</p>
        <AzTimeSeriesChart
          series={[{ id: "yoy", label: "PIB YoY", color: AZ_BRAND.azure, data: yoyPoints }]}
          unit="%"
          period={period}
          height={200}
          xRefAreas={faixas}
          showLegend={false}
          dots={2}
        />
      </div>
    </ChartCard>
  );
}
