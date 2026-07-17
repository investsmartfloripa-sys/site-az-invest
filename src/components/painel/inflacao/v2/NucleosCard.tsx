"use client";

import { useMemo, useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { NucleosBlock } from "@/lib/painel-ipca";
import { AzTooltip, ChartCard, azGridProps, azXAxisProps, azYAxisProps } from "@/components/painel/core";
import { AZ_BRAND, AZ_CHART, AZ_TOOLTIP_PROPS } from "@/lib/az-chart-theme";
import { fmtMesCurto, fmtNum, fmtPct } from "@/lib/format-br";
import { META, META_PISO, META_TETO, num } from "./shared";

/**
 * Bloco 01 — "a inflação subjacente converge para a meta?".
 *
 * Sem spaghetti de 7 linhas: média dos 5 núcleos acompanhados pelo BC
 * (EX0·EX3·MS·DP·P — MA fica fora por ser a versão não suavizada da MS) +
 * banda mín–máx da amplitude entre eles + IPCA cheio como referência em
 * cinza tracejado. EX3 destacável via chip (rótulo neutro — o Copom comunica
 * pela média dos núcleos, não por uma medida "preferida").
 *
 * Tudo em acumulado 12m COMPOSTO calculado no builder; o momentum 3m
 * dessazonalizado anualizado (padrão RI) entra na fatia 2 (exige X-13).
 */
export function NucleosCard({ nucleos, geradoEm }: { nucleos: NucleosBlock; geradoEm: string }) {
  const [mostraEx3, setMostraEx3] = useState(false);

  const rows = useMemo(
    () =>
      (nucleos.serie_12m ?? []).map((r) => ({
        mes: r.mes,
        media_nucleos: num(r, "media_nucleos"),
        banda: [num(r, "nucleos_min"), num(r, "nucleos_max")] as [number | null, number | null],
        EX3: num(r, "EX3"),
        ipca: num(r, "IPCA cheio"),
      })),
    [nucleos.serie_12m],
  );

  const ultimo = rows[rows.length - 1];

  return (
    <ChartCard
      title="Núcleos de inflação (12 meses)"
      toolbar={
        <button
          type="button"
          aria-pressed={mostraEx3}
          onClick={() => setMostraEx3((v) => !v)}
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition ${
            mostraEx3 ? "border-[#132960] bg-white text-[#132960]" : "border-zinc-200 bg-zinc-50 text-zinc-400"
          }`}
        >
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ background: mostraEx3 ? AZ_BRAND.rust : "#d1d5db" }}
          />
          EX3 (exclusão)
        </button>
      }
      stampGiro={geradoEm}
      stampDado={ultimo?.mes ?? null}
    >
      {rows.length === 0 ? (
        <p className="flex h-64 items-center justify-center text-sm text-zinc-400">
          Série de núcleos em 12m ainda não disponível neste JSON.
        </p>
      ) : (
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={rows} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
              <CartesianGrid {...azGridProps()} />
              <XAxis {...azXAxisProps()} dataKey="mes" tickFormatter={fmtMesCurto} minTickGap={28} />
              <YAxis {...azYAxisProps()} width={44} tickFormatter={(v: number) => `${fmtNum(v, 1)}%`} />

              <ReferenceArea
                y1={META_PISO}
                y2={META_TETO}
                fill={AZ_CHART.ticks}
                fillOpacity={0.08}
                stroke="none"
                label={{ value: "banda da meta", position: "insideTopRight", fontSize: 9, fill: AZ_CHART.ticks }}
              />
              <ReferenceLine
                y={META}
                stroke={AZ_BRAND.navy}
                strokeDasharray="4 4"
                strokeWidth={1.2}
                label={{ value: "meta 3,0%", position: "insideBottomRight", fontSize: 9, fill: AZ_BRAND.navy }}
              />

              <Tooltip
                content={<AzTooltip labelFmt={(l) => fmtMesCurto(String(l))} valueFmt={(v) => fmtPct(v, 2)} />}
                cursor={AZ_TOOLTIP_PROPS.cursor}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />

              <Area
                dataKey="banda"
                name="Amplitude dos 5 núcleos"
                stroke="none"
                fill={AZ_BRAND.azure}
                fillOpacity={0.12}
                isAnimationActive={false}
                tooltipType="none"
                connectNulls
              />
              <Line
                type="monotone"
                dataKey="ipca"
                name="IPCA cheio (12m)"
                stroke={AZ_CHART.ticks}
                strokeWidth={1.5}
                strokeDasharray="5 3"
                dot={false}
                isAnimationActive={false}
              />
              {mostraEx3 ? (
                <Line
                  type="monotone"
                  dataKey="EX3"
                  name="EX3 (exclusão)"
                  stroke={AZ_BRAND.rust}
                  strokeWidth={1.8}
                  dot={false}
                  isAnimationActive={false}
                />
              ) : null}
              <Line
                type="monotone"
                dataKey="media_nucleos"
                name="Média dos 5 núcleos"
                stroke={AZ_BRAND.azure}
                strokeWidth={2.2}
                dot={false}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartCard>
  );
}
