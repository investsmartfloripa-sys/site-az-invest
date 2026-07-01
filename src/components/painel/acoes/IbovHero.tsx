"use client";

import { useMemo, useState } from "react";

import DataStamp from "@/components/painel/DataStamp";
import {
  AzPeriodSelector,
  AzTimeSeriesChart,
  HeroHeader,
  type AzPeriodValue,
  type AzSeriesPoint,
  type AzTimeSeries,
} from "@/components/painel/charts";
import { AZ_BRAND, BENCHMARK_COLORS } from "@/lib/az-chart-theme";
import { fmtNum } from "@/lib/format-br";
import type { AcoesBenchmarkKey, AcoesIbovData } from "@/lib/painel-acoes";

/** Série de uma ação sobreposta ao hero (retorno total, vinda do screener). */
export type IbovOverlaySeries = {
  ticker: string;
  label: string;
  color: string;
  data: ReadonlyArray<AzSeriesPoint>;
};

type Props = {
  data: AcoesIbovData;
  /** Ações selecionadas no screener (retorno total) para comparar vs Ibov em base 100. */
  overlays?: IbovOverlaySeries[];
  /** Remove uma ação da comparação (chip ×). */
  onRemoveOverlay?: (ticker: string) => void;
  /** Tickers cuja série ainda está carregando (mostra chip "carregando"). */
  loadingTickers?: string[];
};

// Benchmarks na cor FIXA oficial (mesma série = mesma cor no site inteiro).
const BENCH_META: Record<AcoesBenchmarkKey, { label: string; color: string }> = {
  CDI: { label: "CDI", color: BENCHMARK_COLORS.CDI },
  SP500: { label: "S&P 500", color: BENCHMARK_COLORS["S&P 500"] },
  USDBRL: { label: "USD/BRL", color: BENCHMARK_COLORS["USD/BRL"] },
};

const IBOV_COLOR = AZ_BRAND.azure; // série principal do hero — azul AZ

export function IbovHero({ data, overlays = [], onRemoveOverlay, loadingTickers = [] }: Props) {
  // Seletor padrão (§8): controlado por estado local, SEM querystring —
  // nesse modo o AzPeriodSelector não toca em useSearchParams, então a rota
  // estática não precisa de <Suspense>.
  const [period, setPeriod] = useState<AzPeriodValue>({ id: "1y" });
  const [activeBenches, setActiveBenches] = useState<AcoesBenchmarkKey[]>([]);

  // Comparando quando há benchmark OU ação selecionada — aí tudo vai p/ base 100.
  const comparing = activeBenches.length > 0 || overlays.length > 0;

  // Série principal (Ibov) + ações sobrepostas viram séries sólidas (base 100).
  const ibovSeries = useMemo<AzTimeSeries[]>(
    () => [
      {
        id: "ibov",
        label: "Ibovespa",
        color: IBOV_COLOR,
        data: data.series_daily.map((p) => [p.date, p.ibov] as const),
      },
      ...overlays.map((o) => ({
        id: `ov-${o.ticker}`,
        label: o.ticker,
        color: o.color,
        data: o.data,
      })),
    ],
    [data, overlays],
  );

  const benchSeries = useMemo<AzTimeSeries[]>(
    () =>
      activeBenches.map((k) => ({
        id: k,
        label: BENCH_META[k].label,
        color: BENCH_META[k].color,
        data: data.series_daily.flatMap((p) => {
          const v = p[k];
          return typeof v === "number" ? [[p.date, v] as const] : [];
        }),
      })),
    [data, activeBenches],
  );

  // Range disponível da série — limita os inputs do "Personalizado".
  const seriesMin = data.series_daily[0]?.date;
  const seriesMax = data.series_daily[data.series_daily.length - 1]?.date;

  const hero = data.hero;

  function toggleBench(k: AcoesBenchmarkKey) {
    setActiveBenches((prev) => (prev.includes(k) ? prev.filter((b) => b !== k) : [...prev, k]));
  }

  return (
    <section
      aria-label="Ibovespa — Panorama"
      className="rounded-2xl border border-[#132960]/15 bg-white p-4 shadow-sm md:p-6"
    >
      {/* HEADER §9: eyebrow → valor grande + chip de variação (range bar omitida no hero de índice — máx/mín já aparecem no gráfico) */}
      {hero ? (
        <HeroHeader
          eyebrow="Ibovespa"
          value={fmtNum(hero.last_value, 0)}
          unit="pts"
          changePct={hero.change_pct_1d}
        />
      ) : (
        <HeroHeader eyebrow="Ibovespa" value="—" unit="pts" />
      )}

      <div className="mt-4 flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            {comparing ? "Comparativo (base 100 · retorno total)" : "Ibovespa (pontos)"}
          </p>
          <AzPeriodSelector value={period} onChange={setPeriod} min={seriesMin} max={seriesMax} />
        </div>

        {/* Chips das ações selecionadas (legenda + remover) */}
        {overlays.length > 0 || loadingTickers.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              Ações:
            </span>
            {overlays.map((o) => (
              <span
                key={o.ticker}
                className="inline-flex items-center gap-1.5 rounded-full border border-[#132960]/15 bg-white py-1 pl-2 pr-1 text-[11px] font-semibold text-[#132960]"
              >
                <span aria-hidden className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: o.color }} />
                {o.ticker}
                {onRemoveOverlay ? (
                  <button
                    type="button"
                    onClick={() => onRemoveOverlay(o.ticker)}
                    aria-label={`Remover ${o.ticker}`}
                    className="ml-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full text-zinc-400 transition hover:bg-zinc-100 hover:text-[#BE3B33]"
                  >
                    ×
                  </button>
                ) : null}
              </span>
            ))}
            {loadingTickers.map((t) => (
              <span
                key={t}
                className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-[#132960]/20 bg-zinc-50 px-2 py-1 text-[11px] text-zinc-400"
              >
                {t} carregando…
              </span>
            ))}
          </div>
        ) : null}

        <AzTimeSeriesChart
          variant="hero"
          series={ibovSeries}
          benchmarks={benchSeries}
          mode={comparing ? "rebase100" : "raw"}
          unit="pts"
          period={period}
          height={260}
          forwardFill={comparing}
          seriesEndLabels={comparing}
          showLegend={false}
        />

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
            Comparar com:
          </span>
          {(Object.keys(BENCH_META) as AcoesBenchmarkKey[]).map((k) => {
            const active = activeBenches.includes(k);
            return (
              <button
                key={k}
                type="button"
                onClick={() => toggleBench(k)}
                aria-pressed={active}
                className={
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold transition " +
                  (active
                    ? "border-transparent text-white shadow-sm"
                    : "border-[#132960]/15 bg-white text-zinc-600 hover:border-[#132960]/40 hover:text-[#132960]")
                }
                style={active ? { backgroundColor: BENCH_META[k].color } : undefined}
              >
                <span
                  aria-hidden
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ backgroundColor: active ? "#ffffff" : BENCH_META[k].color }}
                />
                {BENCH_META[k].label}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <p className="min-w-0 text-[10px] text-zinc-400">
            {comparing
              ? "Base 100 no início da janela. Ações em retorno total (preço + dividendos reinvestidos); Ibovespa é índice de retorno total — comparação justa. "
              : "Ibovespa (^BVSP) via yfinance. "}
            Benchmarks em base 100: CDI (BCB SGS 12), S&amp;P 500 (em USD) e USD/BRL. Não é recomendação.
          </p>
          {/* Cotação do hero é coletada no giro do pipeline: generated_at
              preserva os minutos para auditar atualização. */}
          <DataStamp giro={data.generated_at} dado={data.generated_at} />
        </div>
      </div>
    </section>
  );
}
