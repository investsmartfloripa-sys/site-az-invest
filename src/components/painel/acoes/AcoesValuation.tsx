"use client";

import { useMemo, useState } from "react";
import {
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import DataStamp from "@/components/painel/DataStamp";
import {
  AzPeriodSelector,
  resolvePeriodRange,
  type AzPeriodValue,
} from "@/components/painel/charts";
import {
  AzTooltip,
  azGridProps,
  azXAxisProps,
  azYAxisProps,
} from "@/components/painel/core";
import { AcoesPremioNtnb } from "@/components/painel/acoes/AcoesPremioNtnb";
import { MethodInfo } from "@/components/painel/core/MethodInfo";
import {
  AZ_BRAND,
  AZ_CHART,
  AZ_TOOLTIP_PROPS,
} from "@/lib/az-chart-theme";
import {
  diffDaysUTC,
  fmtDataBR,
  fmtMesCurto,
  fmtNum,
  fmtSignedNum,
  formatAxisDate,
} from "@/lib/format-br";
import type { AcoesValuationData, AcoesValuationPoint } from "@/lib/painel-acoes";

// Paleta 100% do tema AZ (az-chart-theme) — nenhum hex local.
const PL_COLOR = AZ_BRAND.navy; // série principal do card de P/L
const MEAN_COLOR = AZ_CHART.ticks; // linha da média (referência discreta)
const BAND_COLOR = AZ_BRAND.azure; // preenchimento das bandas ±1σ/±2σ

type Props = {
  data: AcoesValuationData;
};

// Corte pela janela do AzPeriodSelector — resolvePeriodRange trata os
// presets E o range custom (from/to) em aritmética 100% UTC (§8 do padrão).
function clipByPeriod(arr: AcoesValuationPoint[], period: AzPeriodValue): AcoesValuationPoint[] {
  if (!arr.length) return [];
  const { from, to } = resolvePeriodRange(period, arr[0].date, arr[arr.length - 1].date);
  return arr.filter((p) => p.date >= from && p.date <= to);
}

/** Dias corridos entre o 1º e o último ponto plotado (p/ ticks adaptativos do format-br). */
function spanDaysOf(arr: AcoesValuationPoint[]): number {
  if (arr.length < 2) return 1;
  return Math.max(1, diffDaysUTC(arr[0].date, arr[arr.length - 1].date));
}

/** Leitura qualitativa do z-score do P/L atual (cores AA do tema AZ). */
function zLabel(z: number | null): { text: string; color: string } {
  if (z == null) return { text: "—", color: AZ_CHART.ticks };
  if (z >= 1) return { text: `caro (${fmtSignedNum(z, 2)}σ)`, color: AZ_CHART.negText };
  if (z <= -1) return { text: `barato (${fmtSignedNum(z, 2)}σ)`, color: AZ_CHART.posText };
  return { text: `na média (${fmtSignedNum(z, 2)}σ)`, color: AZ_CHART.neutral };
}

export function AcoesValuation({ data }: Props) {
  // Seletores §8 controlados (estado local, sem querystring — página estática
  // dispensa Suspense porque o modo controlado não usa useSearchParams).
  const [plWin, setPlWin] = useState<AzPeriodValue>({ id: "5y" });

  const plClipped = useMemo(() => clipByPeriod(data.series, plWin), [data, plWin]);

  // Range disponível da série — limita os inputs do "Personalizado".
  const seriesMin = data.series[0]?.date;
  const seriesMax = data.series[data.series.length - 1]?.date;
  const plSpan = useMemo(() => spanDaysOf(plClipped), [plClipped]);

  const s = data.pl_stats;
  const cur = data.current;
  const z = zLabel(s?.current_z ?? null);

  return (
    <section aria-label="Valuation do Ibovespa" className="grid gap-4 md:grid-cols-2">
      {/* GRÁFICO 1 — P/L com média e bandas ±σ */}
      <article className="rounded-2xl border border-[#132960]/15 bg-white p-4 shadow-sm md:p-5">
        <header className="flex flex-wrap items-start justify-between gap-2 pb-2">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              P/L do Ibovespa
              <MethodInfo className="ml-1.5 align-middle">
                P/L bottom-up: 1 / Σ(peso·earnings yield) dos papéis do Ibovespa (pesos B3, EPS TTM
                e preço via yfinance). Bandas = média ± 1σ e ± 2σ da janela. Série inicia em{" "}
                {data.series[0]?.date ? fmtMesCurto(data.series[0].date) : "—"} (limite do
                histórico de lucros) e cresce a cada dia. {data.n_constituents} papéis, cobertura{" "}
                {data.coverage_weight_pct ?? "—"}% do índice. Não é recomendação.
              </MethodInfo>
            </h3>
            <p className="mt-0.5 text-[11px] text-zinc-500">
              Histórico com média e bandas de ±1σ/±2σ (z-score)
            </p>
          </div>
          <AzPeriodSelector value={plWin} onChange={setPlWin} min={seriesMin} max={seriesMax} />
        </header>

        <div className="flex flex-wrap items-baseline gap-3 pb-1 text-[11px]">
          <span className="inline-flex items-baseline gap-1.5">
            <span className="text-zinc-600">P/L atual</span>
            <strong className="text-lg text-[#132960] tabular-nums">
              {cur ? fmtNum(cur.pl, 1) : "—"}
            </strong>
          </span>
          <span className="inline-flex items-baseline gap-1">
            <span className="text-zinc-600">vs média</span>
            <strong className="tabular-nums" style={{ color: z.color }}>{z.text}</strong>
          </span>
          {s ? (
            <span className="text-zinc-400">
              média {fmtNum(s.mean, 1)} · σ {fmtNum(s.sd, 1)}
            </span>
          ) : null}
        </div>

        <div style={{ height: 240 }} className="w-full">
          {plClipped.length < 2 ? (
            <div className="flex h-full items-center justify-center text-xs italic text-zinc-400">
              sem dados na janela
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={plClipped} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                <CartesianGrid {...azGridProps()} />
                <XAxis
                  {...azXAxisProps()}
                  dataKey="date"
                  tickFormatter={(d) => formatAxisDate(String(d), plSpan)}
                  minTickGap={32}
                />
                <YAxis
                  {...azYAxisProps()}
                  domain={["auto", "auto"]}
                  width={36}
                  tickFormatter={(v) => fmtNum(Number(v), 0)}
                />
                {/* Bandas ±2σ (clara) e ±1σ (um pouco mais forte) — valores constantes
                    vindos do JSON (pl_stats), então ReferenceArea É a forma nativa
                    (Area com dataKey=[low,high] só faz sentido p/ banda que varia no tempo). */}
                {s ? (
                  <>
                    <ReferenceArea
                      y1={s.minus2}
                      y2={s.plus2}
                      fill={BAND_COLOR}
                      fillOpacity={0.05}
                      ifOverflow="extendDomain"
                    />
                    <ReferenceArea
                      y1={s.minus1}
                      y2={s.plus1}
                      fill={BAND_COLOR}
                      fillOpacity={0.1}
                      ifOverflow="extendDomain"
                    />
                    <ReferenceLine
                      y={s.mean}
                      stroke={MEAN_COLOR}
                      strokeDasharray="4 3"
                      label={{ value: "média", position: "insideTopRight", fontSize: 9, fill: MEAN_COLOR }}
                    />
                    <ReferenceLine y={s.plus1} stroke={MEAN_COLOR} strokeOpacity={0.4} strokeDasharray="2 4" />
                    <ReferenceLine y={s.minus1} stroke={MEAN_COLOR} strokeOpacity={0.4} strokeDasharray="2 4" />
                  </>
                ) : null}
                <Tooltip
                  content={
                    <AzTooltip
                      labelFmt={(l) => fmtDataBR(String(l))}
                      valueFmt={(v) => fmtNum(v, 1)}
                    />
                  }
                  cursor={AZ_TOOLTIP_PROPS.cursor}
                />
                <Line
                  type="monotone"
                  dataKey="pl"
                  name="P/L"
                  stroke={PL_COLOR}
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>
        <p className="mt-2 text-right">
          <DataStamp
            giro={data.generated_at}
            dado={data.series[data.series.length - 1]?.date ?? null}
          />
        </p>
      </article>

      {/* GRÁFICO 2 — Prêmio de risco (EY/DY vs NTN-B), componente compartilhado */}
      <AcoesPremioNtnb data={data} />
    </section>
  );
}
