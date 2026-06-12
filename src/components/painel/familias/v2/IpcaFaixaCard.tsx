"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { FamiliasEstruturaSocialData } from "@/lib/painel-familias";
import { AzTooltip, ChartCard, azGridProps, azXAxisProps, azYAxisProps } from "@/components/painel/core";
import { AzPeriodSelector, resolvePeriodRange, type AzPeriodValue } from "@/components/painel/charts/AzPeriodSelector";
import { AZ_BRAND, AZ_CHART, AZ_NEUTRAL_BAND, AZ_TOOLTIP_PROPS } from "@/lib/az-chart-theme";
import { fmtMesCurto, fmtNum, fmtPct, fmtSignedNum } from "@/lib/format-br";
import { isoData, num, serie12mIpcaFaixa } from "./shared";

/**
 * "Estrutura social" D5 — "quem sente mais a inflação?". Acumulado em 12
 * meses por faixa de renda (3 faixas legíveis: muito baixa, média e alta —
 * não as 6 do dado cru em % a.m., ilegíveis). Painel inferior: o SPREAD
 * muito baixa − alta em p.p., com sinal — positivo (vermelho) quando a
 * cesta dos mais pobres encarece MAIS.
 */

const FAIXAS = [
  { key: "muito_baixa", label: "Renda muito baixa", color: "#FF5713" },
  { key: "media", label: "Renda média", color: AZ_BRAND.azure },
  { key: "alta", label: "Renda alta", color: AZ_BRAND.navy },
] as const;

type Row = { mes: string; muito_baixa?: number; media?: number; alta?: number; spread?: number };

/** Spread positivo = inflação pesa MAIS nos pobres = vermelho (semântica invertida do variationFill). */
function corSpread(v: number): string {
  if (!Number.isFinite(v) || Math.abs(v) <= AZ_NEUTRAL_BAND) return AZ_CHART.neutral;
  return v > 0 ? AZ_CHART.neg : AZ_CHART.pos;
}

export function IpcaFaixaCard({
  estruturaSocial,
  geradoEm,
}: {
  estruturaSocial: FamiliasEstruturaSocialData;
  geradoEm: string;
}) {
  const [period, setPeriod] = useState<AzPeriodValue>({ id: "5y" });

  const serie12 = useMemo(() => serie12mIpcaFaixa(estruturaSocial.bloco_ipca_faixa_renda), [estruturaSocial.bloco_ipca_faixa_renda]);

  const todos = useMemo<Row[]>(() => {
    const out: Row[] = [];
    for (const p of serie12) {
      const row: Row = { mes: isoData(p.data) };
      const mb = num(p, "muito_baixa");
      const me = num(p, "media");
      const al = num(p, "alta");
      const sp = num(p, "spread_pp");
      if (mb == null && me == null && al == null) continue;
      if (mb != null) row.muito_baixa = mb;
      if (me != null) row.media = me;
      if (al != null) row.alta = al;
      if (sp != null) row.spread = sp;
      else if (mb != null && al != null) row.spread = +(mb - al).toFixed(2);
      out.push(row);
    }
    return out.sort((a, b) => (a.mes < b.mes ? -1 : 1));
  }, [serie12]);

  const minIso = todos.length > 0 ? todos[0].mes : "";
  const maxIso = todos.length > 0 ? todos[todos.length - 1].mes : "";

  const rows = useMemo(() => {
    if (todos.length === 0) return [];
    const { from, to } = resolvePeriodRange(period, minIso, maxIso);
    return todos.filter((r) => r.mes >= from && r.mes <= to);
  }, [todos, period, minIso, maxIso]);

  const ult = todos[todos.length - 1];

  const titulo =
    ult?.spread != null
      ? ult.spread > 0.1
        ? `A inflação dos mais pobres roda ${fmtNum(ult.spread, 1)} p.p. ACIMA da dos mais ricos (12 meses)`
        : ult.spread < -0.1
          ? `A inflação dos mais pobres roda ${fmtNum(Math.abs(ult.spread), 1)} p.p. ABAIXO da dos mais ricos (12 meses)`
          : "Inflação praticamente igual entre faixas de renda (12 meses)"
      : "IPCA por faixa de renda — quem sente mais?";

  if (todos.length === 0) {
    return (
      <ChartCard
        title="IPCA por faixa de renda — quem sente mais?"
        footer="IPEA (Ipeadata DIMAC_INF*). A série acumulada em 12 meses (v2) ainda não foi publicada pelo builder — rode o workflow familias-pipeline.yml."
        stampGiro={geradoEm}
      >
        <p className="flex h-40 items-center justify-center text-sm text-zinc-400">
          Sem a série acumulada em 12 meses neste JSON.
        </p>
      </ChartCard>
    );
  }

  return (
    <ChartCard
      title={titulo}
      subtitle="Inflação acumulada em 12 meses da cesta de consumo de cada faixa de renda (3 faixas legíveis). Painel de baixo: spread muito baixa − alta, em pontos percentuais."
      toolbar={<AzPeriodSelector value={period} onChange={setPeriod} min={minIso} max={maxIso} periods={["1y", "5y", "max"]} />}
      footer="IPEA — Indicador de Inflação por Faixa de Renda (Ipeadata DIMAC_INF*), acumulado em 12 meses pelo builder. Faixas conforme a Carta de Conjuntura do IPEA. Spread POSITIVO (vermelho): a cesta dos mais pobres encarece mais — tipicamente quando alimentos e energia, que pesam mais na base, puxam o índice."
      stampGiro={geradoEm}
      stampDado={maxIso || null}
    >
      <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Acumulado em 12 meses (%)</p>
      <div className="h-[230px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid {...azGridProps()} />
            <XAxis {...azXAxisProps()} dataKey="mes" tickFormatter={fmtMesCurto} minTickGap={36} />
            <YAxis {...azYAxisProps()} width={40} tickFormatter={(v: number) => `${fmtNum(v, 0)}%`} />
            <Tooltip
              content={<AzTooltip labelFmt={(l) => fmtMesCurto(String(l))} valueFmt={(v) => fmtPct(v, 2)} />}
              cursor={AZ_TOOLTIP_PROPS.cursor}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {FAIXAS.map((f) => (
              <Line
                key={f.key}
                type="monotone"
                dataKey={f.key}
                name={f.label}
                stroke={f.color}
                strokeWidth={2}
                dot={false}
                connectNulls
                isAnimationActive={false}
              />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <p className="mt-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
        Spread: muito baixa − alta (p.p.)
      </p>
      <div className="h-[150px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid {...azGridProps()} />
            <XAxis {...azXAxisProps()} dataKey="mes" tickFormatter={fmtMesCurto} minTickGap={36} />
            <YAxis {...azYAxisProps()} width={40} tickFormatter={(v: number) => fmtSignedNum(v, 0)} />
            <ReferenceLine y={0} stroke={AZ_CHART.zero} strokeOpacity={AZ_CHART.zeroOpacity} strokeWidth={1.5} />
            <Tooltip
              content={<AzTooltip labelFmt={(l) => fmtMesCurto(String(l))} valueFmt={(v) => `${fmtSignedNum(v, 2)} p.p.`} />}
              cursor={AZ_TOOLTIP_PROPS.cursor}
            />
            <Bar dataKey="spread" name="Spread (p.p.)" isAnimationActive={false} maxBarSize={10}>
              {rows.map((r) => (
                <Cell key={r.mes} fill={corSpread(r.spread ?? 0)} />
              ))}
            </Bar>
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
