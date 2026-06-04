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

/**
 * Gradiente temporal padrao AZ: serie atual em preto e cortes
 * progressivamente mais claros conforme recuam no tempo
 * (ver PADRAO-VISUAL-GRAFICOS.md na pasta do projeto).
 */
const TIME_COLORS = {
  agora: "#0A0A0A",
  d1: "#3D4E78",
  d30: "#8A9AC0",
  d90: "#C2CCE2",
  d365: "#E0E6F2",
} as const;

const GRID = "#E2E8F0";
const TICKS = "#64748B";

type TabId = "di" | "ipca" | "selic" | "treasury";

const TABS: { id: TabId; label: string }[] = [
  { id: "di", label: "Curva DI (pré)" },
  { id: "ipca", label: "Curva IPCA+ (DAP)" },
  { id: "selic", label: "Selic implícita" },
  { id: "treasury", label: "Treasury EUA" },
];

export type CurveCut = { maturity: string; rate: number };

export type SelicMeeting = {
  /** Data da reuniao COPOM (ISO). */
  date: string;
  d90: number | null;
  d30: number | null;
  recent: number | null;
};

export type TreasuryTenor = {
  tenor: number;
  d365: number | null;
  d90: number | null;
  d30: number | null;
  recent: number | null;
};

type Props = {
  /** Curva pre D-30/D-90 do pipeline TaxaSwap (Blob) p/ sobrepor no DI live. */
  d30Pre?: CurveCut[];
  d90Pre?: CurveCut[];
  /** Selic implicita por reuniao COPOM (cortes do pipeline). */
  selicMeetings?: SelicMeeting[];
  /** Curva Treasury por tenor (cortes do pipeline FRED). */
  treasuryTenors?: TreasuryTenor[];
};

type ChartPoint = {
  t: number;
  agora?: number | null;
  d1?: number | null;
  d30?: number | null;
  d90?: number | null;
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

function tsLabel(t: number): string {
  return maturityLabel(new Date(t).toISOString().slice(0, 10));
}

function dateLabelBR(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y.slice(2)}`;
}

/** Janeiros (liquidez) + curtos com negocio; toggle expande p/ todos com taxa. */
function liquidContracts(contracts: LiveContract[], showAll: boolean): LiveContract[] {
  const withRate = contracts.filter((c) => c.rate != null);
  if (showAll) return withRate;
  return withRate.filter((c) => /F\d{2}$/.test(c.symbol) || c.trades > 2000);
}

function buildCurveChart(
  live: LiveContract[],
  cuts: { d30?: CurveCut[]; d90?: CurveCut[] },
  show: { d1: boolean; d30: boolean; d90: boolean },
): ChartPoint[] {
  const byT = new Map<number, ChartPoint>();
  const at = (t: number): ChartPoint => {
    const prev = byT.get(t) ?? { t };
    byT.set(t, prev);
    return prev;
  };

  for (const c of live) {
    if (c.rate == null) continue;
    const t = Date.parse(c.maturity);
    if (!Number.isFinite(t)) continue;
    const p = at(t);
    p.agora = c.rate;
    if (show.d1) p.d1 = c.prevAdjust;
  }
  if (show.d30) {
    for (const cut of cuts.d30 ?? []) {
      const t = Date.parse(cut.maturity);
      if (Number.isFinite(t)) at(t).d30 = cut.rate;
    }
  }
  if (show.d90) {
    for (const cut of cuts.d90 ?? []) {
      const t = Date.parse(cut.maturity);
      if (Number.isFinite(t)) at(t).d90 = cut.rate;
    }
  }
  return [...byT.values()].sort((a, b) => a.t - b.t);
}

/**
 * Selic implicita "agora": forward anualizado entre reunioes COPOM
 * consecutivas usando a curva DI live (DU aproximado por 252/365).
 * Aproximacao editorial — o corte oficial D-1 vem do pipeline R.
 */
function buildSelicLive(di: LiveCurve | null, meetings: SelicMeeting[]): Map<string, number> {
  const out = new Map<string, number>();
  if (!di || meetings.length < 2) return out;
  const today = Date.now();
  const DU_YEAR = 252;
  const duOf = (iso: string) => Math.max(1, ((Date.parse(iso) - today) / 86_400_000) * (252 / 365));

  for (let i = 0; i < meetings.length - 1; i++) {
    const a = meetings[i];
    const b = meetings[i + 1];
    const ra = interpolateRate(di.contracts, a.date);
    const rb = interpolateRate(di.contracts, b.date);
    if (ra == null || rb == null) continue;
    const duA = duOf(a.date);
    const duB = duOf(b.date);
    if (duB <= duA + 1) continue;
    const fa = Math.pow(1 + ra / 100, duA / DU_YEAR);
    const fb = Math.pow(1 + rb / 100, duB / DU_YEAR);
    const fwd = (Math.pow(fb / fa, DU_YEAR / (duB - duA)) - 1) * 100;
    if (Number.isFinite(fwd) && fwd > 0 && fwd < 30) out.set(a.date, fwd);
  }
  return out;
}

const tooltipStyle = {
  background: "#132960",
  border: "none",
  borderRadius: 8,
  color: "#fff",
  fontSize: 12,
  boxShadow: "0 4px 12px rgba(19,41,96,.25)",
} as const;

export function JurosLiveBlock({ d30Pre, d90Pre, selicMeetings = [], treasuryTenors = [] }: Props) {
  const [tab, setTab] = useState<TabId>("di");
  const [showAll, setShowAll] = useState(false);
  const [show, setShow] = useState({ d1: true, d30: true, d90: false });
  const [di, setDi] = useState<LiveCurve | null>(null);
  const [dap, setDap] = useState<LiveCurve | null>(null);
  const [error, setError] = useState(false);

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
      if (document.visibilityState === "visible") load();
    }, REFRESH_MS);

    return () => {
      cancelled = true;
      ctrl.abort();
      window.clearInterval(id);
    };
  }, []);

  const diLiquid = useMemo(() => liquidContracts(di?.contracts ?? [], showAll), [di, showAll]);
  const dapLiquid = useMemo(() => liquidContracts(dap?.contracts ?? [], true), [dap]);

  const diChart = useMemo(
    () => buildCurveChart(diLiquid, { d30: d30Pre, d90: d90Pre }, show),
    [diLiquid, d30Pre, d90Pre, show],
  );
  const dapChart = useMemo(
    () => buildCurveChart(dapLiquid, {}, { d1: true, d30: false, d90: false }),
    [dapLiquid],
  );

  const selicLive = useMemo(() => buildSelicLive(di, selicMeetings), [di, selicMeetings]);
  const selicChart = useMemo(
    () =>
      selicMeetings.map((m) => ({
        t: Date.parse(m.date),
        label: dateLabelBR(m.date),
        agora: selicLive.get(m.date) ?? null,
        recent: m.recent,
        d30: m.d30,
        d90: m.d90,
      })),
    [selicMeetings, selicLive],
  );

  if (error && !di) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        Cotações intraday da B3 indisponíveis no momento — os dados D-1 do pipeline seguem valendo nas
        trilhas de renda fixa.
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

  const showSideTable = tab === "di" || tab === "ipca";

  const cutToggles: { key: keyof typeof show; label: string; color: string; available: boolean }[] = [
    { key: "d1", label: "D-1", color: TIME_COLORS.d1, available: true },
    { key: "d30", label: "D-30", color: TIME_COLORS.d30, available: (d30Pre?.length ?? 0) > 0 },
    { key: "d90", label: "D-90", color: TIME_COLORS.d90, available: (d90Pre?.length ?? 0) > 0 },
  ];

  return (
    <section
      id="juros"
      aria-label="Renda fixa intraday"
      className="overflow-hidden rounded-2xl border border-[#132960]/15 bg-white shadow-sm"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#132960] px-4 py-3 md:px-5">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-semibold text-white md:text-lg">Renda fixa ao vivo — B3</h2>
          {statusBadge}
        </div>
        <p className="text-[11px] text-[#9db8e8]">
          {di?.quotedAt ? `Cotado às ${fmtQuotedAt(di.quotedAt)}` : "Carregando cotações..."}
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
        <div className="flex flex-wrap items-center gap-3 pb-2">
          {tab === "di" ? (
            <>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                  Comparar:
                </span>
                {cutToggles.map((c) =>
                  c.available ? (
                    <button
                      key={c.key}
                      type="button"
                      aria-pressed={show[c.key]}
                      onClick={() => setShow((s) => ({ ...s, [c.key]: !s[c.key] }))}
                      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold transition ${
                        show[c.key]
                          ? "border-transparent bg-zinc-100 text-[#132960]"
                          : "border-zinc-200 bg-white text-zinc-400 hover:text-[#132960]"
                      }`}
                    >
                      <span
                        aria-hidden
                        className="inline-block h-2 w-2 rounded-full"
                        style={{ backgroundColor: c.color, opacity: show[c.key] ? 1 : 0.35 }}
                      />
                      {c.label}
                    </button>
                  ) : null,
                )}
              </div>
              <label className="flex cursor-pointer items-center gap-1.5 text-xs text-zinc-600">
                <input
                  type="checkbox"
                  checked={showAll}
                  onChange={(e) => setShowAll(e.target.checked)}
                  className="h-3.5 w-3.5 accent-[#027DFC]"
                />
                Todos os vencimentos
              </label>
            </>
          ) : null}
        </div>
      </div>

      <div
        className={`grid gap-5 p-4 md:p-5 ${showSideTable ? "lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]" : ""}`}
      >
        <div className="min-w-0">
          <div className="h-[300px] w-full md:h-[340px]">
            {!di ? (
              <div className="flex h-full items-center justify-center text-sm text-zinc-400">
                Carregando curvas...
              </div>
            ) : tab === "selic" ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={selicChart} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
                  <CartesianGrid stroke={GRID} strokeWidth={1} />
                  <XAxis
                    dataKey="t"
                    type="number"
                    scale="time"
                    domain={["dataMin", "dataMax"]}
                    tickFormatter={(t) => tsLabel(Number(t))}
                    tick={{ fontSize: 10, fill: TICKS }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: TICKS }}
                    width={44}
                    domain={["auto", "auto"]}
                    tickFormatter={(v) => `${Number(v).toFixed(1)}%`}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    labelFormatter={(t) => `Reunião ${tsLabel(Number(t))}`}
                    formatter={(v, name) => [fmtRate(typeof v === "number" ? v : Number(v)), String(name)]}
                    contentStyle={tooltipStyle}
                    itemStyle={{ color: "#fff" }}
                    labelStyle={{ color: "#94A3B8", fontWeight: 600 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line type="stepAfter" dataKey="agora" name="Agora (B3 ~15 min)" stroke={TIME_COLORS.agora} strokeWidth={2.2} dot={{ r: 2.5 }} connectNulls isAnimationActive={false} />
                  <Line type="stepAfter" dataKey="recent" name="Fechamento D-1" stroke={TIME_COLORS.d1} strokeWidth={1.6} strokeDasharray="5 3" dot={false} connectNulls isAnimationActive={false} />
                  <Line type="stepAfter" dataKey="d30" name="D-30" stroke={TIME_COLORS.d30} strokeWidth={1.4} dot={false} connectNulls isAnimationActive={false} />
                  <Line type="stepAfter" dataKey="d90" name="D-90" stroke={TIME_COLORS.d90} strokeWidth={1.4} dot={false} connectNulls isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : tab === "treasury" ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={treasuryTenors} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
                  <CartesianGrid stroke={GRID} strokeWidth={1} />
                  <XAxis
                    dataKey="tenor"
                    type="number"
                    domain={[0, "dataMax"]}
                    tickFormatter={(v) => `${v}a`}
                    tick={{ fontSize: 10, fill: TICKS }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: TICKS }}
                    width={44}
                    domain={["auto", "auto"]}
                    tickFormatter={(v) => `${Number(v).toFixed(1)}%`}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    labelFormatter={(t) => `${t} ano${Number(t) > 1 ? "s" : ""}`}
                    formatter={(v, name) => [fmtRate(typeof v === "number" ? v : Number(v)), String(name)]}
                    contentStyle={tooltipStyle}
                    itemStyle={{ color: "#fff" }}
                    labelStyle={{ color: "#94A3B8", fontWeight: 600 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="recent" name="Recente (D-1)" stroke={TIME_COLORS.agora} strokeWidth={2.2} dot={{ r: 2.5 }} connectNulls isAnimationActive={false} />
                  <Line type="monotone" dataKey="d30" name="D-30" stroke={TIME_COLORS.d30} strokeWidth={1.5} dot={false} connectNulls isAnimationActive={false} />
                  <Line type="monotone" dataKey="d90" name="D-90" stroke={TIME_COLORS.d90} strokeWidth={1.4} dot={false} connectNulls isAnimationActive={false} />
                  <Line type="monotone" dataKey="d365" name="D-365" stroke={TIME_COLORS.d365} strokeWidth={1.4} dot={false} connectNulls isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={tab === "di" ? diChart : dapChart} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
                  <CartesianGrid stroke={GRID} strokeWidth={1} />
                  <XAxis
                    dataKey="t"
                    type="number"
                    scale="time"
                    domain={["dataMin", "dataMax"]}
                    tickFormatter={(t) => tsLabel(Number(t))}
                    tick={{ fontSize: 10, fill: TICKS }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: TICKS }}
                    width={44}
                    domain={["auto", "auto"]}
                    tickFormatter={(v) => `${Number(v).toFixed(1)}%`}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    labelFormatter={(t) => tsLabel(Number(t))}
                    formatter={(v, name) => [fmtRate(typeof v === "number" ? v : Number(v)), String(name)]}
                    contentStyle={tooltipStyle}
                    itemStyle={{ color: "#fff" }}
                    labelStyle={{ color: "#94A3B8", fontWeight: 600 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="agora" name="Agora (B3 ~15 min)" stroke={TIME_COLORS.agora} strokeWidth={2.2} dot={{ r: 2.5 }} connectNulls isAnimationActive={false} />
                  {(tab === "ipca" || show.d1) ? (
                    <Line type="monotone" dataKey="d1" name="Ajuste D-1" stroke={TIME_COLORS.d1} strokeWidth={1.6} strokeDasharray="5 3" dot={false} connectNulls isAnimationActive={false} />
                  ) : null}
                  {tab === "di" && show.d30 ? (
                    <Line type="monotone" dataKey="d30" name="D-30" stroke={TIME_COLORS.d30} strokeWidth={1.4} dot={false} connectNulls isAnimationActive={false} />
                  ) : null}
                  {tab === "di" && show.d90 ? (
                    <Line type="monotone" dataKey="d90" name="D-90" stroke={TIME_COLORS.d90} strokeWidth={1.4} dot={false} connectNulls isAnimationActive={false} />
                  ) : null}
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
          <p className="mt-2 text-[11px] text-zinc-500">
            {tab === "selic"
              ? "Selic implícita por reunião COPOM. “Agora” é calculada da curva DI ao vivo (forward entre reuniões, DU aproximado); cortes D-1/D-30/D-90 vêm do pipeline AZ (B3 PRE)."
              : tab === "treasury"
                ? "Curva Treasury EUA por prazo (FRED, D-1) — cortes históricos em tons progressivamente mais claros."
                : "Fonte: cotações públicas B3 (~15 min de atraso). Cortes históricos do pipeline AZ (TaxaSwap B3, D-1) em tons mais claros. D-7 e D-365 entram quando o pipeline ganhar esses cortes."}
          </p>
        </div>

        {showSideTable ? (
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
                    bps == null
                      ? "text-zinc-400"
                      : Math.abs(bps) < 1
                        ? "text-[#027DFC]"
                        : bps > 0
                          ? "text-[#16A34A]"
                          : "text-[#DC2626]";
                  const sign = bps == null ? "" : bps > 0 ? "+" : "";
                  return (
                    <tr key={c.symbol} className="tabular-nums">
                      <td className="py-1.5 pr-2 font-semibold text-[#132960]">
                        {maturityLabel(c.maturity)}
                        <span className="ml-1 hidden text-[10px] font-normal text-zinc-400 lg:inline">
                          {c.symbol}
                        </span>
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
              Δ dia vs ajuste D-1 · verde = taxa subiu, azul = estável, vermelho = caiu. Sem negócio no dia, usa
              mid bid/ask.
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
