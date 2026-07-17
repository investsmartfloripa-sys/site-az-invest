"use client";

import { useMemo } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { FocusAnualIgpmPonto } from "@/lib/painel-igpm";
import { AzTooltip, ChartCard, azGridProps, azXAxisProps, azYAxisProps } from "@/components/painel/core";
import { AZ_BRAND, AZ_CHART, AZ_TOOLTIP_PROPS } from "@/lib/az-chart-theme";
import { fmtDataBR, fmtNum, fmtPct, formatAxisDate, isoFromUTC } from "@/lib/format-br";

/**
 * Mediana Focus do IGP-M por ano-referência — espelho do card do IPCA, SEM a
 * banda de meta (o IGP não tem meta; a régua contra o histórico vive na série
 * longa). Dispersão = ±1 desvio-padrão das respostas pro ano corrente.
 */

const CORES_ANO = [AZ_BRAND.azure, AZ_BRAND.navy, AZ_CHART.ticks];

export function FocusAnosIgpmCard({
  focus,
  geradoEm,
}: {
  focus: Record<string, FocusAnualIgpmPonto[]>;
  geradoEm: string;
}) {
  const anos = useMemo(() => Object.keys(focus).sort(), [focus]);
  const anoCorrente = anos[0];

  const rows = useMemo(() => {
    const byT = new Map<number, Record<string, number | [number, number] | undefined> & { t: number }>();
    for (const ano of anos) {
      for (const p of focus[ano] ?? []) {
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
      footer={`Mediana das expectativas anuais do Focus para o IGP-M (BCB/Olinda, ExpectativasMercadoAnuais), por ano-referência; faixa = ±1 desvio-padrão das respostas para ${anoCorrente} (mín–máx sai distorcido por respondentes desatualizados). Sem banda de meta: o IGP-M não tem meta — as réguas históricas vivem no card da série longa.`}
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
            <ReferenceLine y={0} stroke={AZ_CHART.zero} strokeOpacity={AZ_CHART.zeroOpacity} strokeWidth={1.5} />

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
                name={`IGP-M ${ano}`}
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
