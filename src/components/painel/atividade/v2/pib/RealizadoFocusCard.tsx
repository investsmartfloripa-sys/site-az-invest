"use client";

import { useMemo } from "react";
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  ErrorBar,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { AtividadePibData } from "@/lib/painel-atividade";
import { AzTooltip, ChartCard, azGridProps, azXAxisProps, azYAxisProps } from "@/components/painel/core";
import { AZ_BRAND, AZ_CHART, AZ_TOOLTIP_PROPS, variationFill } from "@/lib/az-chart-theme";
import { fmtPct, fmtSignedPct } from "@/lib/format-br";
import { num } from "../shared";

/**
 * Realizado × Focus — fecha o ciclo passado→futuro da página: crescimento
 * anual entregue (acum. no ano do 4º trimestre) e, à direita, as medianas
 * Focus dos próximos anos como barras translúcidas com a dispersão (±1 dp)
 * como whisker. Régua: MEDIANA do período plotado (média seria puxada por
 * 2020/2021).
 */

type Row = { ano: string; valor: number; tipo: "realizado" | "focus"; dp?: number };

export function RealizadoFocusCard({ pib, geradoEm }: { pib: AtividadePibData; geradoEm: string }) {
  const anoCorrente = parseInt(pib.trim_recente.slice(0, 4), 10);

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    for (const r of pib.variacao.serie) {
      if (!r.trim.endsWith("-T04")) continue;
      const v = num(r, "acum_ano_pib");
      if (v != null) out.push({ ano: r.trim.slice(0, 4), valor: v, tipo: "realizado" });
    }
    for (const ano of [anoCorrente, anoCorrente + 1]) {
      const arr = pib.focus[String(ano)] ?? [];
      for (let i = arr.length - 1; i >= 0; i--) {
        if (arr[i].mediana != null) {
          out.push({ ano: String(ano), valor: arr[i].mediana as number, tipo: "focus", dp: arr[i].dp ?? undefined });
          break;
        }
      }
    }
    return out.sort((a, b) => (a.ano < b.ano ? -1 : 1));
  }, [pib.variacao.serie, pib.focus, anoCorrente]);

  const medianaRealizado = useMemo(() => {
    const vals = rows
      .filter((r) => r.tipo === "realizado")
      .map((r) => r.valor)
      .sort((a, b) => a - b);
    if (vals.length === 0) return null;
    const meio = Math.floor(vals.length / 2);
    return vals.length % 2 === 1 ? vals[meio] : +((vals[meio - 1] + vals[meio]) / 2).toFixed(2);
  }, [rows]);

  return (
    <ChartCard
      title="Como o crescimento esperado se compara com o histórico?"
      subtitle="Barras sólidas: crescimento anual realizado. Barras translúcidas: mediana Focus mais recente, com a dispersão das projeções (±1 desvio-padrão) como whisker."
      footer="Realizado: acumulado no ano no 4º trimestre (SIDRA 5932 var. 6563). Projetado: mediana Focus mais recente por ano-referência (±1 dp — min/máx carregam respostas-outlier). Régua: mediana do período plotado."
      stampGiro={geradoEm}
      stampDado={null}
    >
      <div className="h-[260px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
            <CartesianGrid {...azGridProps()} />
            <XAxis {...azXAxisProps()} dataKey="ano" minTickGap={16} />
            <YAxis {...azYAxisProps()} width={44} tickFormatter={(v: number) => fmtSignedPct(v, 0)} />
            <ReferenceLine y={0} stroke={AZ_CHART.zero} strokeOpacity={AZ_CHART.zeroOpacity} strokeWidth={1.5} />
            {medianaRealizado != null ? (
              <ReferenceLine
                y={medianaRealizado}
                stroke={AZ_BRAND.navy}
                strokeDasharray="4 4"
                strokeWidth={1.2}
                label={{
                  value: `mediana ${fmtPct(medianaRealizado, 1)}`,
                  position: "insideTopLeft",
                  fontSize: 9,
                  fill: AZ_BRAND.navy,
                }}
              />
            ) : null}
            <Tooltip
              content={
                <AzTooltip
                  labelFmt={(l) => String(l)}
                  valueFmt={(v) => fmtSignedPct(v, 1)}
                />
              }
              cursor={AZ_TOOLTIP_PROPS.cursor}
            />
            <Bar dataKey="valor" name="Crescimento anual" isAnimationActive={false} maxBarSize={22} radius={[2, 2, 0, 0]}>
              {rows.map((r) => (
                <Cell
                  key={r.ano}
                  fill={r.tipo === "focus" ? AZ_BRAND.azure : variationFill(r.valor)}
                  fillOpacity={r.tipo === "focus" ? 0.45 : 1}
                  stroke={r.tipo === "focus" ? AZ_BRAND.azure : undefined}
                  strokeDasharray={r.tipo === "focus" ? "4 3" : undefined}
                />
              ))}
              <ErrorBar dataKey="dp" width={5} strokeWidth={1.2} stroke={AZ_BRAND.navy} />
            </Bar>
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
