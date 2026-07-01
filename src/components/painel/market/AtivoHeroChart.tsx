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
 * gráfico sobre a fundação AzTimeSeriesChart — eixo de datas adaptativo, tooltip
 * navy, AzPeriodSelector (1M/3M/6M/YTD/1A/5A/Máx, default 1A) e toggle de
 * comparação com o benchmark da classe.
 *
 * Ações BR: além da linha de PREÇO, aceita `trRaw` (adj close = retorno total).
 * No modo sem comparação, desenhamos a curva DOURADA "preço + dividendos",
 * ancorada no 1º preço da JANELA visível (as duas linhas partem juntas em
 * qualquer período e a distância entre elas é exatamente o efeito dos
 * dividendos reinvestidos). Na comparação com o benchmark (base 100), a linha
 * do ativo vira o retorno total — disputa justa com o Ibovespa (índice de
 * retorno total).
 */

/** Dourado da linha de retorno total (preço + dividendos) — legível em fundo branco. */
const DIVIDEND_GOLD = "#E0A100";

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
  /** Série diária de PREÇO do ativo (até 5 anos), [ISO, close]. */
  series: ReadonlyArray<AzSeriesPoint>;
  /** Unidade dos valores brutos no modo sem comparação ("R$", "index", "none"...). */
  unit: AzUnit;
  /** Benchmark único da classe (retrocompat; null = sem benchmark). Use `benchmarks` p/ vários. */
  benchmark?: AtivoHeroBenchmark | null;
  /** Vários benchmarks comparáveis (ex.: FII = IFIX + CDI). Cada um vira um chip toggle independente. */
  benchmarks?: ReadonlyArray<AtivoHeroBenchmark>;
  /**
   * Série de RETORNO TOTAL bruta (adj close, [ISO, adj]) alinhada em data com
   * `series`. Quando presente: linha dourada "preço + dividendos" (modo raw,
   * ancorada na janela) e linha do ativo na comparação (base 100).
   */
  trRaw?: ReadonlyArray<AzSeriesPoint>;
  /** Rótulo da linha de retorno total. Default "Preço + dividendos". */
  trLabel?: string;
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

export function AtivoHeroChart({
  name,
  series,
  unit,
  benchmark,
  benchmarks,
  trRaw,
  trLabel = "Preço + dividendos",
  stampGiro,
  stampDado,
}: Props) {
  const [period, setPeriod] = useState<AzPeriodValue>({ id: "1y" });

  // Benchmarks comparáveis (retrocompat: `benchmark` único vira lista de 1).
  const benchList = useMemo<AtivoHeroBenchmark[]>(
    () =>
      (benchmarks && benchmarks.length ? [...benchmarks] : benchmark ? [benchmark] : []).filter(
        (b) => b.series.length > 1,
      ),
    [benchmarks, benchmark],
  );
  const [selected, setSelected] = useState<string[]>([]);

  const hasSeries = series.length > 1;
  const hasTr = Boolean(trRaw && trRaw.length > 1);
  const activeBenches = useMemo(
    () => benchList.filter((b) => selected.includes(b.label)),
    [benchList, selected],
  );
  const comparing = activeBenches.length > 0;

  // Range disponível (datas) — independe da ancoragem.
  const { minIso, maxIso } = useMemo(
    () =>
      scanRange([
        series,
        ...(hasTr && trRaw ? [trRaw] : []),
        ...(comparing ? activeBenches.map((b) => b.series) : []),
      ]),
    [series, trRaw, hasTr, activeBenches, comparing],
  );

  const range = minIso && maxIso ? resolvePeriodRange(period, minIso, maxIso) : null;

  // Curva dourada ancorada no 1º preço DA JANELA: tr[t] = close0 · adj[t]/adj0.
  const anchoredTr = useMemo<AzSeriesPoint[] | null>(() => {
    if (!hasTr || !trRaw || !range) return null;
    const closeByDate = new Map(series.map(([d, v]) => [d, v] as const));
    let close0: number | null = null;
    let adj0: number | null = null;
    for (const [d, adj] of trRaw) {
      if (d < range.from) continue;
      const c = closeByDate.get(d);
      if (c != null && Number.isFinite(c) && adj > 0) {
        close0 = c;
        adj0 = adj;
        break;
      }
    }
    if (close0 == null || adj0 == null || !(adj0 > 0)) return null;
    return trRaw.map(([d, adj]) => [d, close0! * (adj / adj0!)] as const);
  }, [hasTr, trRaw, series, range]);

  // Séries principais: na comparação o ativo entra em RETORNO TOTAL (justo vs
  // benchmark); sem comparação, entra o preço e a curva dourada é companheira.
  const chartSeries = useMemo<AzTimeSeries[]>(() => {
    if (comparing) {
      const main =
        hasTr && trRaw
          ? { id: "ativo", label: `${name} (c/ dividendos)`, data: trRaw }
          : { id: "ativo", label: name, data: series };
      return [main];
    }
    const priceLine: AzTimeSeries = { id: "ativo", label: name, data: series };
    if (anchoredTr) {
      return [priceLine, { id: "tr", label: trLabel, color: DIVIDEND_GOLD, data: anchoredTr }];
    }
    return [priceLine];
  }, [comparing, hasTr, trRaw, anchoredTr, name, series, trLabel]);

  const benchSeries = useMemo<AzTimeSeries[]>(
    () => activeBenches.map((b, i) => ({ id: `bench-${i}`, label: b.label, data: b.series })),
    [activeBenches],
  );

  const modeText = comparing
    ? "base 100 no início da janela"
    : hasTr
      ? "preço × preço + dividendos (retorno total)"
      : "fechamento diário (close ajustado)";
  const subtitle = range ? `${fmtDataBR(range.from)} — ${fmtDataBR(range.to)} · ${modeText}` : "Sem série histórica disponível";

  const showTrLegend = !comparing && Boolean(anchoredTr);

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
            Base 100 no primeiro pregão da janela — compara trajetória, não nível. Ativo em retorno
            total (preço + dividendos) quando disponível. Calendários alinhados pelo último
            fechamento. Não é recomendação.
          </>
        ) : showTrLegend ? (
          <>
            Linha <span style={{ color: DIVIDEND_GOLD }} className="font-semibold">dourada</span> ={" "}
            retorno total (preço + dividendos reinvestidos), ancorada no início da janela.
            Fechamento diário (Yahoo Finance).
          </>
        ) : (
          <>Fechamento diário ajustado (Yahoo Finance).</>
        )
      }
    >
      {hasSeries ? (
        <div className="space-y-3">
          {showTrLegend ? (
            <div className="flex flex-wrap items-center gap-3 text-[11px] font-semibold">
              <span className="inline-flex items-center gap-1.5 text-[#132960]">
                <span aria-hidden className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: "#027DFC" }} />
                Preço
              </span>
              <span className="inline-flex items-center gap-1.5" style={{ color: DIVIDEND_GOLD }}>
                <span aria-hidden className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: DIVIDEND_GOLD }} />
                {trLabel}
              </span>
            </div>
          ) : null}
          <AzPeriodSelector value={period} onChange={setPeriod} min={minIso} max={maxIso} />
          <AzTimeSeriesChart
            series={chartSeries}
            benchmarks={benchSeries}
            mode={comparing ? "rebase100" : "raw"}
            unit={unit}
            period={period}
            height={300}
            forwardFill={comparing}
            seriesEndLabels={showTrLegend}
            showLegend={false}
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
