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
  TIME_WINDOW_OPTIONS,
  TimeWindowToggle,
  type TimeWindow,
} from "@/components/painel/fii/TimeWindowToggle";
import type { AcoesValuationData, AcoesValuationPoint } from "@/lib/painel-acoes";

const PL_COLOR = "#132960"; // azul profundo
const MEAN_COLOR = "#71717A"; // cinza (média)
const BAND1_COLOR = "#027DFC"; // azure (±1σ)
const EY_COLOR = "#027DFC"; // azure (earnings yield)
const DY_COLOR = "#16A34A"; // verde (dividend yield)
const NTNB_COLOR = "#7E22CE"; // roxo (NTN-B)
const PREMIO_COLOR = "#FF5713"; // rust (prêmio)

type Props = {
  data: AcoesValuationData;
};

type PremiumMode = "ey" | "dy";

function clipByWindow(arr: AcoesValuationPoint[], winId: TimeWindow): AcoesValuationPoint[] {
  if (!arr.length) return [];
  const days = TIME_WINDOW_OPTIONS.find((o) => o.id === winId)?.days ?? 365 * 5;
  const last = new Date(arr[arr.length - 1].date + "T00:00:00Z").getTime();
  const cutoff = last - days * 86_400_000;
  return arr.filter((p) => new Date(p.date + "T00:00:00Z").getTime() >= cutoff);
}

function formatAxisDate(d: string, span: TimeWindow): string {
  const dt = new Date(d + "T00:00:00Z");
  if (span === "7d" || span === "5d" || span === "30d") {
    return dt.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "UTC" });
  }
  return dt.toLocaleDateString("pt-BR", { month: "2-digit", year: "2-digit", timeZone: "UTC" });
}

/** Leitura qualitativa do z-score do P/L atual. */
function zLabel(z: number | null): { text: string; color: string } {
  if (z == null) return { text: "—", color: "#71717A" };
  if (z >= 1) return { text: `caro (${z >= 0 ? "+" : ""}${z.toFixed(2)}σ)`, color: "#DC2626" };
  if (z <= -1) return { text: `barato (${z.toFixed(2)}σ)`, color: "#16A34A" };
  return { text: `na média (${z >= 0 ? "+" : ""}${z.toFixed(2)}σ)`, color: "#A16207" };
}

export function AcoesValuation({ data }: Props) {
  const [plWin, setPlWin] = useState<TimeWindow>("5y");
  const [premWin, setPremWin] = useState<TimeWindow>("5y");
  const [premMode, setPremMode] = useState<PremiumMode>("ey");

  const plClipped = useMemo(() => clipByWindow(data.series, plWin), [data, plWin]);
  const premClipped = useMemo(() => clipByWindow(data.series, premWin), [data, premWin]);

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
          <TimeWindowToggle value={plWin} onChange={setPlWin} />
        </header>

        <div className="flex flex-wrap items-baseline gap-3 pb-1 text-[11px]">
          <span className="inline-flex items-baseline gap-1.5">
            <span className="text-zinc-600">P/L atual</span>
            <strong className="text-lg text-[#132960] tabular-nums">
              {cur ? cur.pl.toFixed(1) : "—"}
            </strong>
          </span>
          <span className="inline-flex items-baseline gap-1">
            <span className="text-zinc-600">vs média</span>
            <strong className="tabular-nums" style={{ color: z.color }}>{z.text}</strong>
          </span>
          {s ? (
            <span className="text-zinc-400">
              média {s.mean.toFixed(1)} · σ {s.sd.toFixed(1)}
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
                <CartesianGrid strokeDasharray="2 4" stroke="#E4E4E7" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(d) => formatAxisDate(String(d), plWin)}
                  tick={{ fontSize: 10, fill: "#71717A" }}
                  minTickGap={32}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "#71717A" }}
                  domain={["auto", "auto"]}
                  width={36}
                  tickFormatter={(v) => (typeof v === "number" ? v.toFixed(0) : String(v))}
                />
                {/* Bandas: ±2σ (clara) e ±1σ (um pouco mais forte) */}
                {s ? (
                  <>
                    <ReferenceArea
                      y1={s.minus2}
                      y2={s.plus2}
                      fill={BAND1_COLOR}
                      fillOpacity={0.05}
                      ifOverflow="extendDomain"
                    />
                    <ReferenceArea
                      y1={s.minus1}
                      y2={s.plus1}
                      fill={BAND1_COLOR}
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
                  contentStyle={{ fontSize: 11, padding: "6px 10px", borderRadius: 6 }}
                  labelFormatter={(d) =>
                    new Date(String(d) + "T00:00:00Z").toLocaleDateString("pt-BR", {
                      month: "long",
                      year: "numeric",
                      timeZone: "UTC",
                    })
                  }
                  formatter={(v) => {
                    const n = typeof v === "number" ? v : Number(v);
                    return [Number.isFinite(n) ? n.toFixed(1) : "—", "P/L"];
                  }}
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
          {data.series[0]?.date?.slice(0, 7) ?? "—"} (limite do histórico de lucros) e cresce a cada
          dia. {data.n_constituents} papéis, cobertura {data.coverage_weight_pct ?? "—"}% do índice.
          Não é recomendação.
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
          <TimeWindowToggle value={premWin} onChange={setPremWin} />
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
              <strong className="text-[#132960] tabular-nums">{curYield.toFixed(2)}%</strong>
            ) : null}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: NTNB_COLOR }} />
            <span className="text-zinc-600">NTN-B 10a</span>
            {cur?.ntnb_pct != null ? (
              <strong className="text-[#132960] tabular-nums">{cur.ntnb_pct.toFixed(2)}%</strong>
            ) : null}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: PREMIO_COLOR }} />
            <span className="text-zinc-600">Prêmio</span>
            {curPrem != null ? (
              <strong className="tabular-nums" style={{ color: curPrem >= 0 ? "#16A34A" : "#DC2626" }}>
                {curPrem >= 0 ? "+" : ""}
                {curPrem.toFixed(2)} pp
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
              <ComposedChart data={premClipped} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="2 4" stroke="#E4E4E7" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(d) => formatAxisDate(String(d), premWin)}
                  tick={{ fontSize: 10, fill: "#71717A" }}
                  minTickGap={32}
                />
                <YAxis
                  yAxisId="left"
                  tick={{ fontSize: 10, fill: "#71717A" }}
                  domain={["auto", "auto"]}
                  width={42}
                  tickFormatter={(v) => `${typeof v === "number" ? v.toFixed(1) : v}%`}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 10, fill: PREMIO_COLOR }}
                  domain={["auto", "auto"]}
                  width={48}
                  tickFormatter={(v) => `${typeof v === "number" ? (v >= 0 ? "+" : "") + v.toFixed(1) : v}`}
                />
                <ReferenceLine yAxisId="right" y={0} stroke={PREMIO_COLOR} strokeOpacity={0.3} strokeDasharray="3 3" />
                <Tooltip
                  contentStyle={{ fontSize: 11, padding: "6px 10px", borderRadius: 6 }}
                  labelFormatter={(d) =>
                    new Date(String(d) + "T00:00:00Z").toLocaleDateString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      timeZone: "UTC",
                    })
                  }
                  formatter={(v, name) => {
                    const n = typeof v === "number" ? v : Number(v);
                    if (!Number.isFinite(n)) return ["—", name];
                    const suffix = name === "Prêmio" ? " pp" : "%";
                    return [(name === "Prêmio" && n >= 0 ? "+" : "") + n.toFixed(2) + suffix, name];
                  }}
                />
                <Line
                  yAxisId="left"
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
                  yAxisId="left"
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
                  yAxisId="right"
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
          Prêmio (eixo direito) = yield da bolsa − NTN-B real ~10a (curva IPCA ANBIMA, interpolada).
          Earnings/dividend yield são nominais e a NTN-B é real — é o gauge usual de "quanto a bolsa
          paga acima do juro real". Acima de 0 = bolsa mais atrativa que o juro real; abaixo = mais
          cara. Não é recomendação.
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
