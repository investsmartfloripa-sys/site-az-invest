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
import { fmtBRL, fmtDataBR, fmtNum, fmtPct } from "@/lib/format-br";
import type { FiiDetailEntry } from "@/lib/painel-fii";

/** Valores grandes abreviados: R$ 1,23 Bi / R$ 45,60 M (decimais pt-BR via fmtNum). */
function formatBig(value: number | null | undefined, currency = ""): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  const prefix = currency ? `${currency} ` : "";
  if (abs >= 1e9) return `${prefix}${fmtNum(value / 1e9, 2)} Bi`;
  if (abs >= 1e6) return `${prefix}${fmtNum(value / 1e6, 2)} M`;
  return `${prefix}${fmtNum(value, 0)}`;
}

/** Séries de benchmark p/ o "Comparar com" — a página fatia e encaminha. */
export type FiiDetailHeroBenchmarks = {
  /** IFIX (escala do índice) já recortado ao range da cotação do FII. */
  ifix: ReadonlyArray<AzSeriesPoint>;
  /** CDI acumulado (índice) já recortado. Vazio = chip não aparece. */
  cdi: ReadonlyArray<AzSeriesPoint>;
};

type BenchKey = "IFIX" | "CDI";

// Cores dos chips/linhas de comparação. CDI usa a cor FIXA oficial; IFIX não
// está no mapa BENCHMARK_COLORS — leva o navy ("índice da casa": neste chart
// o IBOV nunca aparece, então não há colisão com a convenção navy=IBOV).
const BENCH_META: Record<BenchKey, { label: string; color: string }> = {
  IFIX: { label: "IFIX", color: AZ_BRAND.navy },
  CDI: { label: "CDI", color: BENCHMARK_COLORS.CDI },
};

type Props = {
  entry: FiiDetailEntry;
  generatedAt?: string | null;
  /** Benchmarks p/ comparação (rebase 100). null/ausente = chips ocultos. */
  benchmarks?: FiiDetailHeroBenchmarks | null;
};

export function FiiDetailHero({ entry, generatedAt, benchmarks }: Props) {
  // Seletor padrão (§8): controlado por estado local, SEM querystring (a rota
  // é force-dynamic, mas o modo controlado dispensa Suspense de toda forma).
  const [period, setPeriod] = useState<AzPeriodValue>({ id: "1y" });
  const [activeBenches, setActiveBenches] = useState<BenchKey[]>([]);

  // Série de cotação no formato do AzTimeSeriesChart (o chart recorta a
  // janela, incluindo range custom from/to via resolvePeriodRange).
  const priceSeries = useMemo<AzTimeSeries[]>(
    () => [
      {
        id: "close",
        label: "Cotação",
        color: AZ_BRAND.azure,
        data: entry.price_series_daily.map((p) => [p.date, p.close] as const),
      },
    ],
    [entry],
  );

  // Só oferece o chip quando a série tem pontos suficientes pra plotar.
  const availableBenches = useMemo<BenchKey[]>(() => {
    const out: BenchKey[] = [];
    if ((benchmarks?.ifix.length ?? 0) > 1) out.push("IFIX");
    if ((benchmarks?.cdi.length ?? 0) > 1) out.push("CDI");
    return out;
  }, [benchmarks]);

  const benchSeries = useMemo<AzTimeSeries[]>(
    () =>
      activeBenches.flatMap((k) => {
        const data = k === "IFIX" ? benchmarks?.ifix : benchmarks?.cdi;
        if (!data || data.length < 2) return [];
        return [{ id: k, label: BENCH_META[k].label, color: BENCH_META[k].color, data }];
      }),
    [activeBenches, benchmarks],
  );

  const comparing = benchSeries.length > 0;

  // Range disponível da série — limita os inputs do "Personalizado".
  const seriesMin = entry.price_series_daily[0]?.date;
  const seriesMax = entry.price_series_daily[entry.price_series_daily.length - 1]?.date;

  const hero = entry.hero;

  // Detecção de evento societário (desdobramento, amortização extraordinária):
  // se a cotação caiu mais de 50% no melhor caso dos últimos 12m, é quase
  // certo que houve evento. Banner avisa o leitor que o histórico não pode
  // ser comparado de cabeça.
  const corporateEvent =
    hero.max_12m != null && hero.min_12m != null && hero.price != null && hero.max_12m > 0
      ? (hero.max_12m - hero.min_12m) / hero.max_12m > 0.5
      : false;

  function toggleBench(k: BenchKey) {
    setActiveBenches((prev) => (prev.includes(k) ? prev.filter((b) => b !== k) : [...prev, k]));
  }

  return (
    <section
      aria-label={`${entry.ticker} — Hero`}
      className="space-y-4 rounded-2xl border border-[#132960]/15 bg-white p-4 shadow-sm md:p-6"
    >
      {(entry.dy_atypical || corporateEvent) ? (
        <div
          role="alert"
          className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900"
        >
          <p className="font-semibold uppercase tracking-wide text-amber-800">
            Atenção — leia antes de interpretar os números
          </p>
          <ul className="mt-1 list-disc pl-5 leading-relaxed">
            {entry.dy_atypical ? (
              <li>
                <strong>DY 12m acima de 18%</strong>: pode incluir{" "}
                <strong>devolução de capital</strong> (amortização extraordinária) tratada como
                rendimento pelo provedor de dados. Confira a tabela de Rendimentos abaixo e o
                relatório gerencial da gestora antes de tratar como renda recorrente.
              </li>
            ) : null}
            {corporateEvent ? (
              <li>
                <strong>Variação de cotação superior a 50% nos últimos 12 meses</strong>: indica
                provável <strong>desdobramento, agrupamento ou evento societário</strong> — o
                histórico do gráfico pode não ser comparável diretamente. Verifique fatos
                relevantes do fundo.
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}
      {/* Linha de KPIs grandes */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5 md:gap-6">
        {/* Ticker badge */}
        <div className="flex items-center">
          <span className="rounded-md border-2 border-[#132960] px-3 py-1.5 text-base font-bold tracking-wider text-[#132960]">
            {entry.ticker}
          </span>
        </div>
        <KpiBlock
          label="Dividend Yield"
          value={fmtPct(hero.dy_12m_pct, 2)}
          tooltip={entry.dy_atypical ? "DY > 18% pode incluir amortização." : undefined}
        />
        <KpiBlock
          label="Último Rendimento"
          value={hero.last_dividend_brl != null ? fmtBRL(hero.last_dividend_brl, 4) : "—"}
          sub={hero.last_dividend_date ? fmtDataBR(hero.last_dividend_date) : undefined}
        />
        <KpiBlock label="Patrimônio Líquido" value={formatBig(hero.pl, "R$")} sub={hero.pl_ref_date ? `ref ${fmtDataBR(hero.pl_ref_date)}` : undefined} />
        <KpiBlock
          label="P/VP"
          value={hero.pvp != null ? fmtNum(hero.pvp, 3) : "—"}
          sub={
            hero.pvp == null
              ? "VP/cota indisponível"
              : entry.pvp_warning
              ? "P/VP < 0,7 — possível distress"
              : undefined
          }
          tooltip={
            hero.pvp == null
              ? "Valor Patrimonial por cota reportado pela CVM está em escala inconsistente para este FII (não publicado em base por cota nominal). Ratio omitido para evitar exibir P/VP incorreto."
              : entry.pvp_warning
              ? "P/VP < 0,7 pode indicar distress (vacância alta, problema de crédito da carteira CRI). Verifique relatório gerencial."
              : undefined
          }
        />
      </div>

      {/* HEADER §9 da cotação: eyebrow → valor + chip de variação → range 12m */}
      <HeroHeader
        eyebrow={`Cotação · ${entry.ticker}`}
        value={hero.price != null ? fmtNum(hero.price, 2) : "—"}
        unit="R$"
        unitBefore
        changePct={hero.change_pct_1d}
        range={
          hero.price != null && hero.min_12m != null && hero.max_12m != null
            ? {
                min: hero.min_12m,
                max: hero.max_12m,
                current: hero.price,
                format: (v) => fmtNum(v, 2),
              }
            : null
        }
      />

      {/* Gráfico full-width + seletor padrão + comparação */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Cotação histórica{comparing ? " · comparativo (base 100)" : ""}
          </p>
          <AzPeriodSelector value={period} onChange={setPeriod} min={seriesMin} max={seriesMax} />
        </div>
        <AzTimeSeriesChart
          variant="hero"
          series={priceSeries}
          benchmarks={benchSeries}
          mode={comparing ? "rebase100" : "raw"}
          unit="R$"
          period={period}
          height={220}
          showLegend={false}
        />

        {/* Comparar com — mesmo padrão visual dos chips do IbovHero/IfixHero */}
        {availableBenches.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              Comparar com:
            </span>
            {availableBenches.map((k) => {
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
        ) : null}
        {comparing ? (
          <p className="text-[10px] text-zinc-400">
            Base 100 no primeiro pregão da janela — compara trajetória, não nível. IFIX via XFIX11
            (proxy) e CDI (BCB SGS 12) acumulado. Não é recomendação.
          </p>
        ) : null}
      </div>
      <p className="mt-2 text-right">
        <DataStamp
          giro={generatedAt ?? null}
          dado={
            entry.price_series_daily[entry.price_series_daily.length - 1]?.date ??
            hero.price_date
          }
        />
      </p>
    </section>
  );
}

function KpiBlock({ label, value, sub, tooltip }: { label: string; value: string; sub?: string; tooltip?: string }) {
  return (
    <div className="flex flex-col" title={tooltip}>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">{label}</p>
      <p className={`text-lg font-semibold tabular-nums text-[#132960] md:text-xl ${tooltip ? "cursor-help" : ""}`}>
        {value}
        {tooltip ? <span className="text-amber-700">*</span> : null}
      </p>
      {sub ? <p className="text-[10px] text-zinc-500">{sub}</p> : null}
    </div>
  );
}
