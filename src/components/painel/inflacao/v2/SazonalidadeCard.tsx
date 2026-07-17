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

import type { IpcaData } from "@/lib/painel-ipca";
import { AzTooltip, ChartCard, azGridProps, azXAxisProps, azYAxisProps } from "@/components/painel/core";
import { AZ_BRAND, AZ_CHART, AZ_TOOLTIP_PROPS } from "@/lib/az-chart-theme";
import { fmtNum, fmtSignedPct } from "@/lib/format-br";
import { num } from "./shared";

/**
 * Bloco 04 — "0,67% no mês é muito?" — depende do PADRÃO do mês civil
 * (jan/fev altos por reajustes e educação; meio do ano baixo).
 *
 * Gramática do card: barra = MEDIANA histórica do mês civil (robusta aos
 * outliers de 2020-22, sem exclusão editorial de anos) + haste mín–máx +
 * pontos = últimos 12 meses realizados, com o mês de referência em destaque.
 */

const MESES_LABEL = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export function SazonalidadeCard({ data }: { data: IpcaData }) {
  const saz = data.sazonalidade;
  const mesRef = data.mes_recente; // "2026-04"
  const mmRef = mesRef.slice(5, 7);

  // Últimos 12 meses realizados do IPCA cheio, indexados pelo mês civil.
  const realizados = useMemo(() => {
    const out = new Map<string, { mes: string; valor: number }>();
    const serie = data.ipca_cheio.serie;
    for (const row of serie.slice(-12)) {
      const v = num(row, "IPCA cheio");
      if (v != null) out.set(row.mes.slice(5, 7), { mes: row.mes, valor: v });
    }
    return out;
  }, [data.ipca_cheio.serie]);

  const rows = useMemo(() => {
    if (!saz) return [];
    return MESES_LABEL.map((label, i) => {
      const mm = String(i + 1).padStart(2, "0");
      const s = saz.por_mes[mm];
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
        mesRealizado: real?.mes ?? null,
        atual: mm === mmRef,
      };
    });
  }, [saz, realizados, mmRef]);

  if (!saz) {
    return (
      <p className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-500">
        Bloco de sazonalidade ainda não disponível neste JSON.
      </p>
    );
  }

  return (
    <ChartCard
      title="IPCA do mês vs padrão sazonal"
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
                  labelFmt={(l) => `Padrão de ${String(l)} (${saz.janela})`}
                />
              }
              cursor={AZ_TOOLTIP_PROPS.cursor}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />

            <Bar
              dataKey="mediana"
              name={`Mediana ${saz.janela}`}
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
