"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  CartesianGrid,
  Cell,
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

import type { AtividadeCodaceData } from "@/lib/painel-atividade";
import type { FiscalClassicosData } from "@/lib/painel-fiscal";
import { AzTooltip, ChartCard, azGridProps, azXAxisProps, azYAxisProps } from "@/components/painel/core";
import { AzPeriodSelector, type AzPeriodValue } from "@/components/painel/charts/AzPeriodSelector";
import { AZ_BRAND, AZ_CHART, AZ_TOOLTIP_PROPS, variationFill } from "@/lib/az-chart-theme";
import { fmtNum, fmtPct, fmtSignedPct, formatTimeTickLabel, isoFromUTC } from "@/lib/format-br";
import {
  clipTimeRows,
  clipXAreasT,
  codaceAreas,
  fmtTLabel,
  marcosVisiveis,
  mergeTimeRows,
  mesIso,
  pctPoints,
  timeAxis,
  ultimoPct,
  yDomainDe,
} from "./shared";

/**
 * ÂNCORA do Painel Receita e Gastos v2 — "o governo gasta mais do que arrecada?".
 *
 * Dois painéis com o MESMO eixo X (travado pela mesma janela, mesmos ticks):
 * (a) tesoura receita líquida × despesa total (% PIB, 12m), com recessões
 *     CODACE sombreadas e marcos institucionais (EC 95, LC 200) em linhas
 *     verticais finas — nada de "regimes" pintados à mão;
 * (b) painel fino de barras do primário central que essa tesoura produz
 *     (verde = superávit, vermelho = déficit — direção literal do número).
 */

export function TesouraCard({ data, codace }: { data: FiscalClassicosData; codace: AtividadeCodaceData | null }) {
  const [period, setPeriod] = useState<AzPeriodValue>({ id: "max" });
  const rg = data.receita_e_gastos;

  const rowsAll = useMemo(
    () =>
      mergeTimeRows({
        receita: pctPoints(rg.receita_liquida_pct_pib),
        despesa: pctPoints(rg.despesa_total_pct_pib),
        primario: pctPoints(rg.primario_central_pct_pib),
      }),
    [rg],
  );

  const rows = useMemo(() => clipTimeRows(rowsAll, period), [rowsAll, period]);
  const { ticks, spanDays } = useMemo(() => timeAxis(rows), [rows]);
  const faixas = useMemo(() => clipXAreasT(codaceAreas(codace?.mensal), rows), [codace?.mensal, rows]);
  const marcos = useMemo(() => marcosVisiveis(rows), [rows]);
  const domTop = useMemo(() => yDomainDe(rows, ["receita", "despesa"]), [rows]);
  const domBot = useMemo(() => yDomainDe(rows, ["primario"], { incluirZero: true }), [rows]);

  const minIso = rowsAll.length > 0 ? isoFromUTC(rowsAll[0].t) : "";
  const maxIso = rowsAll.length > 0 ? isoFromUTC(rowsAll[rowsAll.length - 1].t) : "";

  const recUlt = ultimoPct(rg.receita_liquida_pct_pib);
  const despUlt = ultimoPct(rg.despesa_total_pct_pib);
  const primUlt = ultimoPct(rg.primario_central_pct_pib);

  const titulo = (() => {
    if (!recUlt || !despUlt || !primUlt) return "Receita × despesa do governo central";
    const frente =
      despUlt.valor > recUlt.valor
        ? `Despesa de ${fmtPct(despUlt.valor, 1)} do PIB supera a receita de ${fmtPct(recUlt.valor, 1)}`
        : `Receita de ${fmtPct(recUlt.valor, 1)} do PIB supera a despesa de ${fmtPct(despUlt.valor, 1)}`;
    return `${frente} — primário de ${fmtSignedPct(primUlt.valor, 2)} em 12 meses`;
  })();

  const xAxisProps = {
    ...azXAxisProps(),
    dataKey: "t",
    type: "number" as const,
    scale: "time" as const,
    domain: ["dataMin", "dataMax"] as ["dataMin", "dataMax"],
    ticks,
    tickFormatter: (t: number) => formatTimeTickLabel(isoFromUTC(Number(t)), spanDays),
    minTickGap: 28,
  };

  return (
    <ChartCard
      title={titulo}
      subtitle="O governo central gasta mais do que arrecada? Receita líquida e despesa total acumuladas em 12 meses, em % do PIB; embaixo, o resultado primário que a tesoura produz, no MESMO eixo de tempo."
      toolbar={<AzPeriodSelector value={period} onChange={setPeriod} min={minIso} max={maxIso} periods={["1y", "5y", "max"]} />}
      footer="Tesouro Nacional — RTN (séries 12m móveis ÷ PIB nominal 12m, BCB SGS 4382). Convenção: primário positivo = superávit. Faixas cinzas: recessões CODACE/FGV (cronologia mensal); linhas verticais: EC 95 (teto de gastos, dez/2016) e LC 200 (arcabouço fiscal, ago/2023)."
      stampGiro={data.gerado_em}
      stampDado={recUlt ? mesIso(recUlt.data) : null}
    >
      <div className="flex flex-col gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
          Receita líquida × despesa total (% PIB, 12m)
        </p>
        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={rows} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
              <CartesianGrid {...azGridProps()} />
              <XAxis {...xAxisProps} />
              <YAxis {...azYAxisProps()} width={48} domain={domTop} tickFormatter={(v: number) => `${fmtNum(v, 0)}%`} />
              {faixas.map((f, i) => (
                <ReferenceArea key={`codace-${i}`} x1={f.t1} x2={f.t2} fill={AZ_CHART.ticks} fillOpacity={0.07} stroke="none" />
              ))}
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
                content={<AzTooltip labelFmt={fmtTLabel} valueFmt={(v) => fmtPct(v, 2)} />}
                cursor={AZ_TOOLTIP_PROPS.cursor}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line
                type="monotone"
                dataKey="receita"
                name="Receita líquida"
                stroke={AZ_BRAND.azure}
                strokeWidth={2}
                dot={false}
                connectNulls
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="despesa"
                name="Despesa total"
                stroke={AZ_BRAND.navy}
                strokeWidth={2}
                dot={false}
                connectNulls
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <p className="mt-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
          Resultado primário (% PIB, 12m) — positivo = superávit
        </p>
        <div className="h-[120px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={rows} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
              <CartesianGrid {...azGridProps()} />
              <XAxis {...xAxisProps} />
              <YAxis {...azYAxisProps()} width={48} domain={domBot} tickFormatter={(v: number) => `${fmtNum(v, 0)}%`} />
              {faixas.map((f, i) => (
                <ReferenceArea key={`codace-b-${i}`} x1={f.t1} x2={f.t2} fill={AZ_CHART.ticks} fillOpacity={0.07} stroke="none" />
              ))}
              {marcos.map((m) => (
                <ReferenceLine key={`marco-b-${m.label}`} x={m.t} stroke={AZ_CHART.ticks} strokeDasharray="3 3" strokeWidth={1} />
              ))}
              <ReferenceLine y={0} stroke={AZ_CHART.zero} strokeOpacity={AZ_CHART.zeroOpacity} strokeWidth={1.5} />
              <Tooltip
                content={<AzTooltip labelFmt={fmtTLabel} valueFmt={(v) => fmtSignedPct(v, 2)} hideDot />}
                cursor={AZ_TOOLTIP_PROPS.cursor}
              />
              <Bar dataKey="primario" name="Primário central" isAnimationActive={false} maxBarSize={10}>
                {rows.map((r) => (
                  <Cell key={r.t} fill={variationFill(typeof r.primario === "number" ? r.primario : 0)} />
                ))}
              </Bar>
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </ChartCard>
  );
}
