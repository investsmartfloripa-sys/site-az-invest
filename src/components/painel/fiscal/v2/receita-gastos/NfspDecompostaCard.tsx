"use client";

import { useMemo, useState } from "react";
import {
  Bar,
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

import type { AtividadeCodaceData } from "@/lib/painel-atividade";
import type { FiscalClassicosData } from "@/lib/painel-fiscal";
import { AzTooltip, ChartCard, azGridProps, azXAxisProps, azYAxisProps } from "@/components/painel/core";
import { AzPeriodSelector, type AzPeriodValue } from "@/components/painel/charts/AzPeriodSelector";
import { AZ_BRAND, AZ_CHART, AZ_TOOLTIP_PROPS } from "@/lib/az-chart-theme";
import { fmtNum, fmtPct, fmtSignedPct, formatTimeTickLabel, isoFromUTC } from "@/lib/format-br";
import type { AzSeriesPoint } from "@/components/painel/charts/AzTimeSeriesChart";
import {
  clipTimeRows,
  clipXAreasT,
  codaceAreas,
  fmtTLabel,
  mensalPoints,
  mergeTimeRows,
  mesIso,
  pctPoints,
  timeAxis,
  ultimoMensal,
  ultimoPct,
} from "./shared";

/**
 * 06 — Resultado nominal do setor público CONSOLIDADO, decomposto no formato
 * canônico: nominal = primário − juros. Barras empilhadas mensais (primário
 * com o próprio sinal; juros nominais SEMPRE negativos, como custo) e a linha
 * navy do nominal — que coincide com a soma das barras por construção.
 * Convenção ÚNICA do painel: positivo = superávit (a NFSP do BCB publica
 * déficit positivo; a série já vem convertida do pipeline).
 * Substitui o antigo "Juros × NFSP" (duas linhas de perímetros misturados).
 */

export function NfspDecompostaCard({ data, codace }: { data: FiscalClassicosData; codace: AtividadeCodaceData | null }) {
  const [period, setPeriod] = useState<AzPeriodValue>({ id: "5y" });
  const rg = data.receita_e_gastos;

  const jurosNegPts = useMemo<AzSeriesPoint[]>(
    () => mensalPoints(rg.juros_nominais_sp_12m_pct_pib).map(([d, v]) => [d, -v] as const),
    [rg],
  );

  const rowsAll = useMemo(
    () =>
      mergeTimeRows({
        primario: pctPoints(rg.primario_sp_12m_pct_pib),
        juros: jurosNegPts,
        nominal: pctPoints(rg.nominal_sp_12m_pct_pib),
      }),
    [rg, jurosNegPts],
  );

  const rows = useMemo(() => clipTimeRows(rowsAll, period), [rowsAll, period]);
  const { ticks, spanDays } = useMemo(() => timeAxis(rows), [rows]);
  const faixas = useMemo(() => clipXAreasT(codaceAreas(codace?.mensal), rows), [codace?.mensal, rows]);

  // Domain manual p/ stack com sinais: base = pilha negativa (min(primário,0) + juros), topo = pilha positiva.
  const dom = useMemo<[number, number] | undefined>(() => {
    if (rows.length === 0) return undefined;
    let lo = 0;
    let hi = 0;
    for (const r of rows) {
      const p = typeof r.primario === "number" ? r.primario : 0;
      const j = typeof r.juros === "number" ? r.juros : 0;
      const n = typeof r.nominal === "number" ? r.nominal : 0;
      lo = Math.min(lo, Math.min(p, 0) + j, n);
      hi = Math.max(hi, Math.max(p, 0), n);
    }
    const pad = (hi - lo) * 0.08;
    return [lo - pad, hi + pad];
  }, [rows]);

  const minIso = rowsAll.length > 0 ? isoFromUTC(rowsAll[0].t) : "";
  const maxIso = rowsAll.length > 0 ? isoFromUTC(rowsAll[rowsAll.length - 1].t) : "";

  const nomUlt = ultimoPct(rg.nominal_sp_12m_pct_pib);
  const primUlt = ultimoPct(rg.primario_sp_12m_pct_pib);
  const jurosUlt = ultimoMensal(rg.juros_nominais_sp_12m_pct_pib);

  const titulo = (() => {
    if (!nomUlt || !primUlt || !jurosUlt) return "Resultado nominal do setor público decomposto";
    const cabecalho =
      nomUlt.valor < 0
        ? `Déficit nominal de ${fmtPct(Math.abs(nomUlt.valor), 1)} do PIB`
        : `Superávit nominal de ${fmtPct(nomUlt.valor, 1)} do PIB`;
    const primTexto =
      primUlt.valor >= 0
        ? `superávit primário de ${fmtNum(primUlt.valor, 1)} p.p.`
        : `déficit primário de ${fmtNum(Math.abs(primUlt.valor), 1)} p.p.`;
    return `${cabecalho}: juros de ${fmtNum(jurosUlt.valor, 1)} p.p. e ${primTexto}`;
  })();

  return (
    <ChartCard
      title={titulo}
      subtitle="Quanto do rombo é juro e quanto é fluxo primário? Setor público consolidado, 12m móveis: barras do primário (com sinal) e dos juros nominais (sempre custo, abaixo de zero); a linha navy é o resultado nominal."
      toolbar={<AzPeriodSelector value={period} onChange={setPeriod} min={minIso} max={maxIso} periods={["1y", "5y", "max"]} />}
      footer="BCB SGS, setor público consolidado, % do PIB 12m. Identidade: nominal = primário − juros nominais — a linha coincide com a soma das barras POR CONSTRUÇÃO (auto-validação). Convenção única: positivo = superávit (a NFSP do BCB publica déficit com sinal positivo; a conversão é feita no pipeline). Juros nominais incluem o resultado dos swaps cambiais do BCB — meses de estresse cambial distorcem a série. Faixas cinzas: recessões CODACE."
      stampGiro={data.gerado_em}
      stampDado={nomUlt ? mesIso(nomUlt.data) : null}
    >
      <div className="h-[340px] w-full">
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

            {faixas.map((f, i) => (
              <ReferenceArea key={`codace-${i}`} x1={f.t1} x2={f.t2} fill={AZ_CHART.ticks} fillOpacity={0.07} stroke="none" />
            ))}
            <ReferenceLine y={0} stroke={AZ_CHART.zero} strokeOpacity={AZ_CHART.zeroOpacity} strokeWidth={1.5} />

            <Tooltip
              content={<AzTooltip labelFmt={fmtTLabel} valueFmt={(v) => fmtSignedPct(v, 2)} />}
              cursor={AZ_TOOLTIP_PROPS.cursor}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />

            <Bar
              dataKey="primario"
              name="Primário (SP consolidado)"
              stackId="nfsp"
              fill={AZ_BRAND.azure}
              isAnimationActive={false}
              maxBarSize={10}
            />
            <Bar
              dataKey="juros"
              name="Juros nominais (custo)"
              stackId="nfsp"
              fill={AZ_CHART.neg}
              isAnimationActive={false}
              maxBarSize={10}
            />
            <Line
              type="monotone"
              dataKey="nominal"
              name="Nominal (SP consolidado)"
              stroke={AZ_BRAND.navy}
              strokeWidth={2}
              dot={false}
              connectNulls
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
