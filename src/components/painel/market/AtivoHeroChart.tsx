"use client";

import { useMemo, useState } from "react";

import {
  AzPeriodSelector,
  AzTimeSeriesChart,
  resolvePeriodRange,
  type AzPeriodValue,
  type AzSeriesPoint,
  type AzTimeSeries,
  type AzUnit,
} from "@/components/painel/charts";
import { MarketCard } from "@/components/painel/market/MarketCard";
import { fmtDataBR } from "@/lib/format-br";

/**
 * Hero da página de ativo individual (/painel-economico/mercado/ativo/[ticker]):
 * substitui o antigo sparkline de 1 ano por um gráfico de verdade sobre a
 * fundação AzTimeSeriesChart — eixo de datas adaptativo, tooltip navy,
 * AzPeriodSelector (1M/3M/6M/YTD/1A/5A/Máx + datas custom, default 1A) e
 * toggle de comparação com o benchmark da classe.
 *
 * Comparação ativa ⇒ mode "rebase100" (as duas séries valem 100 no primeiro
 * pregão da janela — compara trajetória, não nível) + forwardFill (calendários
 * distintos: B3 × NYSE × futuros × cripto 24/7). Sem comparação ⇒ mode "raw"
 * na unidade nativa do ativo.
 *
 * Suspense/useSearchParams (Next 16): o AzPeriodSelector chama
 * useSearchParams() internamente. O build só falha por falta de <Suspense>
 * quando a rota é prerenderizada ESTATICAMENTE; a página do ativo é
 * `force-dynamic`, então não seria obrigatório — ainda assim a página envolve
 * este componente em <Suspense> (convenção do repo, ver páginas de
 * índices-globais/câmbio/commodities) e o seletor roda 100% CONTROLADO por
 * estado local, sem espelhar nada na querystring (sem `queryKey`).
 */

export type AtivoHeroBenchmark = {
  /** Ticker Yahoo do benchmark (informativo). */
  ticker: string;
  /** Rótulo exibido no toggle/legenda — casa com BENCHMARK_COLORS quando possível. */
  label: string;
  /** Série diária JÁ FATIADA pela página (nunca o JSON inteiro). */
  series: ReadonlyArray<AzSeriesPoint>;
};

type Props = {
  /** Nome amigável do ativo — vira o label da série principal. */
  name: string;
  /** Série diária completa disponível do ativo (até 5 anos), [ISO, close ajustado]. */
  series: ReadonlyArray<AzSeriesPoint>;
  /** Unidade dos valores brutos no modo sem comparação ("R$", "index", "none"...). */
  unit: AzUnit;
  /** Benchmark único da classe (retrocompat; null = sem benchmark). Use `benchmarks` p/ vários. */
  benchmark?: AtivoHeroBenchmark | null;
  /** Vários benchmarks comparáveis (ex.: FII = IFIX + CDI). Cada um vira um chip toggle independente. */
  benchmarks?: ReadonlyArray<AtivoHeroBenchmark>;
  stampGiro?: string | null;
  stampDado?: string | null;
};

/** Range [min, max] ISO coberto pelas séries exibidas. */
function scanRange(all: ReadonlyArray<ReadonlyArray<AzSeriesPoint>>): { minIso: string; maxIso: string } {
  let minIso = "";
  let maxIso = "";
  for (const data of all) {
    for (const [d] of data) {
      if (!minIso || d < minIso) minIso = d;
      if (!maxIso || d > maxIso) maxIso = d;
    }
  }
  return { minIso, maxIso };
}

export function AtivoHeroChart({ name, series, unit, benchmark, benchmarks, stampGiro, stampDado }: Props) {
  const [period, setPeriod] = useState<AzPeriodValue>({ id: "1y" });

  // Benchmarks comparáveis (retrocompat: `benchmark` único vira lista de 1).
  const benchList = useMemo<AtivoHeroBenchmark[]>(
    () =>
      (benchmarks && benchmarks.length ? [...benchmarks] : benchmark ? [benchmark] : []).filter(
        (b) => b.series.length > 1,
      ),
    [benchmarks, benchmark],
  );
  // Rótulos dos benchmarks ATIVOS no toggle — multi-seleção permite "IFIX + CDI juntos".
  const [selected, setSelected] = useState<string[]>([]);

  const hasSeries = series.length > 1;
  const activeBenches = useMemo(
    () => benchList.filter((b) => selected.includes(b.label)),
    [benchList, selected],
  );
  const comparing = activeBenches.length > 0;

  const mainSeries = useMemo<AzTimeSeries[]>(
    () => [{ id: "ativo", label: name, data: series }],
    [name, series],
  );
  const benchSeries = useMemo<AzTimeSeries[]>(
    () => activeBenches.map((b, i) => ({ id: `bench-${i}`, label: b.label, data: b.series })),
    [activeBenches],
  );

  // Range disponível: ativo sempre; benchmarks só quando visíveis (a página já
  // fatia cada benchmark p/ começar junto com o ativo, então o min não recua).
  const { minIso, maxIso } = useMemo(
    () => scanRange(comparing ? [series, ...activeBenches.map((b) => b.series)] : [series]),
    [series, activeBenches, comparing],
  );

  // Subtítulo dinâmico: a janela concreta resolvida (mesma aritmética UTC do chart).
  const range = minIso && maxIso ? resolvePeriodRange(period, minIso, maxIso) : null;
  const subtitle = range
    ? `${fmtDataBR(range.from)} — ${fmtDataBR(range.to)} · ${
        comparing ? "base 100 no início da janela" : "fechamento diário (close ajustado)"
      }`
    : "Sem série histórica disponível";

  return (
    <MarketCard
      title="Histórico"
      subtitle={subtitle}
      stampGiro={stampGiro ?? null}
      stampDado={stampDado ?? null}
      toolbar={
        benchList.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              Comparar
            </span>
            {benchList.map((b) => {
              const on = selected.includes(b.label);
              return (
                <button
                  key={b.label}
                  type="button"
                  aria-pressed={on}
                  onClick={() =>
                    setSelected((s) => (on ? s.filter((x) => x !== b.label) : [...s, b.label]))
                  }
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold transition ${
                    on
                      ? "bg-[#027DFC] text-white"
                      : "border border-[#132960]/20 bg-white text-[#132960] hover:border-[#027DFC]"
                  }`}
                >
                  {b.label}
                </button>
              );
            })}
          </div>
        ) : undefined
      }
      footer={
        comparing ? (
          <>
            Base 100 no primeiro pregão da janela — compara trajetória, não nível. Calendários
            distintos alinhados pelo último fechamento disponível. Não é recomendação.
          </>
        ) : (
          <>Fechamento diário ajustado (Yahoo Finance).</>
        )
      }
    >
      {hasSeries ? (
        <div className="space-y-3">
          <AzPeriodSelector value={period} onChange={setPeriod} min={minIso} max={maxIso} />
          <AzTimeSeriesChart
            series={mainSeries}
            benchmarks={benchSeries}
            mode={comparing ? "rebase100" : "raw"}
            unit={unit}
            period={period}
            height={300}
            forwardFill={comparing}
            variant={comparing ? "default" : "hero"}
          />
        </div>
      ) : (
        <div className="py-10 text-center text-sm text-zinc-500">
          Sem série histórica disponível para este ativo.
        </div>
      )}
    </MarketCard>
  );
}
