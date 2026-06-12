"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { CodaceFaixaAtividade } from "@/lib/painel-atividade";
import type { PnadData } from "@/lib/painel-emprego";
import { AzTooltip, ChartCard, azGridProps, azXAxisProps, azYAxisProps } from "@/components/painel/core";
import { AzPeriodSelector, resolvePeriodRange, type AzPeriodValue } from "@/components/painel/charts/AzPeriodSelector";
import { AzTimeSeriesChart, type AzSeriesPoint } from "@/components/painel/charts/AzTimeSeriesChart";
import { AZ_BRAND, AZ_CHART, AZ_TOOLTIP_PROPS, variationFill } from "@/lib/az-chart-theme";
import { fmtMesCurto, fmtNum, fmtPct, fmtSignedPct } from "@/lib/format-br";
import { codaceAreas, mesIso } from "@/components/painel/atividade/v2/shared";

/**
 * Bloco 05 — massa de rendimento real do trabalho (SIDRA 6392): quanto
 * dinheiro do trabalho entra na economia por mês. Dois painéis empilhados
 * (nível e momentum NUNCA no mesmo eixo): linha do nível em R$ bilhões
 * (a série original vem em R$ milhões — dividimos por 1.000, declarado no
 * rodapé) e barras da variação interanual com cor pela direção.
 * Já vem deflacionada pelo IBGE — NÃO re-deflacionar.
 */

export function MassaCard({
  data,
  codaceMensal,
  geradoEm,
}: {
  data: PnadData;
  codaceMensal?: CodaceFaixaAtividade[];
  geradoEm: string;
}) {
  const [period, setPeriod] = useState<AzPeriodValue>({ id: "5y" });

  const serie = useMemo(() => data.massa_rendimento?.serie ?? [], [data.massa_rendimento]);
  const faixas = useMemo(() => codaceAreas(codaceMensal), [codaceMensal]);

  // Nível em R$ bilhões (série original em R$ milhões).
  const nivelPoints = useMemo<AzSeriesPoint[]>(() => {
    const out: AzSeriesPoint[] = [];
    for (const r of serie) {
      if (r.massa_real_mi != null && Number.isFinite(r.massa_real_mi)) {
        out.push([mesIso(r.mes), +(r.massa_real_mi / 1000).toFixed(1)]);
      }
    }
    return out;
  }, [serie]);

  const minIso = nivelPoints.length > 0 ? nivelPoints[0][0] : "";
  const maxIso = nivelPoints.length > 0 ? nivelPoints[nivelPoints.length - 1][0] : "";

  // Barras YoY recortadas à janela do seletor (mesma janela do painel de cima).
  const rowsYoy = useMemo(() => {
    const out: { mes: string; yoy: number }[] = [];
    if (!minIso || !maxIso) return out;
    const { from, to } = resolvePeriodRange(period, minIso, maxIso);
    for (const r of serie) {
      const iso = mesIso(r.mes);
      if (iso >= from && iso <= to && r.massa_yoy_pct != null && Number.isFinite(r.massa_yoy_pct)) {
        out.push({ mes: r.mes, yoy: r.massa_yoy_pct });
      }
    }
    return out;
  }, [serie, period, minIso, maxIso]);

  // Título afirmativo: recorde da série VERIFICADO contra o dado.
  const titulo = useMemo(() => {
    let last: { v: number; mes: string } | null = null;
    let max = -Infinity;
    let lastYoy: number | null = null;
    for (const r of serie) {
      if (r.massa_real_mi != null && Number.isFinite(r.massa_real_mi)) {
        last = { v: r.massa_real_mi, mes: r.mes };
        if (r.massa_real_mi > max) max = r.massa_real_mi;
      }
      if (r.massa_yoy_pct != null && Number.isFinite(r.massa_yoy_pct)) lastYoy = r.massa_yoy_pct;
    }
    if (last == null) return "Massa real de rendimentos do trabalho";
    const bi = fmtNum(last.v / 1000, 0);
    const sufixoYoy = lastYoy != null ? ` (${fmtSignedPct(lastYoy, 1)} em um ano)` : "";
    if (last.v >= max - 1e-9) {
      return `Massa real de rendimentos no recorde da série: R$ ${bi} bi por mês${sufixoYoy}`;
    }
    if (lastYoy != null) {
      return `Massa real de rendimentos de R$ ${bi} bi ${lastYoy >= 0 ? "cresce" : "cai"} ${fmtPct(Math.abs(lastYoy), 1)} em um ano`;
    }
    return `Massa real de rendimentos do trabalho: R$ ${bi} bi por mês`;
  }, [serie]);

  return (
    <ChartCard
      title={titulo}
      subtitle="Ocupação × rendimento médio real, agregados: quanto dinheiro do trabalho entra na economia por mês. É o motor do consumo das famílias — e a ponte do mercado de trabalho para a atividade."
      toolbar={<AzPeriodSelector value={period} onChange={setPeriod} min={minIso} max={maxIso} periods={["1y", "5y", "max"]} />}
      footer="SIDRA 6392 — massa de rendimento mensal real HABITUAL de todos os trabalhos, já deflacionada pelo IBGE (deflator oficial — não re-deflacionamos). Trimestre MÓVEL terminado no mês de referência: janela amostral diferente do trimestre calendário das taxas. É massa do TRABALHO — não inclui aposentadorias nem transferências (não confundir com a 'massa ampliada' do research). Nível exibido em R$ bilhões (série original em R$ milhões ÷ 1.000). Faixas cinzas: recessões CODACE/FGV."
      stampGiro={geradoEm}
      stampDado={maxIso || null}
    >
      {nivelPoints.length === 0 ? (
        <p className="flex h-60 items-center justify-center text-sm text-zinc-400">
          O pipeline ainda não publicou a massa de rendimento (schema v2). Rode o workflow emprego-pipeline.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Nível (R$ bilhões, valores reais)</p>
          <AzTimeSeriesChart
            series={[{ id: "massa", label: "Massa real", color: AZ_BRAND.azure, data: nivelPoints }]}
            unit="none"
            yAxisLabel="R$ bi"
            period={period}
            height={220}
            xRefAreas={faixas}
            showLegend={false}
          />

          <p className="mt-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Variação interanual (YoY)</p>
          <div className="h-[170px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={rowsYoy} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                <CartesianGrid {...azGridProps()} />
                <XAxis {...azXAxisProps()} dataKey="mes" tickFormatter={(m: string) => fmtMesCurto(m)} minTickGap={28} />
                <YAxis {...azYAxisProps()} width={44} tickFormatter={(v: number) => fmtSignedPct(v, 0)} />
                <ReferenceLine y={0} stroke={AZ_CHART.zero} strokeOpacity={AZ_CHART.zeroOpacity} strokeWidth={1.5} />
                <Tooltip
                  content={<AzTooltip hideDot labelFmt={(l) => fmtMesCurto(String(l))} valueFmt={(v) => fmtSignedPct(v, 1)} />}
                  cursor={AZ_TOOLTIP_PROPS.cursor}
                />
                <Bar dataKey="yoy" name="Massa YoY" isAnimationActive={false} maxBarSize={14}>
                  {rowsYoy.map((r) => (
                    <Cell key={r.mes} fill={variationFill(r.yoy)} />
                  ))}
                </Bar>
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </ChartCard>
  );
}
