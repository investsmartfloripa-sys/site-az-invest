"use client";

import { useMemo } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { FocusPonto } from "@/lib/painel-ipca";
import { AzTooltip, ChartCard, azGridProps, azXAxisProps, azYAxisProps } from "@/components/painel/core";
import { AZ_BRAND, AZ_CHART, AZ_TOOLTIP_PROPS } from "@/lib/az-chart-theme";
import { fmtDataBR, fmtNum, fmtPct, formatAxisDate, isoFromUTC } from "@/lib/format-br";
import { META, META_PISO, META_TETO } from "./shared";

/**
 * Bloco 06 — "o mercado espera inflação dentro da meta?".
 *
 * Mediana Focus por ano-referência COM a referência que dá sentido ao
 * gráfico: banda da meta sempre visível. Dispersão = ±1 desvio-padrão das
 * respostas pro ano corrente (mín–máx sai distorcido por respondentes
 * desatualizados — crítica do revisor).
 *
 * O confronto realizado × Focus ("o mercado acerta?") fica para a fatia 2 —
 * exige o endpoint Olinda de expectativa 12 meses à frente (suavizada),
 * ainda não testado no pipeline.
 */

const CORES_ANO = [AZ_BRAND.azure, AZ_BRAND.navy, AZ_CHART.ticks];

export function FocusCard({
  focus,
  geradoEm,
}: {
  focus: Record<string, FocusPonto[]>;
  geradoEm: string;
}) {
  const anos = useMemo(() => Object.keys(focus).sort(), [focus]);
  const anoCorrente = anos[0];

  const rows = useMemo(() => {
    const byT = new Map<number, Record<string, number | [number, number] | undefined> & { t: number }>();
    for (const ano of anos) {
      for (const p of focus[ano]) {
        if (p.mediana == null) continue;
        const t = Date.parse(`${p.data}T00:00:00Z`);
        if (!Number.isFinite(t)) continue;
        let row = byT.get(t);
        if (!row) {
          row = { t };
          byT.set(t, row);
        }
        row[ano] = p.mediana;
        if (ano === anoCorrente && p.dp != null) {
          row.banda = [p.mediana - p.dp, p.mediana + p.dp];
        }
      }
    }
    return [...byT.values()].sort((a, b) => a.t - b.t);
  }, [focus, anos, anoCorrente]);

  const spanDays = rows.length > 1 ? Math.round((rows[rows.length - 1].t - rows[0].t) / 86_400_000) : 1;

  const ultimoCorrente = useMemo(() => {
    const serie = focus[anoCorrente] ?? [];
    for (let i = serie.length - 1; i >= 0; i--) {
      if (serie[i].mediana != null) return serie[i];
    }
    return null;
  }, [focus, anoCorrente]);

  if (rows.length === 0) return null;

  return (
    <ChartCard
      title="Expectativas Focus por ano-referência"
      stampGiro={geradoEm}
      stampDado={ultimoCorrente?.data ?? null}
    >
      <div className="h-[280px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
            <CartesianGrid {...azGridProps()} />
            <XAxis
              {...azXAxisProps()}
              dataKey="t"
              type="number"
              scale="time"
              domain={["dataMin", "dataMax"]}
              tickFormatter={(t) => formatAxisDate(isoFromUTC(Number(t)), spanDays)}
              minTickGap={28}
            />
            <YAxis {...azYAxisProps()} width={44} tickFormatter={(v: number) => `${fmtNum(v, 1)}%`} />

            <ReferenceArea
              y1={META_PISO}
              y2={META_TETO}
              fill={AZ_CHART.ticks}
              fillOpacity={0.08}
              stroke="none"
              label={{ value: "banda da meta", position: "insideTopRight", fontSize: 9, fill: AZ_CHART.ticks }}
            />
            <ReferenceLine
              y={META}
              stroke={AZ_BRAND.navy}
              strokeDasharray="4 4"
              strokeWidth={1.2}
              label={{ value: "meta 3,0%", position: "insideBottomRight", fontSize: 9, fill: AZ_BRAND.navy }}
            />

            <Tooltip
              content={
                <AzTooltip labelFmt={(l) => fmtDataBR(isoFromUTC(Number(l)))} valueFmt={(v) => fmtPct(v, 2)} />
              }
              cursor={AZ_TOOLTIP_PROPS.cursor}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />

            <Area
              dataKey="banda"
              name={`±1 dp (${anoCorrente})`}
              stroke="none"
              fill={AZ_BRAND.azure}
              fillOpacity={0.1}
              isAnimationActive={false}
              tooltipType="none"
              connectNulls
            />
            {anos.map((ano, i) => (
              <Line
                key={ano}
                type="monotone"
                dataKey={ano}
                name={`IPCA ${ano}`}
                stroke={CORES_ANO[i % CORES_ANO.length]}
                strokeWidth={ano === anoCorrente ? 2.2 : 1.6}
                dot={false}
                connectNulls
                isAnimationActive={false}
              />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
