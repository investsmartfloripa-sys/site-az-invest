"use client";

import { useMemo, useState, type ReactNode } from "react";

import { AzPeriodSelector, resolvePeriodRange, type AzPeriodValue } from "@/components/painel/charts/AzPeriodSelector";
import {
  AzTimeSeriesChart,
  type AzRefLine,
  type AzTimeSeries,
  type AzUnit,
  type AzXRefArea,
} from "@/components/painel/charts/AzTimeSeriesChart";
import { ChartCard } from "@/components/painel/core";
import type { Nivel } from "@/lib/painel-fiscal";
import { NIVEL_RISCO, faixasParaBandas, valoresNaJanela, type FaixasBase } from "./shared";

/**
 * Card de série temporal COM BANDAS DE RISCO — o formato canônico da aba
 * Indicadores de Risco Fiscal. As faixas (verde → atenção → crítico → ruptura)
 * são pintadas ao fundo, clipadas à janela do AzPeriodSelector, com rótulo e
 * limiar; referências pontuais da literatura entram como refLines. Um chip de
 * nível ao lado do título dá o estado atual sem depender só da cor.
 */
export function RiskSeriesCard({
  id,
  title,
  subtitle,
  series,
  benchmarks,
  faixas,
  unit = "%",
  unidadeFaixas,
  refLines = [],
  xRefAreas,
  nivel,
  valorAtual,
  footer,
  stampGiro,
  stampDado,
  height = 300,
  defaultPeriod = { id: "max" },
  variant = "hero",
  yAxisLabel,
  showLegend,
  seriesEndLabels,
  toolbarExtra,
}: {
  id?: string;
  title: string;
  subtitle?: string;
  series: AzTimeSeries[];
  benchmarks?: AzTimeSeries[];
  faixas?: FaixasBase | null;
  unit?: AzUnit;
  /** Sufixo dos limiares nos rótulos das bandas (default "%"). */
  unidadeFaixas?: string;
  refLines?: AzRefLine[];
  xRefAreas?: AzXRefArea[];
  /** Nível atual → chip colorido ao lado do título (não depende só da cor da banda). */
  nivel?: Nivel;
  /** Valor atual formatado, exibido no chip (ex.: "441% da receita"). */
  valorAtual?: string;
  footer?: ReactNode;
  stampGiro?: string | Date | null;
  stampDado?: string | Date | null;
  height?: number;
  defaultPeriod?: AzPeriodValue;
  variant?: "default" | "hero";
  yAxisLabel?: string;
  showLegend?: boolean;
  seriesEndLabels?: boolean;
  /** Controles extras à esquerda do seletor de período (ex.: toggle % PIB / % Receita). */
  toolbarExtra?: ReactNode;
}) {
  const [period, setPeriod] = useState<AzPeriodValue>(defaultPeriod);

  const { minIso, maxIso } = useMemo(() => {
    let min = "";
    let max = "";
    for (const s of [...series, ...(benchmarks ?? [])]) {
      for (const [d] of s.data) {
        if (!min || d < min) min = d;
        if (!max || d > max) max = d;
      }
    }
    return { minIso: min, maxIso: max };
  }, [series, benchmarks]);

  // Bandas clipadas à janela visível (mesma folga de 8% do chart).
  const refAreas = useMemo(() => {
    if (!faixas || !minIso) return [];
    const { from, to } = resolvePeriodRange(period, minIso, maxIso);
    const valores: number[] = [];
    for (const s of series) valores.push(...valoresNaJanela(s.data, from, to));
    return faixasParaBandas(faixas, valores, unidadeFaixas ?? "%");
  }, [faixas, series, period, minIso, maxIso, unidadeFaixas]);

  const chip =
    nivel && nivel !== "sem_dado" ? (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold ${NIVEL_RISCO[nivel].chip}`}
      >
        <span className="h-2 w-2 rounded-full" style={{ background: NIVEL_RISCO[nivel].hex }} />
        {NIVEL_RISCO[nivel].label}
        {valorAtual ? <span className="font-semibold opacity-80">· {valorAtual}</span> : null}
      </span>
    ) : null;

  return (
    <ChartCard
      id={id}
      title={title}
      subtitle={subtitle}
      footer={footer}
      stampGiro={stampGiro}
      stampDado={stampDado}
      toolbar={
        <>
          {chip}
          {toolbarExtra}
          <AzPeriodSelector
            value={period}
            onChange={setPeriod}
            min={minIso || undefined}
            max={maxIso || undefined}
            periods={["1y", "5y", "max"]}
          />
        </>
      }
    >
      <AzTimeSeriesChart
        series={series}
        benchmarks={benchmarks}
        unit={unit}
        period={period}
        height={height}
        refAreas={refAreas}
        refLines={refLines}
        xRefAreas={xRefAreas}
        variant={variant}
        yAxisLabel={yAxisLabel}
        showLegend={showLegend}
        seriesEndLabels={seriesEndLabels}
        dots={false}
      />
    </ChartCard>
  );
}
