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
  azZeroLineProps,
} from "@/components/painel/core";
import {
  AZ_BRAND,
  AZ_CHART,
  AZ_TOOLTIP_PROPS,
  BENCHMARK_COLORS,
  variationText,
} from "@/lib/az-chart-theme";
import {
  diffDaysUTC,
  fmtDataBR,
  fmtMesCurto,
  fmtNum,
  fmtPct,
  fmtSignedNum,
  formatAxisDate,
} from "@/lib/format-br";
import type { AcoesValuationData, AcoesValuationPoint } from "@/lib/painel-acoes";

// Paleta 100% do tema AZ (az-chart-theme) — nenhum hex local.
const PL_COLOR = AZ_BRAND.navy; // série principal do card de P/L
const MEAN_COLOR = AZ_CHART.ticks; // linha da média (referência discreta)
const BAND_COLOR = AZ_BRAND.azure; // preenchimento das bandas ±1σ/±2σ
const EY_COLOR = AZ_BRAND.azure; // earnings yield = 1ª série (azul AZ)
const DY_COLOR = AZ_CHART.pos; // dividend yield (verde-mar AA)
const NTNB_COLOR = BENCHMARK_COLORS["NTN-B"]; // ocre — cor FIXA do benchmark no site inteiro
const PREMIO_COLOR = AZ_BRAND.rust; // prêmio = série derivada em destaque

type Props = {
  data: AcoesValuationData;
};

type PremiumMode = "ey" | "dy";

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
  const [premWin, setPremWin] = useState<AzPeriodValue>({ id: "5y" });
  const [premMode, setPremMode] = useState<PremiumMode>("ey");

  const plClipped = useMemo(() => clipByPeriod(data.series, plWin), [data, plWin]);
  const premClipped = useMemo(() => clipByPeriod(data.series, premWin), [data, premWin]);

  // Range disponível da série — limita os inputs do "Personalizado".
  const seriesMin = data.series[0]?.date;
  const seriesMax = data.series[data.series.length - 1]?.date;
  const plSpan = useMemo(() => spanDaysOf(plClipped), [plClipped]);
  const premSpan = useMemo(() => spanDaysOf(premClipped), [premClipped]);

  const s = data.pl_stats;
  const cur = data.current;
  const z = zLabel(s?.current_z ?? null);

  const yieldKey = premMode === "ey" ? "ey_pct" : "dy_pct";
  const premKey = premMode === "ey" ? "prem_ey_pp" : "prem_dy_pp";
  const yieldLabel = premMode === "ey" ? "Earnings yield (1/P-L)" : "Dividend yield";
  const yieldColor = premMode === "ey" ? EY_COLOR : DY_COLOR;
  const curPrem = premMode === "ey" ? cur?.prem_ey_pp : cur?.prem_dy_pp;
  const curYield = premMode === "ey" ? cur?.ey_pct : cur?.dy_pct;

  return (
    <section aria-label="Valuation do Ibovespa" className="grid gap-4 md:grid-cols-2">
      {/* GRÁFICO 1 — P/L com média e bandas ±σ */}
      <article className="rounded-2xl border border-[#132960]/15 bg-white p-4 shadow-sm md:p-5">
        <header className="flex flex-wrap items-start justify-between gap-2 pb-2">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              P/L do Ibovespa
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
        <p className="mt-2 text-[10px] text-zinc-400">
          P/L bottom-up: 1 / Σ(peso·earnings yield) dos papéis do Ibovespa (pesos B3, EPS TTM e
          preço via yfinance). Bandas = média ± 1σ e ± 2σ da janela. Série inicia em{" "}
          {data.series[0]?.date ? fmtMesCurto(data.series[0].date) : "—"} (limite do histórico de
          lucros) e cresce a cada dia. {data.n_constituents} papéis, cobertura{" "}
          {data.coverage_weight_pct ?? "—"}% do índice. Não é recomendação.
        </p>
        <p className="mt-2 text-right">
          <DataStamp
            giro={data.generated_at}
            dado={data.series[data.series.length - 1]?.date ?? null}
          />
        </p>
      </article>

      {/* GRÁFICO 2 — Prêmio de risco (EY/DY vs NTN-B) */}
      <article className="rounded-2xl border border-[#132960]/15 bg-white p-4 shadow-sm md:p-5">
        <header className="flex flex-wrap items-start justify-between gap-2 pb-2">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Prêmio de risco vs NTN-B
            </h3>
            <p className="mt-0.5 text-[11px] text-zinc-500">
              {yieldLabel} do Ibovespa − juro real da NTN-B ~10a
            </p>
          </div>
          <AzPeriodSelector value={premWin} onChange={setPremWin} min={seriesMin} max={seriesMax} />
        </header>

        {/* Toggle EY / DY */}
        <div className="flex items-center gap-1 pb-2">
          <span className="mr-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
            Base:
          </span>
          {([
            { id: "ey" as PremiumMode, label: "Lucro (EY)" },
            { id: "dy" as PremiumMode, label: "Dividendos (DY)" },
          ]).map((opt) => {
            const active = premMode === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setPremMode(opt.id)}
                aria-pressed={active}
                className={
                  "rounded-full border px-3 py-1 text-[11px] font-semibold transition " +
                  (active
                    ? "border-transparent bg-[#132960] text-white shadow-sm"
                    : "border-[#132960]/15 bg-white text-zinc-600 hover:border-[#132960]/40 hover:text-[#132960]")
                }
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-4 pb-1 text-[11px]">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: yieldColor }} />
            <span className="text-zinc-600">{premMode === "ey" ? "Earnings yield" : "Dividend yield"}</span>
            {curYield != null ? (
              <strong className="text-[#132960] tabular-nums">{fmtPct(curYield, 2)}</strong>
            ) : null}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: NTNB_COLOR }} />
            <span className="text-zinc-600">NTN-B 10a</span>
            {cur?.ntnb_pct != null ? (
              <strong className="text-[#132960] tabular-nums">{fmtPct(cur.ntnb_pct, 2)}</strong>
            ) : null}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: PREMIO_COLOR }} />
            <span className="text-zinc-600">Prêmio</span>
            {curPrem != null ? (
              <strong className="tabular-nums" style={{ color: variationText(curPrem) }}>
                {fmtSignedNum(curPrem, 2)} pp
              </strong>
            ) : null}
          </span>
        </div>

        <div style={{ height: 240 }} className="w-full">
          {premClipped.length < 2 ? (
            <div className="flex h-full items-center justify-center text-xs italic text-zinc-400">
              sem dados na janela
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              {/* EIXO ÚNICO: yield (%), NTN-B (%) e prêmio (pp) são a MESMA régua
                  aditiva (prêmio = yield − NTN-B), então o duplo eixo anterior só
                  distorcia a comparação. O zero ganha a linha navy padrão. */}
              <ComposedChart data={premClipped} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                <CartesianGrid {...azGridProps()} />
                <XAxis
                  {...azXAxisProps()}
                  dataKey="date"
                  tickFormatter={(d) => formatAxisDate(String(d), premSpan)}
                  minTickGap={32}
                />
                <YAxis
                  {...azYAxisProps()}
                  domain={["auto", "auto"]}
                  width={44}
                  tickFormatter={(v) => `${fmtNum(Number(v), 0)}%`}
                />
                <ReferenceLine {...azZeroLineProps("y")} ifOverflow="extendDomain" />
                <Tooltip
                  content={
                    <AzTooltip
                      labelFmt={(l) => fmtDataBR(String(l))}
                      valueFmt={(v, name) =>
                        name === "Prêmio" ? `${fmtSignedNum(v, 2)} pp` : fmtPct(v, 2)
                      }
                    />
                  }
                  cursor={AZ_TOOLTIP_PROPS.cursor}
                />
                <Line
                  type="monotone"
                  dataKey={yieldKey}
                  name={premMode === "ey" ? "Earnings yield" : "Dividend yield"}
                  stroke={yieldColor}
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                  connectNulls
                />
                <Line
                  type="monotone"
                  dataKey="ntnb_pct"
                  name="NTN-B 10a"
                  stroke={NTNB_COLOR}
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                  connectNulls
                />
                <Line
                  type="monotone"
                  dataKey={premKey}
                  name="Prêmio"
                  stroke={PREMIO_COLOR}
                  strokeWidth={2}
                  strokeDasharray="3 2"
                  dot={false}
                  isAnimationActive={false}
                  connectNulls
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>
        <p className="mt-2 text-[10px] text-zinc-400">
          Prêmio (linha tracejada) = yield da bolsa − NTN-B real ~10a (curva IPCA ANBIMA,
          interpolada), em pontos percentuais na mesma escala do eixo. Earnings/dividend yield são
          nominais e a NTN-B é real — é o gauge usual de "quanto a bolsa paga acima do juro real".
          Acima de 0 = bolsa mais atrativa que o juro real; abaixo = mais cara. Não é recomendação.
        </p>
        <p className="mt-2 text-right">
          <DataStamp
            giro={data.generated_at}
            dado={data.series[data.series.length - 1]?.date ?? null}
          />
        </p>
      </article>
    </section>
  );
}
