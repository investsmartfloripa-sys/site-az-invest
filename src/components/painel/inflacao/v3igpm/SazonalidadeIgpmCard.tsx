"use client";

import { useMemo } from "react";
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  ErrorBar,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { IgpmData } from "@/lib/painel-igpm";
import { AzTooltip, ChartCard, azGridProps, azXAxisProps, azYAxisProps } from "@/components/painel/core";
import { AZ_BRAND, AZ_CHART, AZ_TOOLTIP_PROPS } from "@/lib/az-chart-theme";
import { fmtNum, fmtSignedPct } from "@/lib/format-br";

/**
 * "0,4% no mês é muito?" — depende do PADRÃO do mês civil do IGP-M cheio.
 * Gramática idêntica ao card do IPCA: barra = MEDIANA pós-96 do mês civil
 * (overview.sazonalidade_pos96, do builder) + haste mín–máx + pontos =
 * últimos 12 meses realizados, com o mês de referência em destaque.
 */

const MESES_LABEL = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export function SazonalidadeIgpmCard({ data }: { data: IgpmData }) {
  const saz = data.overview.sazonalidade_pos96;
  const mesRef = data.mes_recente; // "2026-06"
  const mmRef = mesRef.slice(5, 7);

  // Últimos 12 meses realizados do IGP-M cheio, indexados pelo mês civil
  // (serie_longa do schema v3; fallback: série da análise do v2).
  const realizados = useMemo(() => {
    const out = new Map<string, { mes: string; valor: number }>();
    const base: Array<{ mes: string; valor: number | null }> = data.serie_longa
      ? data.serie_longa.serie.map((r) => ({ mes: r.mes, valor: r.var }))
      : (data.analise?.serie ?? []).map((r) => ({ mes: r.mes, valor: r.igpm }));
    for (const row of base.slice(-12)) {
      if (row.valor != null) out.set(row.mes.slice(5, 7), { mes: row.mes, valor: row.valor });
    }
    return out;
  }, [data.serie_longa, data.analise]);

  const rows = useMemo(() => {
    if (!saz) return [];
    return MESES_LABEL.map((label, i) => {
      const mm = String(i + 1).padStart(2, "0");
      const s = saz[mm];
      const mediana = s?.mediana ?? null;
      const minV = s?.min ?? null;
      const maxV = s?.max ?? null;
      const real = realizados.get(mm);
      return {
        label,
        mediana,
        // ErrorBar do Recharts: offsets [abaixo, acima] relativos à barra.
        amplitude:
          mediana != null && minV != null && maxV != null
            ? ([mediana - minV, maxV - mediana] as [number, number])
            : undefined,
        realizado: real?.valor ?? null,
        atual: mm === mmRef,
      };
    });
  }, [saz, realizados, mmRef]);

  if (!saz || rows.length === 0) return null;

  return (
    <ChartCard
      title="Posição no padrão sazonal"
      footer="Barra = mediana da variação do mês civil do IGP-M desde jan/1996 (pós-Real, calculada no pipeline); haste = mín–máx histórico; pontos = últimos 12 meses realizados, com o mês de referência em destaque. Mediana em vez de média: robusta aos outliers de 2020-21."
      stampGiro={data.gerado_em}
      stampDado={mesRef}
    >
      <div className="h-[280px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
            <CartesianGrid {...azGridProps()} />
            <XAxis {...azXAxisProps()} dataKey="label" interval={0} />
            <YAxis {...azYAxisProps()} width={44} tickFormatter={(v: number) => `${fmtNum(v, 1)}%`} />
            <ReferenceLine y={0} stroke={AZ_CHART.zero} strokeOpacity={AZ_CHART.zeroOpacity} strokeWidth={1.5} />

            <Tooltip
              content={
                <AzTooltip
                  valueFmt={(v) => fmtSignedPct(v, 2)}
                  labelFmt={(l) => `Padrão de ${String(l)} (pós-96)`}
                />
              }
              cursor={AZ_TOOLTIP_PROPS.cursor}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />

            <Bar
              dataKey="mediana"
              name="Mediana pós-96"
              fill={AZ_CHART.ticks}
              fillOpacity={0.45}
              maxBarSize={22}
              isAnimationActive={false}
            >
              <ErrorBar dataKey="amplitude" width={5} strokeWidth={1} stroke={AZ_CHART.labels} direction="y" />
            </Bar>
            <Scatter dataKey="realizado" name="Últimos 12 meses" isAnimationActive={false}>
              {rows.map((r) => (
                <Cell
                  key={r.label}
                  fill={r.atual ? AZ_BRAND.rust : AZ_BRAND.azure}
                  stroke="#fff"
                  strokeWidth={r.atual ? 1.5 : 1}
                />
              ))}
            </Scatter>
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
