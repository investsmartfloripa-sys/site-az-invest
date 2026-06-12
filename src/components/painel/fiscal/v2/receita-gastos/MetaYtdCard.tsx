"use client";

import { useMemo } from "react";
import {
  CartesianGrid,
  ComposedChart,
  Legend,
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
import { AZ_BRAND, AZ_CHART, AZ_TOOLTIP_PROPS } from "@/lib/az-chart-theme";
import { fmtNum, fmtSignedNum } from "@/lib/format-br";
import { yDomainDe } from "./shared";

/**
 * 02 — Acompanhamento da meta NO ANO-CALENDÁRIO (como o RTN publica e a LDO
 * afere): primário acumulado jan→mês, spaghetti do ano corrente (azure grosso)
 * contra os 5 anos anteriores (cinza fino), com o centro da meta LDO marcado
 * em dezembro quando existe meta vigente.
 */

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"] as const;

const TICKS_MES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

export function MetaYtdCard({ data }: { data: FiscalClassicosData }) {
  const ytd = data.acompanhamento_meta?.primario_central_ytd_brl_mm ?? {};

  const anoCorrente = useMemo(() => {
    const anos = Object.keys(ytd)
      .map(Number)
      .filter((a) => Number.isFinite(a));
    return anos.length > 0 ? Math.max(...anos) : null;
  }, [ytd]);

  const anos = useMemo(() => {
    if (anoCorrente == null) return [];
    const out: number[] = [];
    for (let a = anoCorrente - 5; a <= anoCorrente; a++) {
      if ((ytd[String(a)] ?? []).length > 0) out.push(a);
    }
    return out;
  }, [ytd, anoCorrente]);

  const rows = useMemo(() => {
    const out: Record<string, number>[] = [];
    for (let m = 1; m <= 12; m++) {
      const row: Record<string, number> = { mes: m };
      for (const ano of anos) {
        const p = (ytd[String(ano)] ?? []).find((x) => x.mes === m);
        if (p && Number.isFinite(p.acum_brl_mm)) row[`a${ano}`] = p.acum_brl_mm;
      }
      out.push(row);
    }
    return out;
  }, [ytd, anos]);

  // Centro da meta LDO do ano corrente, convertido p/ R$ pelo PIB nominal 12m.
  const meta = anoCorrente != null ? data.metas_ldo?.anos?.[String(anoCorrente)] : undefined;
  const metaBrlMm =
    meta != null && data.pib_nominal_12m_brl_milhoes != null && data.pib_nominal_12m_brl_milhoes > 0
      ? (meta.centro / 100) * data.pib_nominal_12m_brl_milhoes
      : null;

  const dom = useMemo(
    () =>
      yDomainDe(
        rows,
        anos.map((a) => `a${a}`),
        { incluirZero: true, extras: metaBrlMm != null ? [metaBrlMm] : [] },
      ),
    [rows, anos, metaBrlMm],
  );

  const ultCorrente = useMemo(() => {
    if (anoCorrente == null) return null;
    const arr = ytd[String(anoCorrente)] ?? [];
    return arr.length > 0 ? arr[arr.length - 1] : null;
  }, [ytd, anoCorrente]);

  if (anoCorrente == null || anos.length === 0) {
    return (
      <ChartCard title="Acompanhamento da meta no ano" stampGiro={data.gerado_em} stampDado={null}>
        <p className="flex h-64 items-center justify-center text-sm text-zinc-400">
          O pipeline ainda não publicou o acumulado no ano (schema v2). Rode o workflow fiscal-pipeline.yml.
        </p>
      </ChartCard>
    );
  }

  const titulo = ultCorrente
    ? `Até ${MESES[ultCorrente.mes - 1]}, primário acumulado de R$ ${fmtSignedNum(ultCorrente.acum_brl_mm / 1000, 1)} bi em ${anoCorrente}` +
      (metaBrlMm != null ? ` — a meta do ano pede R$ ${fmtSignedNum(metaBrlMm / 1000, 0)} bi` : "")
    : `Primário acumulado no ano — ${anoCorrente}`;

  return (
    <ChartCard
      title={titulo}
      subtitle="O ano-calendário está no rumo da meta? Primário do governo central acumulado de janeiro até cada mês — o ano corrente contra os cinco anteriores."
      footer={`RTN: primário acumulado jan→mês ("acima da linha"), em R$ correntes — a meta LDO é aferida no ano-calendário, não em 12m móveis. O marcador de dezembro é o CENTRO da meta (banda ±0,25 p.p. do PIB) convertido pelo PIB nominal 12m corrente — aproximação; a aferição oficial considera abatimentos. Anos anteriores em cinza para padrão sazonal (superávits concentrados no início do ano).`}
      stampGiro={data.gerado_em}
      stampDado={ultCorrente ? `${anoCorrente}-${String(ultCorrente.mes).padStart(2, "0")}-01` : null}
    >
      <div className="h-[320px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 8, right: 24, bottom: 4, left: 0 }}>
            <CartesianGrid {...azGridProps()} />
            <XAxis
              {...azXAxisProps()}
              dataKey="mes"
              type="number"
              domain={[1, 12]}
              ticks={TICKS_MES}
              tickFormatter={(m: number) => MESES[Number(m) - 1] ?? String(m)}
            />
            <YAxis {...azYAxisProps()} width={56} domain={dom} tickFormatter={(v: number) => fmtNum(v / 1000, 0)} />
            <ReferenceLine y={0} stroke={AZ_CHART.zero} strokeOpacity={AZ_CHART.zeroOpacity} strokeWidth={1.5} />

            <Tooltip
              content={
                <AzTooltip
                  labelFmt={(l) => MESES[Number(l) - 1] ?? String(l)}
                  valueFmt={(v) => `R$ ${fmtSignedNum(v / 1000, 1)} bi`}
                />
              }
              cursor={AZ_TOOLTIP_PROPS.cursor}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />

            {anos.map((ano) =>
              ano === anoCorrente ? (
                <Line
                  key={ano}
                  type="monotone"
                  dataKey={`a${ano}`}
                  name={String(ano)}
                  stroke={AZ_BRAND.azure}
                  strokeWidth={2.5}
                  dot={{ r: 2.5 }}
                  connectNulls
                  isAnimationActive={false}
                />
              ) : (
                <Line
                  key={ano}
                  type="monotone"
                  dataKey={`a${ano}`}
                  name={String(ano)}
                  stroke="#94A3B8"
                  strokeWidth={1.1}
                  dot={false}
                  connectNulls
                  isAnimationActive={false}
                />
              ),
            )}

            {metaBrlMm != null ? (
              <ReferenceDot
                x={12}
                y={metaBrlMm}
                r={4}
                fill={AZ_BRAND.rust}
                stroke="#FFFFFF"
                strokeWidth={1.5}
                label={{
                  value: `meta LDO ${anoCorrente}`,
                  position: "left",
                  fontSize: 9,
                  fill: AZ_BRAND.rust,
                }}
              />
            ) : null}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-1 text-[10px] text-zinc-400">Eixo Y em R$ bilhões.</p>
    </ChartCard>
  );
}
