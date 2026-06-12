"use client";

import { useMemo, useState } from "react";
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

import type { FamiliasPoderCompraData } from "@/lib/painel-familias";
import { AzTooltip, ChartCard, azGridProps, azXAxisProps, azYAxisProps } from "@/components/painel/core";
import { AzPeriodSelector, resolvePeriodRange, type AzPeriodValue } from "@/components/painel/charts/AzPeriodSelector";
import { AZ_BRAND, AZ_TOOLTIP_PROPS } from "@/lib/az-chart-theme";
import { fmtMesCurto, fmtNum } from "@/lib/format-br";
import { pontosData } from "./shared";

/**
 * "Poder de compra" C2+C3 FUNDIDOS — salário mínimo em US$ pela PTAX × em
 * US$ por paridade de poder de compra (PPC), no MESMO eixo: a distância
 * entre as linhas é o desalinhamento cambial. Régua: média de 20 anos do
 * SM em US$ PTAX (do builder). Footer anti-manipulação obrigatório.
 */

type Row = { mes: string; ptax: number | null; ppc: number | null };

export function SmDolarCard({ poderCompra, geradoEm }: { poderCompra: FamiliasPoderCompraData; geradoEm: string }) {
  const [period, setPeriod] = useState<AzPeriodValue>({ id: "max" });

  const ptaxPts = useMemo(() => pontosData(poderCompra.bloco_cambio_ptax.serie, "sm_usd_ptax"), [poderCompra.bloco_cambio_ptax.serie]);
  const ppcPts = useMemo(() => pontosData(poderCompra.bloco_ppc.serie, "sm_usd_ppc"), [poderCompra.bloco_ppc.serie]);
  const media20 = poderCompra.bloco_cambio_ptax.media_20a_sm_usd_ptax ?? null;

  const todos = useMemo<Row[]>(() => {
    const byMes = new Map<string, Row>();
    for (const [mes, v] of ptaxPts) {
      byMes.set(mes, { mes, ptax: v, ppc: null });
    }
    for (const [mes, v] of ppcPts) {
      const row = byMes.get(mes);
      if (row) row.ppc = v;
      else byMes.set(mes, { mes, ptax: null, ppc: v });
    }
    return [...byMes.values()].sort((a, b) => (a.mes < b.mes ? -1 : 1));
  }, [ptaxPts, ppcPts]);

  const minIso = todos.length > 0 ? todos[0].mes : "";
  const maxIso = todos.length > 0 ? todos[todos.length - 1].mes : "";

  const rows = useMemo(() => {
    if (todos.length === 0) return [];
    const { from, to } = resolvePeriodRange(period, minIso, maxIso);
    return todos.filter((r) => r.mes >= from && r.mes <= to);
  }, [todos, period, minIso, maxIso]);

  const ultPtax = ptaxPts.length > 0 ? ptaxPts[ptaxPts.length - 1] : null;

  const titulo =
    ultPtax != null
      ? `Salário mínimo vale US$ ${fmtNum(ultPtax[1], 0)} pela PTAX${
          media20 != null
            ? ultPtax[1] > media20 * 1.03
              ? ` — acima da média de 20 anos (US$ ${fmtNum(media20, 0)})`
              : ultPtax[1] < media20 * 0.97
                ? ` — abaixo da média de 20 anos (US$ ${fmtNum(media20, 0)})`
                : ` — em linha com a média de 20 anos (US$ ${fmtNum(media20, 0)})`
            : ""
        }`
      : "Salário mínimo em dólar — PTAX × PPC";

  return (
    <ChartCard
      title={titulo}
      subtitle="Duas conversões do mesmo salário: pela PTAX (poder de compra em moeda forte, sensível ao câmbio) e por paridade de poder de compra (o que o SM compra DENTRO do país). A distância entre as linhas é o desalinhamento cambial."
      toolbar={<AzPeriodSelector value={period} onChange={setPeriod} min={minIso} max={maxIso} periods={["1y", "5y", "max"]} />}
      footer="SM nominal ÷ PTAX média do mês (BCB SGS 1619/3697) e SM em US$ PPC (Ipeadata/IPEA). CUIDADO com comparações entre governos: o SM em dólar PTAX desaba sempre que o câmbio sobe — diz mais sobre o câmbio do que sobre política de renda. A régua honesta é a distância da média de 20 anos (linha tracejada), não o pico ou o vale de um mandato específico."
      stampGiro={geradoEm}
      stampDado={maxIso || null}
    >
      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
            <CartesianGrid {...azGridProps()} />
            <XAxis {...azXAxisProps()} dataKey="mes" tickFormatter={fmtMesCurto} minTickGap={36} />
            <YAxis {...azYAxisProps()} width={48} tickFormatter={(v: number) => `$${fmtNum(v, 0)}`} />
            {media20 != null ? (
              <ReferenceLine
                y={media20}
                stroke={AZ_BRAND.navy}
                strokeDasharray="4 4"
                strokeWidth={1.2}
                label={{
                  value: `média 20a (PTAX): US$ ${fmtNum(media20, 0)}`,
                  position: "insideBottomRight",
                  fontSize: 9,
                  fill: AZ_BRAND.navy,
                }}
              />
            ) : null}
            <Tooltip
              content={<AzTooltip labelFmt={(l) => fmtMesCurto(String(l))} valueFmt={(v) => `US$ ${fmtNum(v, 0)}`} />}
              cursor={AZ_TOOLTIP_PROPS.cursor}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line
              type="monotone"
              dataKey="ptax"
              name="SM em US$ (PTAX)"
              stroke={AZ_BRAND.azure}
              strokeWidth={2.2}
              dot={false}
              connectNulls
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="ppc"
              name="SM em US$ (PPC)"
              stroke="#7C3AED"
              strokeWidth={2}
              dot={false}
              connectNulls
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
