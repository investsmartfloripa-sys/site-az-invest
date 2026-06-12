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
import { AZ_BRAND, AZ_SERIES, AZ_SERIES_EXTRA, AZ_TOOLTIP_PROPS } from "@/lib/az-chart-theme";
import { fmtNum, fmtPct, formatTimeTickLabel, isoFromUTC } from "@/lib/format-br";
import { clipTimeRows, fmtTLabel, mergeTimeRows, mesIso, pctPoints, timeAxis, ultimoPct } from "./shared";

/**
 * 04a — Composição da despesa primária com as fatias que FECHAM o total
 * (o stack do dashboard antigo sub-somava ~4 p.p.): previdência, pessoal,
 * BPC, abono+seguro, FUNDEB, subsídios, DEMAIS obrigatórias (residual v2),
 * obrigatórias c/ controle de fluxo (v2) e discricionárias — ordenadas do
 * mais rígido ao discricionário. A linha navy da despesa total sobreposta é
 * a auto-validação visual: o topo do stack coincide com ela por construção.
 */

const RUBRICAS = [
  { id: "previdencia", label: "Previdência (RGPS)", color: AZ_SERIES[4] }, // violeta
  { id: "pessoal", label: "Pessoal", color: AZ_SERIES[0] }, // azure
  { id: "bpc", label: "BPC/LOAS", color: AZ_SERIES[6] }, // ciano
  { id: "abono", label: "Abono e seguro-desemprego", color: AZ_SERIES[3] }, // verde
  { id: "fundeb", label: "FUNDEB", color: AZ_SERIES[5] }, // ocre
  { id: "subsidios", label: "Subsídios", color: AZ_SERIES_EXTRA }, // rosa
  { id: "demais", label: "Demais obrigatórias", color: AZ_SERIES[7] }, // slate
  { id: "obrigFluxo", label: "Obrigatórias c/ controle de fluxo", color: AZ_SERIES[2] }, // rust
  { id: "discr", label: "Discricionárias", color: "#94A3B8" }, // slate claro
] as const;

export function DespesaRubricasCard({ data }: { data: FiscalClassicosData }) {
  const [period, setPeriod] = useState<AzPeriodValue>({ id: "max" });
  const rg = data.receita_e_gastos;
  const dr = data.despesa_rubricas_v2;

  const rowsAll = useMemo(
    () =>
      mergeTimeRows({
        previdencia: pctPoints(rg.previdencia_12m_pct_pib),
        pessoal: pctPoints(rg.pessoal_12m_pct_pib),
        bpc: pctPoints(rg.bpc_loas_12m_pct_pib),
        abono: pctPoints(rg.abono_seguro_12m_pct_pib),
        fundeb: pctPoints(rg.fundeb_12m_pct_pib),
        subsidios: pctPoints(rg.subsidios_12m_pct_pib),
        demais: pctPoints(dr?.demais_obrigatorias_12m_pct_pib),
        obrigFluxo: pctPoints(dr?.obrig_controle_fluxo_12m_pct_pib),
        discr: pctPoints(rg.discricionarias_12m_pct_pib),
        total: pctPoints(rg.despesa_total_pct_pib),
      }),
    [rg, dr],
  );

  const rows = useMemo(() => clipTimeRows(rowsAll, period), [rowsAll, period]);
  const { ticks, spanDays } = useMemo(() => timeAxis(rows), [rows]);

  // Domain manual: topo = max(soma do stack, linha total); base = menor negativo (subsídios podem oscilar).
  const dom = useMemo<[number, number] | undefined>(() => {
    if (rows.length === 0) return undefined;
    let hi = -Infinity;
    let lo = 0;
    for (const r of rows) {
      let soma = 0;
      for (const rub of RUBRICAS) {
        const v = r[rub.id];
        if (typeof v === "number" && Number.isFinite(v)) {
          if (v < 0) lo = Math.min(lo, v);
          else soma += v;
        }
      }
      if (soma > hi) hi = soma;
      const tot = r.total;
      if (typeof tot === "number" && tot > hi) hi = tot;
    }
    if (!Number.isFinite(hi)) return undefined;
    const pad = (hi - lo) * 0.08;
    return [lo - pad, hi + pad];
  }, [rows]);

  const minIso = rowsAll.length > 0 ? isoFromUTC(rowsAll[0].t) : "";
  const maxIso = rowsAll.length > 0 ? isoFromUTC(rowsAll[rowsAll.length - 1].t) : "";

  const prevUlt = ultimoPct(rg.previdencia_12m_pct_pib);
  const totUlt = ultimoPct(rg.despesa_total_pct_pib);

  if (!dr) {
    return (
      <ChartCard title="Composição da despesa primária" stampGiro={data.gerado_em} stampDado={null}>
        <p className="flex h-64 items-center justify-center text-sm text-zinc-400">
          O pipeline ainda não publicou as rubricas v2 (residual + controle de fluxo). Rode o workflow fiscal-pipeline.yml.
        </p>
      </ChartCard>
    );
  }

  const titulo =
    prevUlt && totUlt && totUlt.valor > 0
      ? `Previdência leva ${fmtPct(prevUlt.valor, 1)} do PIB — ${fmtPct((prevUlt.valor / totUlt.valor) * 100, 0)} de uma despesa total de ${fmtPct(totUlt.valor, 1)}`
      : "Composição da despesa primária do governo central";

  return (
    <ChartCard
      title={titulo}
      subtitle="Onde a despesa está alocada? Nove fatias que fecham o total, ordenadas do mais rígido (previdência) ao discricionário — stack fixo, sem toggle. A linha navy é a despesa total do RTN: o topo do stack coincide com ela."
      toolbar={<AzPeriodSelector value={period} onChange={setPeriod} min={minIso} max={maxIso} periods={["1y", "5y", "max"]} />}
      footer={'RTN, % do PIB 12m. "Demais obrigatórias" = linha 4.3 menos as sub-rubricas já plotadas (abono, BPC, FUNDEB, subsídios) — residual que evita dupla contagem; "obrigatórias c/ controle de fluxo" = linha 4.4.1; "discricionárias" = 4.4.2. Com essas fatias o stack fecha com a despesa total por construção (linha navy = auto-validação).'}
      stampGiro={data.gerado_em}
      stampDado={totUlt ? mesIso(totUlt.data) : null}
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

            <Tooltip
              content={<AzTooltip labelFmt={fmtTLabel} valueFmt={(v) => fmtPct(v, 2)} />}
              cursor={AZ_TOOLTIP_PROPS.cursor}
            />
            <Legend wrapperStyle={{ fontSize: 10 }} />

            {RUBRICAS.map((rub) => (
              <Area
                key={rub.id}
                type="monotone"
                dataKey={rub.id}
                name={rub.label}
                stackId="despesa"
                stroke={rub.color}
                strokeWidth={1}
                fill={rub.color}
                fillOpacity={0.55}
                isAnimationActive={false}
              />
            ))}
            <Line
              type="monotone"
              dataKey="total"
              name="Despesa total"
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
