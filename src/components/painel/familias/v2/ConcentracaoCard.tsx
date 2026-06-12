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
 * "Estrutura social" D1 — concentração de renda em DUAS linhas que dialogam
 * (top 10% × bottom 40%), em vez da área 100% que escondia a variação. A
 * razão entre as duas vai no tooltip (linha invisível). Anotação: o degrau
 * de 2020 é o Auxílio Emergencial inflando a fatia da base.
 */

type Row = { ano: string; top10: number; bottom40: number; razao: number | null };

export function ConcentracaoCard({
  estruturaSocial,
  geradoEm,
}: {
  estruturaSocial: FamiliasEstruturaSocialData;
  geradoEm: string;
}) {
  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    for (const p of estruturaSocial.bloco_concentracao_renda.serie ?? []) {
      if (!Number.isFinite(p.top10) || !Number.isFinite(p.bottom40)) continue;
      out.push({
        ano: p.ano,
        top10: p.top10,
        bottom40: p.bottom40,
        razao: p.bottom40 > 0 ? +(p.top10 / p.bottom40).toFixed(1) : null,
      });
    }
    return out.sort((a, b) => (a.ano < b.ano ? -1 : 1));
  }, [estruturaSocial.bloco_concentracao_renda.serie]);

  const ult = rows[rows.length - 1];
  const tem2020 = rows.some((r) => r.ano === "2020");

  const titulo = ult
    ? `Os 10% mais ricos ficam com ${fmtPct(ult.top10, 1)} da renda${
        ult.razao != null ? ` — ${fmtNum(ult.razao, 1)}× o que vai aos 40% mais pobres` : ""
      }`
    : "Concentração de renda — top 10% × bottom 40%";

  return (
    <ChartCard
      title={titulo}
      subtitle="Fatia da massa de rendimento domiciliar per capita capturada pelos 10% do topo e pelos 40% da base (PNADC anual). A razão entre as duas aparece no tooltip."
      footer="IBGE/SIDRA 7530 (PNAD Contínua anual) — massa de rendimento por classes acumuladas; top 10 = 100 − classe 'até P90'. O degrau de 2020 reflete o Auxílio Emergencial inflando a fatia da base — efeito transferência, revertido em 2021. Pesquisa anual: o dado chega com ~1 ano de defasagem."
      stampGiro={geradoEm}
      stampDado={ult ? `${ult.ano}-12-01` : null}
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
              content={
                <AzTooltip
                  labelFmt={(l) => String(l)}
                  valueFmt={(v, name) => (name.includes("÷") ? `${fmtNum(v, 1)}×` : fmtPct(v, 1))}
                />
              }
              cursor={AZ_TOOLTIP_PROPS.cursor}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line
              type="monotone"
              dataKey="top10"
              name="10% mais ricos"
              stroke={AZ_BRAND.navy}
              strokeWidth={2.2}
              dot={{ r: 2.5 }}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="bottom40"
              name="40% mais pobres"
              stroke={AZ_BRAND.azure}
              strokeWidth={2.2}
              dot={{ r: 2.5 }}
              isAnimationActive={false}
            />
            {/* Razão SÓ no tooltip — linha invisível. */}
            <Line
              type="monotone"
              dataKey="razao"
              name="Top 10 ÷ bottom 40"
              stroke="transparent"
              strokeWidth={0}
              dot={false}
              activeDot={false}
              legendType="none"
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
