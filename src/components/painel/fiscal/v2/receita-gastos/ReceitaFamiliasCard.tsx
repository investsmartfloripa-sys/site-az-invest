"use client";

import { useMemo, useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { FiscalClassicosData } from "@/lib/painel-fiscal";
import { AzTooltip, ChartCard, azGridProps, azXAxisProps, azYAxisProps } from "@/components/painel/core";
import { AzPeriodSelector, type AzPeriodValue } from "@/components/painel/charts/AzPeriodSelector";
import { AZ_BRAND, AZ_SERIES, AZ_TOOLTIP_PROPS } from "@/lib/az-chart-theme";
import { fmtNum, fmtPct, formatTimeTickLabel, isoFromUTC } from "@/lib/format-br";
import { clipTimeRows, fmtTLabel, mergeTimeRows, mesIso, pctPoints, timeAxis, ultimoPct } from "./shared";

/**
 * 03a — Famílias de receita do RTN (linhas 1.1–1.4): stack FIXO e COMPLETO —
 * sem toggle de fatia (toggle muda o total e mente sobre a composição).
 * O stack fecha com a receita TOTAL; a linha navy é a receita LÍQUIDA: o vão
 * entre o topo do stack e a linha são as transferências a estados e municípios.
 */

const FAMILIAS = [
  { id: "adm", label: "Administrada RFB", color: AZ_SERIES[0] }, // azure
  { id: "rgps", label: "RGPS (INSS)", color: AZ_SERIES[4] }, // violeta
  { id: "naoadm", label: "Não administrada", color: AZ_SERIES[6] }, // ciano
  { id: "incent", label: "Incentivos fiscais", color: AZ_SERIES[7] }, // slate
] as const;

export function ReceitaFamiliasCard({ data }: { data: FiscalClassicosData }) {
  const [period, setPeriod] = useState<AzPeriodValue>({ id: "max" });
  const rf = data.receita_familias;
  const rg = data.receita_e_gastos;

  const rowsAll = useMemo(
    () =>
      mergeTimeRows({
        adm: pctPoints(rf?.administrada_rfb_12m_pct_pib),
        rgps: pctPoints(rf?.rgps_12m_pct_pib),
        naoadm: pctPoints(rf?.nao_administrada_12m_pct_pib),
        incent: pctPoints(rf?.incentivos_fiscais_12m_pct_pib),
        liquida: pctPoints(rg.receita_liquida_pct_pib),
      }),
    [rf, rg],
  );

  const rows = useMemo(() => clipTimeRows(rowsAll, period), [rowsAll, period]);
  const { ticks, spanDays } = useMemo(() => timeAxis(rows), [rows]);

  // Domain manual: topo = soma do stack (positivos) ou linha líquida; base = menor negativo (incentivos).
  const dom = useMemo<[number, number] | undefined>(() => {
    if (rows.length === 0) return undefined;
    let hi = -Infinity;
    let lo = 0;
    for (const r of rows) {
      let soma = 0;
      for (const f of FAMILIAS) {
        const v = r[f.id];
        if (typeof v === "number" && Number.isFinite(v)) {
          if (v < 0) lo = Math.min(lo, v);
          else soma += v;
        }
      }
      if (soma > hi) hi = soma;
      const liq = r.liquida;
      if (typeof liq === "number" && liq > hi) hi = liq;
    }
    if (!Number.isFinite(hi)) return undefined;
    const pad = (hi - lo) * 0.08;
    return [lo - pad, hi + pad];
  }, [rows]);

  const minIso = rowsAll.length > 0 ? isoFromUTC(rowsAll[0].t) : "";
  const maxIso = rowsAll.length > 0 ? isoFromUTC(rowsAll[rowsAll.length - 1].t) : "";

  const liqUlt = ultimoPct(rg.receita_liquida_pct_pib);
  const totalUlt = useMemo(() => {
    if (!rf || !liqUlt) return null;
    const partes = [
      rf.administrada_rfb_12m_pct_pib,
      rf.rgps_12m_pct_pib,
      rf.nao_administrada_12m_pct_pib,
      rf.incentivos_fiscais_12m_pct_pib,
    ].map((s) => s.find((p) => p.data === liqUlt.data)?.valor_pct);
    if (partes.some((v) => v == null || !Number.isFinite(v))) return null;
    return (partes as number[]).reduce((a, b) => a + b, 0);
  }, [rf, liqUlt]);

  if (!rf) {
    return (
      <ChartCard title="Famílias de receita" stampGiro={data.gerado_em} stampDado={null}>
        <p className="flex h-64 items-center justify-center text-sm text-zinc-400">
          O pipeline ainda não publicou as famílias de receita (schema v2). Rode o workflow fiscal-pipeline.yml.
        </p>
      </ChartCard>
    );
  }

  const titulo =
    totalUlt != null && liqUlt
      ? `Arrecadação de ${fmtPct(totalUlt, 1)} do PIB vira ${fmtPct(liqUlt.valor, 1)} líquidos após as transferências a estados e municípios`
      : "Famílias de receita do governo central";

  return (
    <ChartCard
      title={titulo}
      subtitle="De onde vem a receita? As quatro famílias do RTN empilhadas (stack fixo — o total é sempre a receita bruta) e a receita líquida sobreposta."
      toolbar={<AzPeriodSelector value={period} onChange={setPeriod} min={minIso} max={maxIso} periods={["1y", "5y", "max"]} />}
      footer="RTN linhas 1.1 (administrada RFB), 1.2 (incentivos fiscais — pode ser levemente negativa), 1.3 (RGPS) e 1.4 (não administrada: dividendos, concessões, royalties...), em % do PIB 12m. O stack fecha com a receita TOTAL; o vão até a linha navy (receita líquida, linha III) são as transferências por repartição a estados e municípios (FPE/FPM, royalties...)."
      stampGiro={data.gerado_em}
      stampDado={liqUlt ? mesIso(liqUlt.data) : null}
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

            <Tooltip
              content={<AzTooltip labelFmt={fmtTLabel} valueFmt={(v) => fmtPct(v, 2)} />}
              cursor={AZ_TOOLTIP_PROPS.cursor}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />

            {FAMILIAS.map((f) => (
              <Area
                key={f.id}
                type="monotone"
                dataKey={f.id}
                name={f.label}
                stackId="familias"
                stroke={f.color}
                strokeWidth={1}
                fill={f.color}
                fillOpacity={0.55}
                isAnimationActive={false}
              />
            ))}
            <Line
              type="monotone"
              dataKey="liquida"
              name="Receita líquida"
              stroke={AZ_BRAND.navy}
              strokeWidth={2.2}
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
