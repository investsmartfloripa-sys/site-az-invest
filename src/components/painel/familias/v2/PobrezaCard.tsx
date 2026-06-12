"use client";

import { useMemo } from "react";
import {
  CartesianGrid,
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
import { AZ_BRAND, AZ_CHART, AZ_TOOLTIP_PROPS } from "@/lib/az-chart-theme";
import { fmtNum, fmtPct } from "@/lib/format-br";

/**
 * "Estrutura social" D2 — pobreza monetária nas 3 linhas internacionais do
 * Banco Mundial (PPC 2021). Eventos anotados (Auxílio Emergencial 2020);
 * nota obrigatória: as linhas foram ATUALIZADAS em 2025 (PPC 2021) — os
 * níveis não batem com relatórios antigos.
 */

const LINHAS = [
  { key: "pct_300", label: "< US$ 3,00/dia (extrema)", color: "#FF5713" },
  { key: "pct_420", label: "< US$ 4,20/dia", color: "#A16207" },
  { key: "pct_830", label: "< US$ 8,30/dia", color: AZ_BRAND.azure },
] as const;

type Row = { ano: string; pct_300?: number; pct_420?: number; pct_830?: number };

export function PobrezaCard({
  estruturaSocial,
  geradoEm,
}: {
  estruturaSocial: FamiliasEstruturaSocialData;
  geradoEm: string;
}) {
  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    for (const p of estruturaSocial.bloco_pobreza.serie ?? []) {
      const row: Row = { ano: p.ano };
      if (p.pct_300 != null && Number.isFinite(p.pct_300)) row.pct_300 = p.pct_300;
      if (p.pct_420 != null && Number.isFinite(p.pct_420)) row.pct_420 = p.pct_420;
      if (p.pct_830 != null && Number.isFinite(p.pct_830)) row.pct_830 = p.pct_830;
      out.push(row);
    }
    return out.sort((a, b) => (a.ano < b.ano ? -1 : 1));
  }, [estruturaSocial.bloco_pobreza.serie]);

  const serie830 = useMemo(() => rows.filter((r) => r.pct_830 != null) as Array<Row & { pct_830: number }>, [rows]);
  const ult830 = serie830[serie830.length - 1];
  const min830 = useMemo(
    () => (serie830.length > 0 ? Math.min(...serie830.map((r) => r.pct_830)) : null),
    [serie830],
  );
  const tem2020 = rows.some((r) => r.ano === "2020");

  const titulo = ult830
    ? `${fmtPct(ult830.pct_830, 1)} da população vive com menos de US$ 8,30/dia${
        min830 != null && ult830.pct_830 <= min830 + 0.001 ? " — o menor patamar da série" : ""
      }`
    : "Pobreza monetária — linhas internacionais";

  return (
    <ChartCard
      title={titulo}
      subtitle="Percentual da população abaixo de cada linha de pobreza do Banco Mundial, em paridade de poder de compra (PPC 2021)."
      footer="Ipeadata/IBGE (PNADC) — linhas do Banco Mundial em PPC 2021: US$ 3,00/dia (pobreza extrema), US$ 4,20 e US$ 8,30/dia. ATENÇÃO: as linhas foram atualizadas em 2025 (PPC 2021 substituiu PPC 2017) — os níveis NÃO são comparáveis aos relatórios antigos (US$ 1,90/2,15). O degrau de 2020 reflete o Auxílio Emergencial; pesquisa anual, ~1 ano de defasagem."
      stampGiro={geradoEm}
      stampDado={rows.length > 0 ? `${rows[rows.length - 1].ano}-12-01` : null}
    >
      <div className="h-[280px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
            <CartesianGrid {...azGridProps()} />
            <XAxis {...azXAxisProps()} dataKey="ano" minTickGap={20} />
            <YAxis {...azYAxisProps()} width={40} domain={[0, "auto"]} tickFormatter={(v: number) => `${fmtNum(v, 0)}%`} />
            {tem2020 ? (
              <ReferenceLine
                x="2020"
                stroke={AZ_CHART.zero}
                strokeOpacity={0.4}
                strokeDasharray="3 3"
                strokeWidth={1}
                label={{ value: "Auxílio Emergencial", position: "insideTop", fontSize: 9, fill: "#334155" }}
              />
            ) : null}
            <Tooltip
              content={<AzTooltip labelFmt={(l) => String(l)} valueFmt={(v) => fmtPct(v, 1)} />}
              cursor={AZ_TOOLTIP_PROPS.cursor}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {LINHAS.map((l) => (
              <Line
                key={l.key}
                type="monotone"
                dataKey={l.key}
                name={l.label}
                stroke={l.color}
                strokeWidth={2}
                dot={{ r: 2 }}
                connectNulls
                isAnimationActive={false}
              />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
