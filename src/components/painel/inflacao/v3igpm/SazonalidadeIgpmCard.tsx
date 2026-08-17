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
 * Barra = MEDIANA pós-96 do mês civil (overview.sazonalidade_pos96, do
 * builder), colorida pela DIREÇÃO típica do mês (alta = vermelho, queda =
 * azul — semântica de inflação); haste = média ± 2 desvios-padrão (fallback
 * mín–máx quando o Blob ainda não traz media/std); losango = média; pontos =
 * últimos 12 meses realizados coloridos pelo próprio sinal, com o mês de
 * referência contornado em rust.
 */

const MESES_LABEL = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** Direção típica/realizada → cor (semântica de inflação da casa). */
function corDirecao(v: number | null | undefined, fallback: string): string {
  if (v == null || v === 0) return fallback;
  return v > 0 ? AZ_CHART.neg : AZ_CHART.neutral;
}

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

  const { rows, temStd, dominio } = useMemo(() => {
    if (!saz) return { rows: [], temStd: false, dominio: undefined as [number, number] | undefined };
    let algumStd = false;
    let yMin = 0;
    let yMax = 0;
    const out = MESES_LABEL.map((label, i) => {
      const mm = String(i + 1).padStart(2, "0");
      const s = saz[mm];
      const mediana = s?.mediana ?? null;
      const media = s?.media ?? null;
      const std = s?.std ?? null;
      const minV = s?.min ?? null;
      const maxV = s?.max ?? null;
      const real = realizados.get(mm);

      // Haste preferencial: média ± 2 DP; fallback: mín–máx histórico.
      // ErrorBar do Recharts: offsets [abaixo, acima] relativos à barra (mediana).
      let amplitude: [number, number] | undefined;
      let bandaLo: number | null = null;
      let bandaHi: number | null = null;
      if (mediana != null && media != null && std != null) {
        algumStd = true;
        bandaLo = media - 2 * std;
        bandaHi = media + 2 * std;
        amplitude = [mediana - bandaLo, bandaHi - mediana];
      } else if (mediana != null && minV != null && maxV != null) {
        bandaLo = minV;
        bandaHi = maxV;
        amplitude = [mediana - minV, maxV - mediana];
      }

      for (const v of [mediana, media, bandaLo, bandaHi, real?.valor ?? null]) {
        if (v != null) {
          if (v < yMin) yMin = v;
          if (v > yMax) yMax = v;
        }
      }

      return {
        label,
        mediana,
        media,
        amplitude,
        realizado: real?.valor ?? null,
        atual: mm === mmRef,
      };
    });
    const folga = Math.max((yMax - yMin) * 0.08, 0.1);
    return {
      rows: out,
      temStd: algumStd,
      dominio: [yMin - folga, yMax + folga] as [number, number],
    };
  }, [saz, realizados, mmRef]);

  if (!saz || rows.length === 0) return null;

  return (
    <ChartCard
      title="Posição no padrão sazonal"
      footer={`Barra = mediana da variação do mês civil do IGP-M desde jan/1996 (pós-Real, calculada no pipeline), vermelha quando o mês é tipicamente de alta e azul quando tipicamente de queda; haste = ${temStd ? "média ± 2 desvios-padrão do mês civil" : "mín–máx histórico"}; losango = média; pontos = últimos 12 meses realizados, coloridos pelo próprio sinal e com o mês de referência contornado em laranja. Mediana como estatística central: robusta aos outliers de 2020-21.`}
      stampGiro={data.gerado_em}
      stampDado={mesRef}
    >
      <p className="mb-2 text-xs leading-relaxed text-zinc-600">
        <strong className="font-semibold text-[#132960]">Como ler:</strong> a barra é o comportamento típico de
        cada mês do calendário desde 1996 (vermelha = mês que costuma ter alta; azul = que costuma ter queda). A
        haste é a faixa usual do mês (média ± 2 desvios: ~95% das observações caem aí) e o losango cinza é a
        média. Os pontos são os últimos 12 meses de fato — ponto abaixo da barra = aquele mês veio mais fraco
        que o padrão; o contorno laranja marca o mês de referência.
      </p>
      <div className="h-[280px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
            <CartesianGrid {...azGridProps()} />
            <XAxis {...azXAxisProps()} dataKey="label" interval={0} />
            <YAxis
              {...azYAxisProps()}
              width={44}
              domain={dominio ?? ["auto", "auto"]}
              tickFormatter={(v: number) => `${fmtNum(v, 1)}%`}
            />
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

            <Bar dataKey="mediana" name="Mediana pós-96" maxBarSize={22} isAnimationActive={false}>
              {rows.map((r) => (
                <Cell key={r.label} fill={corDirecao(r.mediana, AZ_CHART.ticks)} fillOpacity={0.45} />
              ))}
              <ErrorBar dataKey="amplitude" width={5} strokeWidth={1} stroke={AZ_CHART.labels} direction="y" />
            </Bar>
            <Scatter
              dataKey="media"
              name="Média pós-96"
              shape="diamond"
              fill={AZ_CHART.ticks}
              isAnimationActive={false}
            />
            <Scatter dataKey="realizado" name="Últimos 12 meses" isAnimationActive={false}>
              {rows.map((r) => (
                <Cell
                  key={r.label}
                  fill={corDirecao(r.realizado, AZ_CHART.ticks)}
                  stroke={r.atual ? AZ_BRAND.rust : "#fff"}
                  strokeWidth={r.atual ? 2 : 1}
                />
              ))}
            </Scatter>
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
