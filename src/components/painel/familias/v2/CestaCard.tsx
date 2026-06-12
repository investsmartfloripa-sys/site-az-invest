"use client";

import { useMemo, useState } from "react";
import {
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { FamiliasPoderCompraData } from "@/lib/painel-familias";
import { AzTooltip, ChartCard, azGridProps, azXAxisProps, azYAxisProps } from "@/components/painel/core";
import { AzPeriodSelector, resolvePeriodRange, type AzPeriodValue } from "@/components/painel/charts/AzPeriodSelector";
import { AZ_BRAND, AZ_CHART, AZ_TOOLTIP_PROPS } from "@/lib/az-chart-theme";
import { fmtBRL, fmtMesCurto, fmtNum, fmtPct } from "@/lib/format-br";
import { Chip, mediaPontos, minMaxPontos, pontosData } from "./shared";

/**
 * "Poder de compra" C1 — quantas HORAS de salário mínimo compram uma cesta
 * básica. Linha única (horas_sm) contra a banda mín–máx HISTÓRICA e a média
 * tracejada: o leitor vê em 2 segundos se o momento atual é caro ou barato
 * na régua da própria série. Painel FIXO de capitais (v2) — imune a
 * composição variável da média.
 */

export function CestaCard({ poderCompra, geradoEm }: { poderCompra: FamiliasPoderCompraData; geradoEm: string }) {
  const [period, setPeriod] = useState<AzPeriodValue>({ id: "max" });

  const bloco = poderCompra.bloco_cesta_basica;
  const horasPts = useMemo(() => pontosData(bloco.serie, "horas_sm"), [bloco.serie]);

  const rows = useMemo(() => {
    if (horasPts.length === 0) return [];
    const { from, to } = resolvePeriodRange(period, horasPts[0][0], horasPts[horasPts.length - 1][0]);
    return horasPts.filter(([d]) => d >= from && d <= to).map(([mes, horas]) => ({ mes, horas }));
  }, [horasPts, period]);

  const extremos = useMemo(() => minMaxPontos(horasPts), [horasPts]);
  const media = useMemo(() => mediaPontos(horasPts), [horasPts]);

  const minIso = horasPts.length > 0 ? horasPts[0][0] : "";
  const maxIso = horasPts.length > 0 ? horasPts[horasPts.length - 1][0] : "";

  const ult = bloco.serie.length > 0 ? bloco.serie[bloco.serie.length - 1] : null;

  const titulo =
    ult != null
      ? `Uma cesta básica custa ${fmtNum(ult.horas_sm, 0)} horas de salário mínimo — ${
          media == null
            ? "régua histórica no gráfico"
            : ult.horas_sm < media - 1
              ? `abaixo da média histórica (${fmtNum(media, 0)}h)`
              : ult.horas_sm > media + 1
                ? `acima da média histórica (${fmtNum(media, 0)}h)`
                : `em linha com a média histórica (${fmtNum(media, 0)}h)`
        }`
      : "Cesta básica em horas de salário mínimo";

  const yDomain = useMemo<[number, number]>(() => {
    if (!extremos) return [0, 1];
    const pad = Math.max((extremos.max - extremos.min) * 0.1, 2);
    return [Math.floor(extremos.min - pad), Math.ceil(extremos.max + pad)];
  }, [extremos]);

  return (
    <ChartCard
      title={titulo}
      subtitle="Custo da cesta básica média ÷ valor da hora de salário mínimo (SM bruto ÷ 220h). Quanto MENOR, maior o poder de compra. A banda cinza é o intervalo mín–máx de toda a série."
      toolbar={<AzPeriodSelector value={period} onChange={setPeriod} min={minIso} max={maxIso} periods={["1y", "5y", "max"]} />}
      footer={`DIEESE via Ipeadata — painel FIXO de ${bloco.painel_capitais?.length ?? "—"} capitais (média simples), imune a entradas e saídas de cidades na média. Horas = cesta ÷ (SM bruto ÷ 220h trabalhadas/mês): régua PRÓPRIA do painel — difere da conta oficial do DIEESE (salário líquido e jornada legal).${bloco.nota_v2 ? ` ${bloco.nota_v2}` : ""}`}
      stampGiro={geradoEm}
      stampDado={maxIso || null}
    >
      <div className="mb-3 flex flex-wrap gap-2">
        {ult != null ? <Chip label={`Cesta (${fmtMesCurto(ult.data)})`} valor={fmtBRL(ult.cesta_brl, 0)} /> : null}
        {ult != null ? <Chip label="% do salário mínimo" valor={fmtPct(ult.pct_sm, 1)} hint="cesta ÷ SM bruto do mês" /> : null}
      </div>
      <div className="h-[280px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
            <CartesianGrid {...azGridProps()} />
            <XAxis {...azXAxisProps()} dataKey="mes" tickFormatter={fmtMesCurto} minTickGap={36} />
            <YAxis {...azYAxisProps()} width={44} domain={yDomain} tickFormatter={(v: number) => `${fmtNum(v, 0)}h`} />
            {extremos ? (
              <ReferenceArea
                y1={extremos.min}
                y2={extremos.max}
                fill={AZ_CHART.ticks}
                fillOpacity={0.06}
                stroke="none"
                label={{ value: "faixa histórica", position: "insideTopRight", fontSize: 9, fill: AZ_CHART.ticks }}
              />
            ) : null}
            {media != null ? (
              <ReferenceLine
                y={media}
                stroke={AZ_BRAND.navy}
                strokeDasharray="4 4"
                strokeWidth={1.2}
                label={{ value: `média ${fmtNum(media, 0)}h`, position: "insideBottomRight", fontSize: 9, fill: AZ_BRAND.navy }}
              />
            ) : null}
            <Tooltip
              content={<AzTooltip labelFmt={(l) => fmtMesCurto(String(l))} valueFmt={(v) => `${fmtNum(v, 1)} h de SM`} />}
              cursor={AZ_TOOLTIP_PROPS.cursor}
            />
            <Line
              type="monotone"
              dataKey="horas"
              name="Horas de SM por cesta"
              stroke={AZ_BRAND.azure}
              strokeWidth={2.2}
              dot={false}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
