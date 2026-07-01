"use client";

import { useMemo, useState } from "react";

import DataStamp from "@/components/painel/DataStamp";
import {
  AzPeriodSelector,
  AzTimeSeriesChart,
  HeroHeader,
  resolvePeriodRange,
  type AzPeriodValue,
  type AzSeriesPoint,
  type AzTimeSeries,
} from "@/components/painel/charts";
import { MethodInfo } from "@/components/painel/core/MethodInfo";
import { AZ_BRAND, BENCHMARK_COLORS, variationText } from "@/lib/az-chart-theme";
import { fmtNum, fmtSignedPct } from "@/lib/format-br";
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
  /** Ações selecionadas no screener (retorno total) para comparar vs Ibov em % acumulado. */
  overlays?: IbovOverlaySeries[];
  /** Remove uma ação da comparação (chip ×). */
  onRemoveOverlay?: (ticker: string) => void;
  /** Tickers cuja série ainda está carregando (mostra chip "carregando"). */
  loadingTickers?: string[];
  /** Janela CONTROLADA pelo pai (compartilhada com a tabela do comparador). */
  period?: AzPeriodValue;
  onPeriodChange?: (v: AzPeriodValue) => void;
};

// Benchmarks na cor FIXA oficial (mesma série = mesma cor no site inteiro).
const BENCH_META: Record<AcoesBenchmarkKey, { label: string; color: string }> = {
  CDI: { label: "CDI", color: BENCHMARK_COLORS.CDI },
  SP500: { label: "S&P 500", color: BENCHMARK_COLORS["S&P 500"] },
  USDBRL: { label: "USD/BRL", color: BENCHMARK_COLORS["USD/BRL"] },
};

const IBOV_COLOR = AZ_BRAND.azure; // série principal do hero — azul AZ

export function IbovHero({
  data,
  overlays = [],
  onRemoveOverlay,
  loadingTickers = [],
  period: periodProp,
  onPeriodChange,
}: Props) {
  // Seletor padrão (§8): estado local SEM querystring (rota estática não
  // precisa de <Suspense>) — ou CONTROLADO pelo pai quando `period` vem via
  // prop (a página compartilha a janela com a tabela do comparador).
  const [periodInternal, setPeriodInternal] = useState<AzPeriodValue>({ id: "1y" });
  const period = periodProp ?? periodInternal;
  const setPeriod = onPeriodChange ?? setPeriodInternal;
  const [activeBenches, setActiveBenches] = useState<AcoesBenchmarkKey[]>([]);

  // Comparando quando há benchmark OU ação selecionada — aí tudo vira
  // variação % acumulada desde o início da janela (base 0, leitura direta).
  const comparing = activeBenches.length > 0 || overlays.length > 0;

  // Retorno na janela por ação selecionada — vai no chip, na cor da série
  // (o gráfico marca só o dot no fim da linha; o número vive aqui).
  const overlayPcts = useMemo<Record<string, number | null>>(() => {
    const first = data.series_daily[0]?.date;
    const last = data.series_daily[data.series_daily.length - 1]?.date;
    if (!first || !last) return {};
    const { from, to } = resolvePeriodRange(period, first, last);
    const out: Record<string, number | null> = {};
    for (const o of overlays) {
      let base: number | null = null;
      let end: number | null = null;
      for (const [d, v] of o.data) {
        if (d < from || d > to || !Number.isFinite(v)) continue;
        if (base == null) base = v;
        end = v;
      }
      out[o.ticker] = base != null && end != null && base > 0 ? 100 * (end / base - 1) : null;
    }
    return out;
  }, [data, overlays, period]);

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
            {comparing ? "Comparativo (variação % · retorno total)" : "Ibovespa (pontos)"}
            <MethodInfo className="ml-1.5 align-middle">
              {comparing
                ? "Variação % acumulada desde o início da janela (todas as séries partem de 0%). Ações em retorno total (preço + dividendos reinvestidos); Ibovespa é índice de retorno total — comparação justa. "
                : "Ibovespa (^BVSP) via yfinance. "}
              Benchmarks na mesma base: CDI (BCB SGS 12), S&amp;P 500 (em USD) e USD/BRL. Não é
              recomendação.
            </MethodInfo>
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
                {overlayPcts[o.ticker] != null ? (
                  <span
                    className="tabular-nums"
                    style={{ color: variationText(overlayPcts[o.ticker] as number) }}
                  >
                    {fmtSignedPct(overlayPcts[o.ticker] as number, 1)}
                  </span>
                ) : null}
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
          mode={comparing ? "pct_acum" : "raw"}
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
        <div className="flex flex-wrap items-baseline justify-end gap-x-3 gap-y-1">
          {/* Cotação do hero é coletada no giro do pipeline: generated_at
              preserva os minutos para auditar atualização. */}
          <DataStamp giro={data.generated_at} dado={data.generated_at} />
        </div>
      </div>
    </section>
  );
}
