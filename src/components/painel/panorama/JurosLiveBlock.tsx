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
  /** Selic implicita por reuniao COPOM — cortes do pipeline R (modelo oficial). */
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

/**
 * Interpola (linear no tempo) um corte historico nos timestamps da curva
 * live, sem extrapolar alem do range do corte — assim todas as series
 * compartilham os mesmos pontos de X e o eixo Y enquadra tudo.
 */
function cutValueAt(cut: CurveCut[], t: number): number | null {
  if (cut.length === 0) return null;
  const pts = cut
    .map((c) => ({ t: Date.parse(c.maturity), r: c.rate }))
    .filter((p) => Number.isFinite(p.t))
    .sort((a, b) => a.t - b.t);
  if (pts.length === 0 || t < pts[0].t || t > pts[pts.length - 1].t) return null;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    if (t >= a.t && t <= b.t) {
      if (b.t === a.t) return a.r;
      const w = (t - a.t) / (b.t - a.t);
      return a.r + w * (b.r - a.r);
    }
  }
  return null;
}

function buildCurveChart(
  live: LiveContract[],
  cuts: { d30?: CurveCut[]; d90?: CurveCut[] },
  show: { d1: boolean; d30: boolean; d90: boolean },
): ChartPoint[] {
  const out: ChartPoint[] = [];
  for (const c of live) {
    if (c.rate == null) continue;
    const t = Date.parse(c.maturity);
    if (!Number.isFinite(t)) continue;
    const p: ChartPoint = { t, agora: c.rate };
    if (show.d1) p.d1 = c.prevAdjust;
    if (show.d30 && cuts.d30) p.d30 = cutValueAt(cuts.d30, t);
    if (show.d90 && cuts.d90) p.d90 = cutValueAt(cuts.d90, t);
    out.push(p);
  }
  return out.sort((a, b) => a.t - b.t);
}

const tooltipStyle = {
  background: "#132960",
  border: "none",
  borderRadius: 8,
  color: "#fff",
  fontSize: 12,
  boxShadow: "0 4px 12px rgba(19,41,96,.25)",
} as const;

const thClass = "py-2 pr-2 text-right font-semibold";
const tdClass = "py-1.5 pr-2 text-right tabular-nums";

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

  const selicChart = useMemo(
    () =>
      selicMeetings.map((m) => ({
        t: Date.parse(m.date),
        recent: m.recent,
        d30: m.d30,
        d90: m.d90,
      })),
    [selicMeetings],
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
                          ? "border-transparent bg-[#eef2f8] text-[#132960]"
                          : "border-zinc-200 bg-white text-zinc-400 hover:text-[#132960]"
                      }`}
                    >
                      <span
                        aria-hidden
                        className="inline-block h-2 w-2 rounded-full transition-opacity duration-150"
                        style={{ backgroundColor: c.color, opacity: show[c.key] ? 1 : 0.3 }}
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

      <div className="grid gap-5 p-4 md:p-5 lg:grid-cols-[minmax(0,8fr)_minmax(0,4fr)]">
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
                    labelFormatter={(t) => `Reunião ${dateLabelBR(new Date(Number(t)).toISOString().slice(0, 10))}`}
                    formatter={(v, name) => [fmtRate(typeof v === "number" ? v : Number(v)), String(name)]}
                    contentStyle={tooltipStyle}
                    itemStyle={{ color: "#fff" }}
                    labelStyle={{ color: "#94A3B8", fontWeight: 600 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line type="stepAfter" dataKey="recent" name="Recente (D-1)" stroke={TIME_COLORS.agora} strokeWidth={2.2} dot={{ r: 2.5 }} connectNulls isAnimationActive={false} />
                  <Line type="stepAfter" dataKey="d30" name="D-30" stroke={TIME_COLORS.d30} strokeWidth={1.5} dot={false} connectNulls isAnimationActive={false} />
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
                    <Line type="monotone" dataKey="d30" name="D-30" stroke={TIME_COLORS.d30} strokeWidth={1.5} dot={false} connectNulls isAnimationActive={false} />
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
              ? "Selic implícita por reunião COPOM — modelo forward do pipeline AZ (B3 PRE, D-1), mesmos valores da trilha de política monetária. Cortes D-30/D-90 em tons mais claros."
              : tab === "treasury"
                ? "Curva Treasury EUA por prazo (FRED, D-1) — cortes históricos em tons progressivamente mais claros."
                : "Fonte: cotações públicas B3 (~15 min de atraso). Cortes D-30/D-90 do pipeline AZ (TaxaSwap B3, D-1) interpolados nos vencimentos. D-7 e D-365 entram quando o pipeline ganhar esses cortes."}
          </p>
        </div>

        <div className="min-w-0 overflow-x-auto">
          {tab === "selic" ? (
            <table className="min-w-full text-xs">
              <thead>
                <tr className="border-b border-zinc-200 text-[10px] uppercase tracking-wider text-zinc-500">
                  <th className="py-2 pr-2 text-left font-semibold">Reunião</th>
                  <th className={thClass}>D-90</th>
                  <th className={thClass}>D-30</th>
                  <th className={thClass}>Recente</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {selicMeetings.map((m) => (
                  <tr key={m.date}>
                    <td className="py-1.5 pr-2 font-semibold text-[#132960]">{dateLabelBR(m.date)}</td>
                    <td className={`${tdClass} text-zinc-400`}>{fmtRate(m.d90)}</td>
                    <td className={`${tdClass} text-zinc-500`}>{fmtRate(m.d30)}</td>
                    <td className={`${tdClass} font-semibold text-[#132960]`}>{fmtRate(m.recent)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : tab === "treasury" ? (
            <table className="min-w-full text-xs">
              <thead>
                <tr className="border-b border-zinc-200 text-[10px] uppercase tracking-wider text-zinc-500">
                  <th className="py-2 pr-2 text-left font-semibold">Prazo</th>
                  <th className={thClass}>D-365</th>
                  <th className={thClass}>D-90</th>
                  <th className={thClass}>D-30</th>
                  <th className={thClass}>Recente</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {treasuryTenors.map((t) => (
                  <tr key={t.tenor}>
                    <td className="py-1.5 pr-2 font-semibold text-[#132960]">{t.tenor}a</td>
                    <td className={`${tdClass} text-zinc-300`}>{fmtRate(t.d365)}</td>
                    <td className={`${tdClass} text-zinc-400`}>{fmtRate(t.d90)}</td>
                    <td className={`${tdClass} text-zinc-500`}>{fmtRate(t.d30)}</td>
                    <td className={`${tdClass} font-semibold text-[#132960]`}>{fmtRate(t.recent)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <>
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="border-b border-zinc-200 text-[10px] uppercase tracking-wider text-zinc-500">
                    <th className="py-2 pr-2 text-left font-semibold">Venc.</th>
                    <th className={thClass}>Agora</th>
                    <th className={thClass}>Δ dia</th>
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
                      <tr key={c.symbol}>
                        <td className="py-1.5 pr-2 font-semibold text-[#132960]">
                          {maturityLabel(c.maturity)}
                          <span className="ml-1 hidden text-[10px] font-normal text-zinc-400 xl:inline">
                            {c.symbol}
                          </span>
                        </td>
                        <td className={`${tdClass} font-semibold text-[#132960]`}>{fmtRate(c.rate)}</td>
                        <td className={`${tdClass} font-semibold ${tone}`}>
                          {bps == null ? "—" : `${sign}${bps} bps`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="mt-2 text-[11px] text-zinc-400">
                Δ dia vs ajuste D-1 · verde = subiu, azul = estável, vermelho = caiu.
              </p>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
