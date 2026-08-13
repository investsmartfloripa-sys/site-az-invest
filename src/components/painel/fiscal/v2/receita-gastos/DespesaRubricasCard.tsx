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

import type { FiscalClassicosData, PontoMensalPct } from "@/lib/painel-fiscal";
import { AzTooltip, ChartCard, azGridProps, azXAxisProps, azYAxisProps } from "@/components/painel/core";
import { AzPeriodSelector, type AzPeriodValue } from "@/components/painel/charts/AzPeriodSelector";
import { AZ_BRAND, AZ_SERIES, AZ_TOOLTIP_PROPS } from "@/lib/az-chart-theme";
import { fmtNum, fmtPct, formatTimeTickLabel, isoFromUTC } from "@/lib/format-br";
import type { AzSeriesPoint } from "@/components/painel/charts/AzTimeSeriesChart";
import { clipTimeRows, fmtTLabel, mergeTimeRows, mesIso, pctPoints, timeAxis, ultimoPct } from "./shared";
import { StatChip } from "./StatChip";

/**
 * 04a — Composição da despesa primária em QUATRO MACRO-FATIAS que fecham o
 * total (as 9 fatias originais com legenda 10px eram ilegíveis — revisão de
 * 13/08): Previdência / Pessoal / Demais obrigatórias (soma ponto a ponto de
 * abono+seguro, BPC/LOAS, FUNDEB, subsídios, demais obrigatórias residual e
 * obrigatórias c/ controle de fluxo) / Discricionárias. A soma é feita AQUI no
 * front (agrupamento de apresentação sobre as séries prontas do JSON); meses
 * sem alguma sub-rubrica ficam fora da macro-fatia para o fechamento não
 * mentir. A linha navy da despesa total sobreposta é a auto-validação visual:
 * o topo do stack coincide com ela por construção.
 */

const MACROS = [
  { id: "previdencia", label: "Previdência (RGPS)", color: AZ_SERIES[4] }, // violeta
  { id: "pessoal", label: "Pessoal", color: AZ_SERIES[0] }, // azure
  { id: "demaisObrig", label: "Demais obrigatórias", color: AZ_SERIES[5] }, // ocre
  { id: "discr", label: "Discricionárias", color: "#94A3B8" }, // slate claro
] as const;

/** Soma ponto a ponto de N séries % PIB — só nos meses em que TODAS existem. */
function somaPontoAPonto(series: ReadonlyArray<ReadonlyArray<PontoMensalPct> | undefined>): AzSeriesPoint[] {
  const mapas = series.map((s) => new Map(pctPoints(s)));
  if (mapas.length === 0) return [];
  const out: AzSeriesPoint[] = [];
  for (const [iso, primeiro] of mapas[0]) {
    let soma = primeiro;
    let completo = true;
    for (let i = 1; i < mapas.length; i++) {
      const v = mapas[i].get(iso);
      if (v == null) {
        completo = false;
        break;
      }
      soma += v;
    }
    if (completo) out.push([iso, +soma.toFixed(4)]);
  }
  out.sort((a, b) => (a[0] < b[0] ? -1 : 1));
  return out;
}

export function DespesaRubricasCard({ data }: { data: FiscalClassicosData }) {
  const [period, setPeriod] = useState<AzPeriodValue>({ id: "max" });
  const rg = data.receita_e_gastos;
  const dr = data.despesa_rubricas_v2;

  // "Demais obrigatórias" (macro) = abono+seguro + BPC/LOAS + FUNDEB +
  // subsídios + demais obrigatórias (residual v2) + obrigatórias c/ controle
  // de fluxo (v2) — somadas ponto a ponto no front.
  const demaisObrigPts = useMemo(
    () =>
      somaPontoAPonto([
        rg.abono_seguro_12m_pct_pib,
        rg.bpc_loas_12m_pct_pib,
        rg.fundeb_12m_pct_pib,
        rg.subsidios_12m_pct_pib,
        dr?.demais_obrigatorias_12m_pct_pib,
        dr?.obrig_controle_fluxo_12m_pct_pib,
      ]),
    [rg, dr],
  );

  const rowsAll = useMemo(
    () =>
      mergeTimeRows({
        previdencia: pctPoints(rg.previdencia_12m_pct_pib),
        pessoal: pctPoints(rg.pessoal_12m_pct_pib),
        demaisObrig: demaisObrigPts,
        discr: pctPoints(rg.discricionarias_12m_pct_pib),
        total: pctPoints(rg.despesa_total_pct_pib),
      }),
    [rg, demaisObrigPts],
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
      for (const m of MACROS) {
        const v = r[m.id];
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
      <ChartCard title="Despesa primária por rubrica (% PIB, 12m)" stampGiro={data.gerado_em} stampDado={null}>
        <p className="flex h-64 items-center justify-center text-sm text-zinc-400">
          O pipeline ainda não publicou as rubricas v2 (residual + controle de fluxo). Rode o workflow fiscal-pipeline.yml.
        </p>
      </ChartCard>
    );
  }

  const chip =
    prevUlt && totUlt && totUlt.valor > 0 ? (
      <StatChip>
        Previdência {fmtPct(prevUlt.valor, 1)} do PIB · {fmtNum((prevUlt.valor / totUlt.valor) * 100, 0)}% da despesa
      </StatChip>
    ) : null;

  return (
    <ChartCard
      title="Despesa primária por rubrica (% PIB, 12m)"
      subtitle="Governo central (RTN) · 4 macro-fatias que fecham o total · linha navy = despesa total (auto-validação)"
      toolbar={
        <>
          {chip}
          <AzPeriodSelector value={period} onChange={setPeriod} min={minIso} max={maxIso} periods={["ytd", "1y", "5y", "max"]} />
        </>
      }
      footer={
        'Leitura: onde a despesa está alocada — e quanto ainda é escolha? Composição das macro-fatias (RTN, % do PIB 12m): "Previdência (RGPS)" = benefícios previdenciários; "Pessoal" = pessoal e encargos; "Demais obrigatórias" = abono e seguro-desemprego + BPC/LOAS + FUNDEB + subsídios + demais obrigatórias (residual da linha 4.3, sem dupla contagem) + obrigatórias c/ controle de fluxo (linha 4.4.1) — somadas ponto a ponto no front, só nos meses em que todas as sub-rubricas existem; "Discricionárias" = linha 4.4.2. Com essas fatias o stack fecha com a despesa total por construção (linha navy = auto-validação) — o topo coincide com a despesa total a menos de raras fatias negativas (subsídios/Proagro, 2 meses históricos). O detalhe das 9 sub-rubricas está no CSV da Análise completa.'
      }
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
            <Legend wrapperStyle={{ fontSize: 11 }} />

            {MACROS.map((m) => (
              <Area
                key={m.id}
                type="monotone"
                dataKey={m.id}
                name={m.label}
                stackId="despesa"
                stroke={m.color}
                strokeWidth={1}
                fill={m.color}
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
