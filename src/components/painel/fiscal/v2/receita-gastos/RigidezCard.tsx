"use client";

import { useMemo, useState } from "react";
import {
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { FiscalClassicosData } from "@/lib/painel-fiscal";
import { AzTooltip, ChartCard, azGridProps, azXAxisProps, azYAxisProps } from "@/components/painel/core";
import { AzPeriodSelector, type AzPeriodValue } from "@/components/painel/charts/AzPeriodSelector";
import { AZ_BRAND, AZ_CHART, AZ_TOOLTIP_PROPS } from "@/lib/az-chart-theme";
import { fmtMesCurto, fmtNum, fmtPct, formatTimeTickLabel, isoFromUTC, parseIsoUTC } from "@/lib/format-br";
import type { AzSeriesPoint } from "@/components/painel/charts/AzTimeSeriesChart";
import { clipTimeRows, marcosVisiveis, mergeTimeRows, mesIso, timeAxis, yDomainDe } from "./shared";

/**
 * 04b — Rigidez orçamentária: % da despesa que é DISCRICIONÁRIA
 * (discricionárias ÷ despesa total × 100 — razão de apresentação calculada
 * aqui das duas séries prontas do JSON). Mínimo histórico anotado e marcos
 * EC 95 / LC 200 — a história institucional do encolhimento do espaço livre.
 */

export function RigidezCard({ data }: { data: FiscalClassicosData }) {
  const [period, setPeriod] = useState<AzPeriodValue>({ id: "max" });
  const rg = data.receita_e_gastos;

  const points = useMemo<AzSeriesPoint[]>(() => {
    const desp = new Map(rg.despesa_total_pct_pib.map((p) => [p.data, p.valor_pct]));
    const out: AzSeriesPoint[] = [];
    for (const p of rg.discricionarias_12m_pct_pib ?? []) {
      const d = desp.get(p.data);
      if (p.valor_pct != null && typeof d === "number" && Number.isFinite(d) && d > 0) {
        out.push([mesIso(p.data), +((p.valor_pct / d) * 100).toFixed(2)]);
      }
    }
    return out;
  }, [rg]);

  const rowsAll = useMemo(() => mergeTimeRows({ share: points }), [points]);
  const rows = useMemo(() => clipTimeRows(rowsAll, period), [rowsAll, period]);
  const { ticks, spanDays } = useMemo(() => timeAxis(rows), [rows]);
  const marcos = useMemo(() => marcosVisiveis(rows), [rows]);
  const dom = useMemo(() => yDomainDe(rows, ["share"], { padFrac: 0.15 }), [rows]);

  // Mínimo HISTÓRICO (série completa, não só a janela).
  const minimo = useMemo(() => {
    let melhor: { iso: string; valor: number } | null = null;
    for (const [iso, v] of points) {
      if (melhor == null || v < melhor.valor) melhor = { iso, valor: v };
    }
    return melhor;
  }, [points]);

  const minimoVisivel =
    minimo != null && rows.length > 0
      ? (() => {
          const t = parseIsoUTC(minimo.iso);
          return t >= rows[0].t && t <= rows[rows.length - 1].t ? { ...minimo, t } : null;
        })()
      : null;

  const minIso = rowsAll.length > 0 ? isoFromUTC(rowsAll[0].t) : "";
  const maxIso = rowsAll.length > 0 ? isoFromUTC(rowsAll[rowsAll.length - 1].t) : "";

  const ult = points.length > 0 ? points[points.length - 1] : null;

  const titulo = (() => {
    if (!ult) return "Parcela discricionária da despesa";
    const base = `Só ${fmtPct(ult[1], 1)} da despesa do governo central é discricionária`;
    if (minimo && ult[1] - minimo.valor <= 1) return `${base} — perto do mínimo histórico (${fmtPct(minimo.valor, 1)})`;
    if (minimo) return `${base} — o mínimo histórico foi ${fmtPct(minimo.valor, 1)} em ${fmtMesCurto(minimo.iso)}`;
    return base;
  })();

  return (
    <ChartCard
      title={titulo}
      subtitle="Quanto do orçamento ainda é escolha? Participação das despesas discricionárias na despesa primária total (12m móveis) — o resto é obrigatório por lei ou Constituição."
      toolbar={<AzPeriodSelector value={period} onChange={setPeriod} min={minIso} max={maxIso} periods={["1y", "5y", "max"]} />}
      footer={'"Discricionárias" = linha 4.4.2 do RTN (custeio e investimento sujeitos a escolha alocativa), em razão da despesa total do RTN — ambas as séries 12m % PIB do JSON; aqui só a divisão. Ressalva: parte do formalmente discricionário está na prática carimbada — emendas parlamentares impositivas (ECs 86/2015 e 100/2019) — então a rigidez efetiva é ainda maior. Linhas verticais: EC 95 (teto, dez/2016) e LC 200 (arcabouço, ago/2023).'}
      stampGiro={data.gerado_em}
      stampDado={ult ? ult[0] : null}
    >
      <div className="h-[320px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
            <CartesianGrid {...azGridProps()} />
            <XAxis
              {...azXAxisProps()}
              dataKey="t"
              type="number"
              scale="time"
              domain={["dataMin", "dataMax"]}
              ticks={ticks}
              tickFormatter={(t: number) => formatTimeTickLabel(isoFromUTC(Number(t)), spanDays)}
              minTickGap={28}
            />
            <YAxis {...azYAxisProps()} width={48} domain={dom} tickFormatter={(v: number) => `${fmtNum(v, 0)}%`} />

            {marcos.map((m) => (
              <ReferenceLine
                key={m.label}
                x={m.t}
                stroke={AZ_CHART.ticks}
                strokeDasharray="3 3"
                strokeWidth={1}
                label={{ value: m.label, position: "insideTop", fontSize: 9, fill: AZ_CHART.ticks }}
              />
            ))}

            <Tooltip
              content={<AzTooltip labelFmt={(l) => fmtMesCurto(isoFromUTC(Number(l)))} valueFmt={(v) => fmtPct(v, 1)} hideDot />}
              cursor={AZ_TOOLTIP_PROPS.cursor}
            />

            <Line
              type="monotone"
              dataKey="share"
              name="Discricionárias / despesa total"
              stroke={AZ_BRAND.azure}
              strokeWidth={2}
              dot={false}
              connectNulls
              isAnimationActive={false}
            />

            {minimoVisivel ? (
              <ReferenceDot
                x={minimoVisivel.t}
                y={minimoVisivel.valor}
                r={3}
                fill={AZ_BRAND.navy}
                stroke="#FFFFFF"
                strokeWidth={1.2}
                label={{
                  value: `mín. ${fmtPct(minimoVisivel.valor, 1)} (${fmtMesCurto(minimoVisivel.iso)})`,
                  position: "bottom",
                  offset: 6,
                  fontSize: 9,
                  fill: AZ_BRAND.navy,
                }}
              />
            ) : null}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
