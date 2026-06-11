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
import { AZ_BRAND, BENCHMARK_COLORS, seriesColor } from "@/lib/az-chart-theme";
import { fmtNum } from "@/lib/format-br";
import type { FiiBenchmarkKey, FiiIfixData } from "@/lib/painel-fii";

type Props = {
  data: FiiIfixData;
};

// Benchmarks na cor FIXA oficial (mesma série = mesma cor no site inteiro).
// IMA-B5+ não tem cor fixa no mapa: usa o ocre da paleta categórica (família
// IPCA longa, prima da NTN-B) — distinto do ciano do IMA-B no mesmo chart.
const BENCH_META: Record<FiiBenchmarkKey, { label: string; color: string }> = {
  IMAB: { label: "IMA-B", color: BENCHMARK_COLORS["IMA-B"] },
  IMAB5P: { label: "IMA-B5+", color: seriesColor(5) },
  CDI: { label: "CDI", color: BENCHMARK_COLORS.CDI },
  IBOV: { label: "IBOV", color: BENCHMARK_COLORS.IBOV },
};

const IFIX_COLOR = AZ_BRAND.azure; // série principal do hero — azul AZ

export function IfixHero({ data }: Props) {
  // Seletor padrão (§8): controlado por estado local, SEM querystring —
  // nesse modo o AzPeriodSelector não toca em useSearchParams, então a rota
  // estática não precisa de <Suspense>.
  const [period, setPeriod] = useState<AzPeriodValue>({ id: "1y" });
  const [activeBenches, setActiveBenches] = useState<FiiBenchmarkKey[]>([]);

  const showAsAbsoluteIfix = activeBenches.length === 0;

  // Série principal no formato do AzTimeSeriesChart (o chart recorta a janela
  // — incluindo range custom from/to via resolvePeriodRange — e renormaliza
  // p/ base 100 quando mode="rebase100").
  const ifixSeries = useMemo<AzTimeSeries[]>(
    () => [
      {
        id: "ifix",
        label: "IFIX",
        color: IFIX_COLOR,
        data: data.series_daily.map((p) => [p.date, p.ifix] as const),
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

  function toggleBench(k: FiiBenchmarkKey) {
    setActiveBenches((prev) => (prev.includes(k) ? prev.filter((b) => b !== k) : [...prev, k]));
  }

  return (
    <section
      aria-label="IFIX — Panorama"
      className="rounded-2xl border border-[#132960]/15 bg-white p-4 shadow-sm md:p-6"
    >
      {/* HEADER §9: eyebrow → valor grande + chip de variação → range bar 12m */}
      {hero ? (
        <HeroHeader
          eyebrow="IFIX"
          value={fmtNum(hero.last_value, 0)}
          unit="pts"
          changePct={hero.change_pct_1d}
          range={{
            min: hero.min_12m,
            max: hero.max_12m,
            current: hero.last_value,
            format: (v) => fmtNum(v, 0),
          }}
        />
      ) : (
        <HeroHeader eyebrow="IFIX" value="—" unit="pts" />
      )}

      <div className="mt-4 flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            IFIX (cotação){activeBenches.length ? " · comparativo (base 100)" : ""}
          </p>
          <AzPeriodSelector value={period} onChange={setPeriod} min={seriesMin} max={seriesMax} />
        </div>

        <AzTimeSeriesChart
          variant="hero"
          series={ifixSeries}
          benchmarks={benchSeries}
          mode={showAsAbsoluteIfix ? "raw" : "rebase100"}
          unit="pts"
          period={period}
          height={240}
          showLegend={false}
        />

        {/* Comparar com */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
            Comparar com:
          </span>
          {(Object.keys(BENCH_META) as FiiBenchmarkKey[]).map((k) => {
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
      </div>
      <p className="mt-2 text-right">
        {/* Fonte intradiária (giro a cada 15min em pregão): a cotação plotada é a
            coletada no giro — usar generated_at preserva os minutos no carimbo. */}
        <DataStamp giro={data.generated_at} dado={data.generated_at} />
      </p>
    </section>
  );
}
