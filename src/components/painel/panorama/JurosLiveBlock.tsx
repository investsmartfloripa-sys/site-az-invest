"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  fetchLiveCurve,
  interpolateRate,
  maturityLabel,
  type LiveContract,
  type LiveCurve,
} from "@/lib/painel-b3-live";

const REFRESH_MS = 60_000;

type TabId = "di" | "ipca" | "breakeven";

const TABS: { id: TabId; label: string }[] = [
  { id: "di", label: "Curva DI (pré)" },
  { id: "ipca", label: "Curva IPCA+ (DAP)" },
  { id: "breakeven", label: "Inflação implícita" },
];

type Props = {
  /**
   * Curva pre D-30 do pipeline TaxaSwap (mescla com a serie historica que
   * ja temos no Blob): pares vencimento ISO -> taxa % a.a.
   */
  d30Pre?: { maturity: string; rate: number }[];
};

type ChartPoint = {
  t: number;
  label: string;
  agora?: number | null;
  d1?: number | null;
  d30?: number | null;
};

function fmtRate(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${v.toFixed(2).replace(".", ",")}%`;
}

function fmtInt(v: number): string {
  return v.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
}

function fmtQuotedAt(quotedAt: string | null): string {
  if (!quotedAt) return "";
  const [d, hm] = [quotedAt.slice(0, 10), quotedAt.slice(11, 16)];
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y} ${hm}`;
}

/** Janeiros (liquidez) + curtos com negocio; toggle expande para todos com taxa. */
function liquidContracts(contracts: LiveContract[], showAll: boolean): LiveContract[] {
  const withRate = contracts.filter((c) => c.rate != null);
  if (showAll) return withRate;
  return withRate.filter(
    (c) => /F\d{2}$/.test(c.symbol) || c.trades > 500 || c.openInterest > 500_000,
  );
}

function buildChartData(
  live: LiveContract[],
  d30Pre: { maturity: string; rate: number }[] | undefined,
): ChartPoint[] {
  const byT = new Map<number, ChartPoint>();

  for (const c of live) {
    if (c.rate == null) continue;
    const t = Date.parse(c.maturity);
    if (!Number.isFinite(t)) continue;
    const prev = byT.get(t) ?? { t, label: maturityLabel(c.maturity) };
    prev.agora = c.rate;
    prev.d1 = c.prevAdjust;
    byT.set(t, prev);
  }

  for (const p of d30Pre ?? []) {
    const t = Date.parse(p.maturity);
    if (!Number.isFinite(t)) continue;
    const prev = byT.get(t) ?? { t, label: maturityLabel(p.maturity) };
    prev.d30 = p.rate;
    byT.set(t, prev);
  }

  return [...byT.values()].sort((a, b) => a.t - b.t);
}

export function JurosLiveBlock({ d30Pre }: Props) {
  const [tab, setTab] = useState<TabId>("di");
  const [showAll, setShowAll] = useState(false);
  const [di, setDi] = useState<LiveCurve | null>(null);
  const [dap, setDap] = useState<LiveCurve | null>(null);
  const [error, setError] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const ctrl = new AbortController();
    let cancelled = false;

    async function load() {
      try {
        const [diCurve, dapCurve] = await Promise.all([
          fetchLiveCurve("DI1", ctrl.signal),
          fetchLiveCurve("DAP", ctrl.signal).catch(() => null),
        ]);
        if (cancelled) return;
        setDi(diCurve);
        setDap(dapCurve);
        setError(false);
      } catch {
        if (!cancelled) setError(true);
      }
    }

    load();
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        setTick((t) => t + 1);
        load();
      }
    }, REFRESH_MS);

    return () => {
      cancelled = true;
      ctrl.abort();
      window.clearInterval(id);
    };
    // tick intencionalmente fora: load roda no proprio interval.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const diLiquid = useMemo(() => liquidContracts(di?.contracts ?? [], showAll), [di, showAll]);
  const dapLiquid = useMemo(() => liquidContracts(dap?.contracts ?? [], true), [dap]);

  const diChart = useMemo(() => buildChartData(diLiquid, d30Pre), [diLiquid, d30Pre]);
  const dapChart = useMemo(() => buildChartData(dapLiquid, undefined), [dapLiquid]);

  const breakeven = useMemo(() => {
    if (!di || !dap) return [];
    const out: { t: number; label: string; implicita: number }[] = [];
    for (const c of dapLiquid) {
      if (c.rate == null) continue;
      const diRate = interpolateRate(di.contracts, c.maturity);
      if (diRate == null) continue;
      const be = ((1 + diRate / 100) / (1 + c.rate / 100) - 1) * 100;
      const t = Date.parse(c.maturity);
      if (!Number.isFinite(t)) continue;
      out.push({ t, label: maturityLabel(c.maturity), implicita: be });
    }
    return out.sort((a, b) => a.t - b.t);
  }, [di, dap, dapLiquid]);

  if (error && !di) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        Cotações intraday da B3 indisponíveis no momento — os gráficos D-1 abaixo seguem valendo.
      </div>
    );
  }

  const statusBadge = di ? (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
        di.isToday ? "bg-[#0c3d22] text-[#39d98a]" : "bg-zinc-800 text-zinc-300"
      }`}
    >
      <span
        className={`inline-block h-1.5 w-1.5 rounded-full ${di.isToday ? "animate-pulse bg-[#39d98a]" : "bg-zinc-400"}`}
        aria-hidden
      />
      {di.isToday ? "Pregão de hoje · atraso ~15 min" : "Último fechamento"}
    </span>
  ) : null;

  return (
    <section id="juros" aria-label="Curvas de juros intraday" className="overflow-hidden rounded-2xl border border-[#132960]/15 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#132960] px-4 py-3 md:px-5">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-semibold text-white md:text-lg">Juros ao vivo — DI1 e DAP (B3)</h2>
          {statusBadge}
        </div>
        <p className="text-[11px] text-[#9db8e8]">
          {di?.quotedAt ? `Cotado às ${fmtQuotedAt(di.quotedAt)}` : "Carregando cotações..."}
          <span className="sr-only">{tick}</span>
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 px-4 pt-3 md:px-5">
        <div className="flex flex-wrap gap-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`rounded-t-lg border-b-2 px-3 py-2 text-xs font-semibold transition md:text-sm ${
                tab === t.id
                  ? "border-[#027DFC] text-[#027DFC]"
                  : "border-transparent text-zinc-500 hover:text-[#132960]"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        {tab === "di" ? (
          <label className="flex cursor-pointer items-center gap-2 pb-2 text-xs text-zinc-600">
            <input
              type="checkbox"
              checked={showAll}
              onChange={(e) => setShowAll(e.target.checked)}
              className="h-3.5 w-3.5 accent-[#027DFC]"
            />
            Mostrar todos os vencimentos
          </label>
        ) : null}
      </div>

      <div className="grid gap-5 p-4 md:p-5 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <div className="min-w-0">
          <div className="h-[300px] w-full md:h-[340px]">
            {!di ? (
              <div className="flex h-full items-center justify-center text-sm text-zinc-400">
                Carregando curva...
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                {tab === "breakeven" ? (
                  <LineChart data={breakeven} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
                    <CartesianGrid strokeDasharray="2 4" stroke="#E4E4E7" />
                    <XAxis
                      dataKey="t"
                      type="number"
                      scale="time"
                      domain={["dataMin", "dataMax"]}
                      tickFormatter={(t) => maturityLabel(new Date(t).toISOString().slice(0, 10))}
                      tick={{ fontSize: 10, fill: "#71717A" }}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: "#71717A" }}
                      width={44}
                      domain={["auto", "auto"]}
                      tickFormatter={(v) => `${Number(v).toFixed(1)}%`}
                    />
                    <Tooltip
                      labelFormatter={(t) => maturityLabel(new Date(Number(t)).toISOString().slice(0, 10))}
                      formatter={(v) => [fmtRate(typeof v === "number" ? v : Number(v)), "IPCA implícito"]}
                      contentStyle={{ fontSize: 11, borderRadius: 8 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="implicita"
                      name="IPCA implícito (DI − DAP)"
                      stroke="#7E22CE"
                      strokeWidth={2}
                      dot={{ r: 2.5 }}
                      isAnimationActive={false}
                    />
                  </LineChart>
                ) : (
                  <LineChart
                    data={tab === "di" ? diChart : dapChart}
                    margin={{ top: 8, right: 16, bottom: 4, left: 0 }}
                  >
                    <CartesianGrid strokeDasharray="2 4" stroke="#E4E4E7" />
                    <XAxis
                      dataKey="t"
                      type="number"
                      scale="time"
                      domain={["dataMin", "dataMax"]}
                      tickFormatter={(t) => maturityLabel(new Date(t).toISOString().slice(0, 10))}
                      tick={{ fontSize: 10, fill: "#71717A" }}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: "#71717A" }}
                      width={44}
                      domain={["auto", "auto"]}
                      tickFormatter={(v) => `${Number(v).toFixed(1)}%`}
                    />
                    <Tooltip
                      labelFormatter={(t) => maturityLabel(new Date(Number(t)).toISOString().slice(0, 10))}
                      formatter={(v, name) => [fmtRate(typeof v === "number" ? v : Number(v)), String(name)]}
                      contentStyle={{ fontSize: 11, borderRadius: 8 }}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Line
                      type="monotone"
                      dataKey="agora"
                      name="Agora (delay 15 min)"
                      stroke="#0E1F4D"
                      strokeWidth={2.2}
                      dot={{ r: 2.5 }}
                      connectNulls
                      isAnimationActive={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="d1"
                      name="Ajuste D-1"
                      stroke="#027DFC"
                      strokeWidth={1.5}
                      strokeDasharray="5 3"
                      dot={false}
                      connectNulls
                      isAnimationActive={false}
                    />
                    {tab === "di" && (d30Pre?.length ?? 0) > 0 ? (
                      <Line
                        type="monotone"
                        dataKey="d30"
                        name="D-30 (pipeline AZ)"
                        stroke="#94A3B8"
                        strokeWidth={1.5}
                        strokeDasharray="2 3"
                        dot={false}
                        connectNulls
                        isAnimationActive={false}
                      />
                    ) : null}
                  </LineChart>
                )}
              </ResponsiveContainer>
            )}
          </div>
          <p className="mt-2 text-[11px] text-zinc-500">
            {tab === "breakeven"
              ? "Inflação implícita aproximada: (1+DI)/(1+DAP) − 1 nos vencimentos do DAP, com DI interpolado linearmente. Referência editorial, não tradable."
              : "Fonte: cotações públicas B3 (delay ~15 min). Histórico D-30 do pipeline AZ (TaxaSwap B3, D-1)."}
          </p>
        </div>

        <div className="min-w-0 overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="border-b border-zinc-200 text-left text-[10px] uppercase tracking-wider text-zinc-500">
                <th className="py-2 pr-2 font-semibold">Venc.</th>
                <th className="py-2 pr-2 text-right font-semibold">Agora</th>
                <th className="py-2 pr-2 text-right font-semibold">Δ dia</th>
                <th className="hidden py-2 pr-2 text-right font-semibold sm:table-cell">Mín–Máx</th>
                <th className="hidden py-2 text-right font-semibold md:table-cell">Contr. abertos</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {(tab === "ipca" ? dapLiquid : diLiquid).map((c) => {
                const bps = c.changeBps;
                const tone =
                  bps == null ? "text-zinc-400" : bps > 0 ? "text-[#DC2626]" : bps < 0 ? "text-[#16A34A]" : "text-zinc-500";
                const sign = bps == null ? "" : bps > 0 ? "+" : "";
                return (
                  <tr key={c.symbol} className="tabular-nums">
                    <td className="py-1.5 pr-2 font-semibold text-[#132960]">
                      {maturityLabel(c.maturity)}
                      <span className="ml-1 hidden text-[10px] font-normal text-zinc-400 lg:inline">{c.symbol}</span>
                    </td>
                    <td className="py-1.5 pr-2 text-right font-semibold text-[#132960]">{fmtRate(c.rate)}</td>
                    <td className={`py-1.5 pr-2 text-right font-semibold ${tone}`}>
                      {bps == null ? "—" : `${sign}${bps} bps`}
                    </td>
                    <td className="hidden py-1.5 pr-2 text-right text-zinc-500 sm:table-cell">
                      {c.low != null && c.high != null
                        ? `${c.low.toFixed(2).replace(".", ",")}–${c.high.toFixed(2).replace(".", ",")}`
                        : "—"}
                    </td>
                    <td className="hidden py-1.5 text-right text-zinc-500 md:table-cell">{fmtInt(c.openInterest)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-2 text-[11px] text-zinc-400">
            Δ dia vs ajuste D-1 · alta de juros em vermelho, queda em verde. Sem negócio no dia, usa mid bid/ask.
          </p>
        </div>
      </div>
    </section>
  );
}
