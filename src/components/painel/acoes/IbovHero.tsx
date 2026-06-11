"use client";

import { useMemo, useState } from "react";

import DataStamp from "@/components/painel/DataStamp";
import {
  AzPeriodSelector,
  AzTimeSeriesChart,
  HeroHeader,
  type AzPeriodValue,
  type AzTimeSeries,
} from "@/components/painel/charts";
import { AZ_BRAND, BENCHMARK_COLORS } from "@/lib/az-chart-theme";
import { fmtNum } from "@/lib/format-br";
import type { AcoesBenchmarkKey, AcoesIbovData } from "@/lib/painel-acoes";

type Props = {
  data: AcoesIbovData;
};

// Benchmarks na cor FIXA oficial (mesma série = mesma cor no site inteiro).
const BENCH_META: Record<AcoesBenchmarkKey, { label: string; color: string }> = {
  CDI: { label: "CDI", color: BENCHMARK_COLORS.CDI },
  SP500: { label: "S&P 500", color: BENCHMARK_COLORS["S&P 500"] },
  USDBRL: { label: "USD/BRL", color: BENCHMARK_COLORS["USD/BRL"] },
};

const IBOV_COLOR = AZ_BRAND.azure; // série principal do hero — azul AZ

export function IbovHero({ data }: Props) {
  // Seletor padrão (§8): controlado por estado local, SEM querystring —
  // nesse modo o AzPeriodSelector não toca em useSearchParams, então a rota
  // estática não precisa de <Suspense>.
  const [period, setPeriod] = useState<AzPeriodValue>({ id: "1y" });
  const [activeBenches, setActiveBenches] = useState<AcoesBenchmarkKey[]>([]);

  const showAbsoluteIbov = activeBenches.length === 0;

  // Série principal no formato do AzTimeSeriesChart (o chart recorta a janela
  // — incluindo range custom from/to via resolvePeriodRange — e renormaliza
  // p/ base 100 quando mode="rebase100").
  const ibovSeries = useMemo<AzTimeSeries[]>(
    () => [
      {
        id: "ibov",
        label: "Ibovespa",
        color: IBOV_COLOR,
        data: data.series_daily.map((p) => [p.date, p.ibov] as const),
      },
    ],
    [data],
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
            Ibovespa (pontos){activeBenches.length ? " · comparativo (base 100)" : ""}
          </p>
          <AzPeriodSelector value={period} onChange={setPeriod} min={seriesMin} max={seriesMax} />
        </div>

        <AzTimeSeriesChart
          variant="hero"
          series={ibovSeries}
          benchmarks={benchSeries}
          mode={showAbsoluteIbov ? "raw" : "rebase100"}
          unit="pts"
          period={period}
          height={240}
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
            Ibovespa (<code>^BVSP</code>) via yfinance. Benchmarks em base 100 no início da janela:
            CDI (BCB SGS 12), S&amp;P 500 (em USD) e USD/BRL. Não é recomendação.
          </p>
          {/* Cotação do hero é coletada no giro do pipeline: generated_at
              preserva os minutos para auditar atualização. */}
          <DataStamp giro={data.generated_at} dado={data.generated_at} />
        </div>
      </div>
    </section>
  );
}
