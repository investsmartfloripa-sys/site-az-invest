"use client";

import { useMemo } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, YAxis } from "recharts";

import { AzTooltip, azTooltipProps } from "@/components/painel/core/AzTooltip";
import { AZ_BRAND } from "@/lib/az-chart-theme";
import { fmtDataBR, fmtNum } from "@/lib/format-br";

type Props = {
  series: Array<[string, number]>;
  /**
   * @deprecated Ignorado — a sparkline é NEUTRA (azul AZ #027DFC). Pintar o
   * ano inteiro de verde/vermelho pela variação de 1 dia induzia leitura
   * errada. Prop mantida só p/ compatibilidade com chamadores existentes.
   */
  positive?: boolean;
  height?: number;
};

/** Mini-série neutra: área azul AZ com gradiente; tooltip navy com data dd/mm/aaaa. */
export function TickerSparkline({ series, height = 60 }: Props) {
  const data = useMemo(
    () => series.map(([d, v]) => ({ date: d, value: v })),
    [series],
  );

  if (data.length < 2) {
    return <div className="text-xs italic text-zinc-400">sem série</div>;
  }

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="az-sparkfill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={AZ_BRAND.azure} stopOpacity={0.3} />
              <stop offset="100%" stopColor={AZ_BRAND.azure} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <YAxis hide domain={["auto", "auto"]} />
          <Tooltip
            content={
              <AzTooltip
                labelFmt={(l) => fmtDataBR(String(l))}
                valueFmt={(v) => fmtNum(v, 2)}
                hideDot
              />
            }
            cursor={azTooltipProps().cursor}
          />
          <Area
            type="monotone"
            dataKey="value"
            name="Fechamento"
            stroke={AZ_BRAND.azure}
            strokeWidth={1.5}
            fill="url(#az-sparkfill)"
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
