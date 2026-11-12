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
import { AZ_BRAND, BENCHMARK_COLORS, seriesColor, variationText } from "@/lib/az-chart-theme";
import { fmtNum, fmtSignedPct } from "@/lib/format-br";
import type { FiiBenchmarkKey, FiiIfixData } from "@/lib/painel-fii";

/** Série de um FII sobreposta ao hero (retorno total, vinda do screener). */
export type IfixOverlaySeries = {
  ticker: string;
  label: string;
  color: string;
  data: ReadonlyArray<AzSeriesPoint>;
};

type Props = {
  data: FiiIfixData;
  /** FIIs selecionados no screener (retorno total) p/ comparar vs IFIX em % acumulado. */
  overlays?: IfixOverlaySeries[];
  /** Remove um FII da comparação (chip ×). */
  onRemoveOverlay?: (ticker: string) => void;
  /** Tickers cuja série ainda está carregando (chip "carregando"). */
  loadingTickers?: string[];
  /** Índice de tijolo (AZ) ajustado pelo rendimento, diário — entra como comparação ligada por padrão. */
  tijolo?: ReadonlyArray<AzSeriesPoint> | null;
  /** Janela CONTROLADA pelo pai (compartilhada com a tabela do comparador). */
  period?: AzPeriodValue;
  onPeriodChange?: (v: AzPeriodValue) => void;
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
const TIJOLO_COLOR = AZ_BRAND.navy; // índice próprio de tijolo — navy, como na aba Analítico

/** Variação % entre o 1º e o último ponto da série dentro de [from, to]; null sem 2 pontos. */
function retornoNaJanela(data: ReadonlyArray<AzSeriesPoint>, from: string, to: string): number | null {
  let base: number | null = null;
  let end: number | null = null;
  for (const [d, v] of data) {
    if (d < from || d > to || !Number.isFinite(v)) continue;
    if (base == null) base = v;
    end = v;
  }
  return base != null && end != null && base > 0 ? 100 * (end / base - 1) : null;
}

export function IfixHero({
  data,
  overlays = [],
  onRemoveOverlay,
  loadingTickers = [],
  tijolo = null,
  period: periodProp,
  onPeriodChange,
}: Props) {
  // Seletor padrão (§8): estado local SEM querystring — ou CONTROLADO pelo pai
  // quando `period` vem via prop (página compartilha a janela com a tabela).
  const [periodInternal, setPeriodInternal] = useState<AzPeriodValue>({ id: "1y" });
  const period = periodProp ?? periodInternal;
  const setPeriod = onPeriodChange ?? setPeriodInternal;
  const [activeBenches, setActiveBenches] = useState<FiiBenchmarkKey[]>([]);
  // O tijolo começa em 2017 e o IFIX diário em 2021: corta no início do IFIX para as duas
  // linhas partirem do mesmo dia em qualquer janela (inclusive "Máx").
  const ifixIni = data.series_daily[0]?.date;
  const tijoloJanela = useMemo(
    () => (tijolo && ifixIni ? tijolo.filter(([d]) => d >= ifixIni) : []),
    [tijolo, ifixIni],
  );
  const temTijolo = tijoloJanela.length > 1;
  const [tijoloOn, setTijoloOn] = useState(true);
  const mostraTijolo = temTijolo && tijoloOn;

  // Comparando quando há benchmark, índice de tijolo OU FII selecionado — tudo vira
  // variação % acumulada desde o início da janela (base 0, leitura direta).
  const comparing = activeBenches.length > 0 || overlays.length > 0 || mostraTijolo;

  // Retorno na janela de cada série — FIIs no chip; IFIX, tijolo e benchmarks na legenda
  // abaixo do gráfico (no lugar das pílulas no fim das linhas, que cobriam as linhas).
  const janela = useMemo(() => {
    const first = data.series_daily[0]?.date;
    const last = data.series_daily[data.series_daily.length - 1]?.date;
    return first && last ? resolvePeriodRange(period, first, last) : null;
  }, [data, period]);

  const overlayPcts = useMemo<Record<string, number | null>>(() => {
    if (!janela) return {};
    const out: Record<string, number | null> = {};
    for (const o of overlays) out[o.ticker] = retornoNaJanela(o.data, janela.from, janela.to);
    return out;
  }, [overlays, janela]);

  const ifixSeries = useMemo<AzTimeSeries[]>(
    () => [
      {
        id: "ifix",
        label: "IFIX",
        color: IFIX_COLOR,
        data: data.series_daily.map((p) => [p.date, p.ifix] as const),
      },
      ...(mostraTijolo
        ? [{ id: "tijolo", label: "Tijolo (AZ)", color: TIJOLO_COLOR, data: tijoloJanela }]
        : []),
      ...overlays.map((o) => ({
        id: `ov-${o.ticker}`,
        label: o.ticker,
        color: o.color,
        data: o.data,
      })),
    ],
    [data, overlays, mostraTijolo, tijoloJanela],
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

  // Legenda do comparativo: série, cor e retorno na janela.
  const legenda = useMemo(() => {
    if (!comparing || !janela) return [];
    const itens: { id: string; label: string; color: string; pct: number | null; tracejada?: boolean }[] = [
      {
        id: "ifix",
        label: "IFIX",
        color: IFIX_COLOR,
        pct: retornoNaJanela(ifixSeries[0]?.data ?? [], janela.from, janela.to),
      },
    ];
    if (mostraTijolo) {
      itens.push({ id: "tijolo", label: "Tijolo (AZ)", color: TIJOLO_COLOR, pct: retornoNaJanela(tijoloJanela, janela.from, janela.to) });
    }
    for (const b of benchSeries) {
      itens.push({ id: b.id, label: b.label, color: b.color ?? AZ_BRAND.navy, pct: retornoNaJanela(b.data, janela.from, janela.to), tracejada: true });
    }
    return itens;
  }, [comparing, janela, ifixSeries, mostraTijolo, tijoloJanela, benchSeries]);

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
      {/* HEADER §9: eyebrow → valor grande + chip de variação (range bar omitida no hero de índice — máx/mín já aparecem no gráfico) */}
      {hero ? (
        <HeroHeader
          eyebrow="IFIX"
          value={fmtNum(hero.last_value, 0)}
          unit="pts"
          changePct={hero.change_pct_1d}
        />
      ) : (
        <HeroHeader eyebrow="IFIX" value="—" unit="pts" />
      )}

      <div className="mt-4 flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            {comparing ? "Comparativo (variação % · retorno total)" : "IFIX (cotação)"}
            <MethodInfo className="ml-1.5 align-middle">
              {comparing
                ? "Variação % acumulada desde o início da janela (todas as séries partem de 0%). FIIs em retorno total (preço + proventos reinvestidos); IFIX é índice de retorno total — comparação justa. "
                : "IFIX oficial da B3 (fechamento de cada pregão; durante o pregão, o valor do momento). "}
              {temTijolo
                ? "Tijolo (AZ): índice próprio dos FIIs de tijolo mais negociados, com os rendimentos reinvestidos (regras e modelo na aba Analítico); o rendimento de cada mês entra no 1º pregão do mês, quando a maioria dos FIIs fica ex-rendimento. "
                : ""}
              Fontes: IFIX da B3; IMA-B e IMA-B5+ da ANBIMA (números-índice oficiais); CDI do Banco Central
              (SGS 12); IBOV (Yahoo). Não é recomendação.
            </MethodInfo>
          </p>
          {/* Fila rolável no celular: as pílulas quebravam e o "Personalizado" ficava sozinho na 2ª linha. */}
          <div className="min-w-0 max-w-full overflow-x-auto">
            <AzPeriodSelector className="w-max" value={period} onChange={setPeriod} min={seriesMin} max={seriesMax} />
          </div>
        </div>

        {/* Chips dos FIIs selecionados (legenda + retorno na janela + remover) */}
        {overlays.length > 0 || loadingTickers.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              FIIs:
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
                    className="ml-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full text-zinc-500 transition hover:bg-zinc-100 hover:text-[#BE3B33]"
                  >
                    ×
                  </button>
                ) : null}
              </span>
            ))}
            {loadingTickers.map((t) => (
              <span
                key={t}
                className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-[#132960]/20 bg-zinc-50 px-2 py-1 text-[11px] text-zinc-500"
              >
                {t} carregando…
              </span>
            ))}
          </div>
        ) : null}

        {/* No comparativo, gráfico de linhas simples: os rótulos de máximo/mínimo e as pílulas no fim
            das linhas caíam em cima das outras séries (e a pílula vazava a borda). O retorno de cada
            série na janela vai na legenda logo abaixo. */}
        <AzTimeSeriesChart
          variant={comparing ? "default" : "hero"}
          series={ifixSeries}
          benchmarks={benchSeries}
          mode={comparing ? "pct_acum" : "raw"}
          unit="pts"
          period={period}
          height={260}
          forwardFill={comparing}
          showLegend={false}
        />

        {legenda.length > 0 ? (
          <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-semibold text-[#132960]" aria-label="Retorno na janela">
            {legenda.map((it) => (
              <li key={it.id} className="inline-flex items-center gap-1.5">
                <span
                  aria-hidden
                  className="inline-block h-0 w-4 border-t-2"
                  style={{ borderColor: it.color, borderTopStyle: it.tracejada ? "dashed" : "solid" }}
                />
                {it.label}
                <span className="tabular-nums" style={it.pct != null ? { color: variationText(it.pct) } : undefined}>
                  {fmtSignedPct(it.pct, 1)}
                </span>
              </li>
            ))}
          </ul>
        ) : null}

        {/* Comparar com */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
            Comparar com:
          </span>
          {temTijolo ? (
            <button
              type="button"
              onClick={() => setTijoloOn((v) => !v)}
              aria-pressed={tijoloOn}
              className={
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold transition " +
                (tijoloOn
                  ? "border-transparent text-white shadow-sm"
                  : "border-[#132960]/15 bg-white text-zinc-600 hover:border-[#132960]/40 hover:text-[#132960]")
              }
              style={tijoloOn ? { backgroundColor: TIJOLO_COLOR } : undefined}
            >
              <span
                aria-hidden
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: tijoloOn ? "#ffffff" : TIJOLO_COLOR }}
              />
              Tijolo (AZ)
            </button>
          ) : null}
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
