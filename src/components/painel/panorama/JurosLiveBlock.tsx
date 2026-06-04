"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
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
 * Paletas POR GRAFICO — exatamente as dos scripts R do pipeline
 * (build_yield_curves_svg.R, build_selic_implicita.R, build_treasury_us_svg.R).
 * A serie "ao vivo" (DI/DAP, que nao existia nos SVGs) usa o azul AZ #027DFC.
 */
const LIVE_COLOR = "#027DFC";

const PAL_PRE = { recent: "#000000", d30: "#00008B", d90: "#56B4E9" } as const;
const PAL_IPCA = { recent: "#000000", d30: "#8B0000", d90: "#F8766D" } as const;
const PAL_SELIC = { recent: "#000000", d30: "#2E74C9", d90: "#56B4E9", meeting: "#ff5713", meetingLabel: "#0078fd" } as const;
const PAL_TREASURY = { recent: "#000000", d30: "#0B6B2E", d90: "#2BBF5E", d365: "#8BE28F" } as const;

const GRID = "#E2E8F0";
const TICKS = "#64748B";

type TabId = "pre" | "ipca" | "selic" | "treasury";

const TABS: { id: TabId; label: string }[] = [
  { id: "pre", label: "Curva pré" },
  { id: "ipca", label: "Curva IPCA+" },
  { id: "selic", label: "Selic implícita" },
  { id: "treasury", label: "Treasury EUA" },
];

export type CurveCut = { maturity: string; rate: number };

/** Cortes da curva de titulos do pipeline (TaxaSwap, D-1). */
export type CurveCutSet = {
  recent?: CurveCut[];
  d30?: CurveCut[];
  d90?: CurveCut[];
};

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

/** Rotulos com data de referencia de cada corte (keys das colunas do JSON). */
export type CutLabels = {
  recent?: string;
  d30?: string;
  d90?: string;
  d365?: string;
};

type Props = {
  /** Curvas dos titulos prefixados (pipeline) p/ exibir junto do DI live. */
  preCuts?: CurveCutSet;
  /** Curvas IPCA+ dos titulos (pipeline) p/ exibir junto do DAP live. */
  ipcaCuts?: CurveCutSet;
  /** Selic implicita por reuniao COPOM — cortes do pipeline R (modelo oficial). */
  selicMeetings?: SelicMeeting[];
  /** Curva Treasury por tenor (cortes do pipeline FRED). */
  treasuryTenors?: TreasuryTenor[];
  /** Datas de referencia p/ legenda (ex.: "D-30 (05/05/2026)"), por tab. */
  preLabels?: CutLabels;
  ipcaLabels?: CutLabels;
  selicLabels?: CutLabels;
  treasuryLabels?: CutLabels;
};

type ChartPoint = {
  t: number;
  agora?: number | null;
  d1?: number | null;
  recent?: number | null;
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

type ShowState = { agora: boolean; d1: boolean; recent: boolean; d30: boolean; d90: boolean };

/** Janela [min,max] de vencimentos da base de titulos (TaxaSwap). */
function cutBounds(cuts: CurveCutSet): { min: number; max: number } | null {
  let min = Infinity;
  let max = -Infinity;
  for (const serie of [cuts.recent, cuts.d30, cuts.d90]) {
    for (const c of serie ?? []) {
      const t = Date.parse(c.maturity);
      if (!Number.isFinite(t)) continue;
      if (t < min) min = t;
      if (t > max) max = t;
    }
  }
  return Number.isFinite(min) && Number.isFinite(max) ? { min, max } : null;
}

/**
 * Monta os pontos do chart: live (DI/DAP) e cortes do pipeline cada um em
 * seus proprios vencimentos (sem interpolacao — fidelidade aos graficos R).
 * O live e LIMITADO a janela de vencimentos da base de titulos, pra nao
 * esticar o eixo com contratos muito alem da curva original.
 */
function buildCurveChart(
  live: LiveContract[],
  cuts: CurveCutSet,
  show: ShowState,
): { points: ChartPoint[]; yDomain: [number, number] } {
  const bounds = cutBounds(cuts);
  // Folga de ~45 dias nas pontas pra nao cortar o contrato vizinho do 1o/ultimo titulo.
  const SLACK = 45 * 86_400_000;
  const byT = new Map<number, ChartPoint>();
  const at = (t: number): ChartPoint => {
    const prev = byT.get(t) ?? { t };
    byT.set(t, prev);
    return prev;
  };

  let lo = Infinity;
  let hi = -Infinity;
  const see = (v: number | null | undefined) => {
    if (v != null && Number.isFinite(v)) {
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
  };

  if (show.agora) {
    for (const c of live) {
      if (c.rate == null) continue;
      const t = Date.parse(c.maturity);
      if (!Number.isFinite(t)) continue;
      if (bounds && (t < bounds.min - SLACK || t > bounds.max + SLACK)) continue;
      const p = at(t);
      p.agora = c.rate;
      see(c.rate);
      if (show.d1) {
        p.d1 = c.prevAdjust;
        see(c.prevAdjust);
      }
    }
  }

  const addCut = (key: "recent" | "d30" | "d90", cut?: CurveCut[]) => {
    for (const c of cut ?? []) {
      const t = Date.parse(c.maturity);
      if (!Number.isFinite(t)) continue;
      at(t)[key] = c.rate;
      see(c.rate);
    }
  };
  if (show.recent) addCut("recent", cuts.recent);
  if (show.d30) addCut("d30", cuts.d30);
  if (show.d90) addCut("d90", cuts.d90);

  const points = [...byT.values()].sort((a, b) => a.t - b.t);
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return { points, yDomain: [0, 1] };
  const pad = Math.max(0.08, (hi - lo) * 0.08);
  return { points, yDomain: [Math.floor((lo - pad) * 10) / 10, Math.ceil((hi + pad) * 10) / 10] };
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

/** True em telas estreitas (mobile) — p/ alternar labels das reunioes. */
function useIsNarrow(): boolean {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    const update = () => setNarrow(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return narrow;
}

export function JurosLiveBlock({
  preCuts = {},
  ipcaCuts = {},
  selicMeetings = [],
  treasuryTenors = [],
  preLabels = {},
  ipcaLabels = {},
  selicLabels = {},
  treasuryLabels = {},
}: Props) {
  const isNarrow = useIsNarrow();
  const [tab, setTab] = useState<TabId>("pre");
  const [showAll, setShowAll] = useState(false);
  // Todas as series ligadas por default — quem quiser enxugar, desliga.
  const [show, setShow] = useState<ShowState>({ agora: true, d1: true, recent: true, d30: true, d90: true });
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

  const preChart = useMemo(() => buildCurveChart(diLiquid, preCuts, show), [diLiquid, preCuts, show]);
  const ipcaChart = useMemo(() => buildCurveChart(dapLiquid, ipcaCuts, show), [dapLiquid, ipcaCuts, show]);

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

  // Tabela das tabs de curva: UNIAO dos vencimentos — linhas dos titulos
  // (D-90/D-30/Recente) + vencimentos do live sem titulo correspondente.
  // Live casa com a linha do titulo quando os vencimentos distam <= 25 dias.
  const isCurve = tab === "pre" || tab === "ipca";
  const activeCuts = tab === "ipca" ? ipcaCuts : preCuts;
  const curveRows = useMemo(() => {
    if (!isCurve) return [];
    type CurveRow = {
      t: number;
      maturity: string;
      d90: number | null;
      d30: number | null;
      recent: number | null;
      agora: number | null;
    };
    const map = new Map<number, CurveRow>();
    const upsert = (t: number, maturity: string): CurveRow => {
      let r = map.get(t);
      if (!r) {
        r = { t, maturity, d90: null, d30: null, recent: null, agora: null };
        map.set(t, r);
      }
      return r;
    };
    const put = (key: "d90" | "d30" | "recent", cut?: CurveCut[]) => {
      for (const c of cut ?? []) {
        const t = Date.parse(c.maturity);
        if (!Number.isFinite(t)) continue;
        upsert(t, c.maturity)[key] = c.rate;
      }
    };
    put("d90", activeCuts.d90);
    put("d30", activeCuts.d30);
    put("recent", activeCuts.recent);

    const MAX_GAP = 25 * 86_400_000;
    const liveArr = tab === "ipca" ? dapLiquid : diLiquid;
    for (const lc of liveArr) {
      if (lc.rate == null) continue;
      const t = Date.parse(lc.maturity);
      if (!Number.isFinite(t)) continue;
      let best: CurveRow | null = null;
      let bestGap = Infinity;
      for (const r of map.values()) {
        const gap = Math.abs(r.t - t);
        if (gap < bestGap) {
          bestGap = gap;
          best = r;
        }
      }
      if (best && bestGap <= MAX_GAP) {
        best.agora = lc.rate;
      } else {
        upsert(t, lc.maturity).agora = lc.rate;
      }
    }
    return [...map.values()].sort((a, b) => a.t - b.t);
  }, [isCurve, activeCuts, diLiquid, dapLiquid, tab]);

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

  const isCurveTab = tab === "pre" || tab === "ipca";
  const pal = tab === "ipca" ? PAL_IPCA : PAL_PRE;
  const labels = tab === "ipca" ? ipcaLabels : preLabels;
  const cuts = tab === "ipca" ? ipcaCuts : preCuts;

  const cutToggles: { key: keyof ShowState; label: string; color: string; available: boolean }[] = [
    { key: "agora", label: "Agora", color: LIVE_COLOR, available: true },
    { key: "d1", label: "Ajuste D-1", color: "#9CA3AF", available: true },
    { key: "recent", label: "Recente", color: pal.recent, available: (cuts.recent?.length ?? 0) > 0 },
    { key: "d30", label: "D-30", color: pal.d30, available: (cuts.d30?.length ?? 0) > 0 },
    { key: "d90", label: "D-90", color: pal.d90, available: (cuts.d90?.length ?? 0) > 0 },
  ];

  const liveName = tab === "ipca" ? "DAP · agora (B3 ~15 min)" : "DI futuro · agora (B3 ~15 min)";
  const chart = tab === "ipca" ? ipcaChart : preChart;

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
          {isCurveTab ? (
            <>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                  Séries:
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
                <LineChart data={selicChart} margin={{ top: 18, right: 16, bottom: 4, left: 0 }}>
                  <CartesianGrid stroke={GRID} strokeWidth={1} />
                  {selicMeetings.map((m, idx) => {
                    const t = Date.parse(m.date);
                    if (!Number.isFinite(t)) return null;
                    // No celular, mostra data em reunioes alternadas pra nao amontoar.
                    const showLabel = !isNarrow || idx % 2 === 0;
                    return (
                      <ReferenceLine
                        key={m.date}
                        x={t}
                        stroke={PAL_SELIC.meeting}
                        strokeDasharray="4 4"
                        strokeWidth={1.2}
                        label={
                          showLabel
                            ? {
                                value: dateLabelBR(m.date).slice(0, 5),
                                position: "top",
                                fontSize: isNarrow ? 8 : 9,
                                fontWeight: 700,
                                fill: "#000000",
                              }
                            : undefined
                        }
                      />
                    );
                  })}
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
                    width={52}
                    domain={["auto", "auto"]}
                    tickFormatter={(v) => `${Number(v).toFixed(1)}%`}
                    axisLine={false}
                    tickLine={false}
                    label={{ value: "Taxa (% a.a.)", angle: -90, position: "insideLeft", fontSize: 10, fill: TICKS }}
                  />
                  <Tooltip
                    labelFormatter={(t) => `Reunião ${dateLabelBR(new Date(Number(t)).toISOString().slice(0, 10))}`}
                    formatter={(v, name) => [fmtRate(typeof v === "number" ? v : Number(v)), String(name)]}
                    contentStyle={tooltipStyle}
                    itemStyle={{ color: "#fff" }}
                    labelStyle={{ color: "#94A3B8", fontWeight: 600 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line type="stepAfter" dataKey="d90" name={selicLabels.d90 ?? "D-90"} stroke={PAL_SELIC.d90} strokeWidth={1.6} dot={{ r: 2 }} connectNulls isAnimationActive={false} />
                  <Line type="stepAfter" dataKey="d30" name={selicLabels.d30 ?? "D-30"} stroke={PAL_SELIC.d30} strokeWidth={1.6} dot={{ r: 2 }} connectNulls isAnimationActive={false} />
                  <Line type="stepAfter" dataKey="recent" name={selicLabels.recent ?? "Recente (D-1)"} stroke={PAL_SELIC.recent} strokeWidth={2.2} dot={{ r: 2.5 }} connectNulls isAnimationActive={false} />
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
                    width={52}
                    domain={["auto", "auto"]}
                    tickFormatter={(v) => `${Number(v).toFixed(1)}%`}
                    axisLine={false}
                    tickLine={false}
                    label={{ value: "Taxa (% a.a.)", angle: -90, position: "insideLeft", fontSize: 10, fill: TICKS }}
                  />
                  <Tooltip
                    labelFormatter={(t) => `${t} ano${Number(t) > 1 ? "s" : ""}`}
                    formatter={(v, name) => [fmtRate(typeof v === "number" ? v : Number(v)), String(name)]}
                    contentStyle={tooltipStyle}
                    itemStyle={{ color: "#fff" }}
                    labelStyle={{ color: "#94A3B8", fontWeight: 600 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="d365" name={treasuryLabels.d365 ?? "D-365"} stroke={PAL_TREASURY.d365} strokeWidth={1.5} dot={{ r: 2 }} connectNulls isAnimationActive={false} />
                  <Line type="monotone" dataKey="d90" name={treasuryLabels.d90 ?? "D-90"} stroke={PAL_TREASURY.d90} strokeWidth={1.6} dot={{ r: 2 }} connectNulls isAnimationActive={false} />
                  <Line type="monotone" dataKey="d30" name={treasuryLabels.d30 ?? "D-30"} stroke={PAL_TREASURY.d30} strokeWidth={1.6} dot={{ r: 2 }} connectNulls isAnimationActive={false} />
                  <Line type="monotone" dataKey="recent" name={treasuryLabels.recent ?? "Recente (D-1)"} stroke={PAL_TREASURY.recent} strokeWidth={2.2} dot={{ r: 2.5 }} connectNulls isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chart.points} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
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
                    width={52}
                    domain={chart.yDomain}
                    tickFormatter={(v) => `${Number(v).toFixed(1)}%`}
                    axisLine={false}
                    tickLine={false}
                    label={{ value: "Taxa (% a.a.)", angle: -90, position: "insideLeft", fontSize: 10, fill: TICKS }}
                  />
                  <Tooltip
                    labelFormatter={(t) => tsLabel(Number(t))}
                    formatter={(v, name) => [fmtRate(typeof v === "number" ? v : Number(v)), String(name)]}
                    contentStyle={tooltipStyle}
                    itemStyle={{ color: "#fff" }}
                    labelStyle={{ color: "#94A3B8", fontWeight: 600 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {show.d90 ? (
                    <Line type="monotone" dataKey="d90" name={labels.d90 ?? "D-90"} stroke={pal.d90} strokeWidth={1.6} dot={{ r: 2 }} connectNulls isAnimationActive={false} />
                  ) : null}
                  {show.d30 ? (
                    <Line type="monotone" dataKey="d30" name={labels.d30 ?? "D-30"} stroke={pal.d30} strokeWidth={1.6} dot={{ r: 2 }} connectNulls isAnimationActive={false} />
                  ) : null}
                  {show.recent ? (
                    <Line type="monotone" dataKey="recent" name={labels.recent ?? "Recente (D-1)"} stroke={pal.recent} strokeWidth={2.2} dot={{ r: 2.5 }} connectNulls isAnimationActive={false} />
                  ) : null}
                  {show.agora && show.d1 ? (
                    <Line type="monotone" dataKey="d1" name="Ajuste D-1 (B3)" stroke="#9CA3AF" strokeWidth={1.4} strokeDasharray="5 3" dot={false} connectNulls isAnimationActive={false} />
                  ) : null}
                  {show.agora ? (
                    <Line type="monotone" dataKey="agora" name={liveName} stroke={LIVE_COLOR} strokeWidth={2} dot={{ r: 2.5 }} connectNulls isAnimationActive={false} />
                  ) : null}
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
          <p className="mt-2 text-[11px] text-zinc-500">
            {tab === "selic"
              ? "Selic implícita por reunião COPOM — modelo forward do pipeline AZ (B3 PRE, D-1), mesmos valores da trilha de política monetária."
              : tab === "treasury"
                ? "Curva Treasury EUA por prazo (FRED, D-1) — mesma paleta do gráfico original."
                : tab === "ipca"
                  ? "Recente/D-30/D-90: títulos IPCA+ (cupom limpo NTN-B, TaxaSwap B3, D-1) — as mesmas curvas do gráfico original. “Agora”: futuros DAP da B3 (~15 min), instrumento irmão do cupom de IPCA."
                  : "Recente/D-30/D-90: títulos prefixados (TaxaSwap B3, D-1) — as mesmas curvas do gráfico original. “Agora”: futuros DI1 da B3 (~15 min), instrumento irmão do prefixado."}
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
                    <th className={thClass}>D-90</th>
                    <th className={thClass}>D-30</th>
                    <th className={thClass}>Recente</th>
                    <th className={thClass}>Agora</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {curveRows.map((r) => (
                    <tr key={r.maturity}>
                      <td className="py-1.5 pr-2 font-semibold text-[#132960]">{maturityLabel(r.maturity)}</td>
                      <td className={`${tdClass} text-zinc-400`}>{fmtRate(r.d90)}</td>
                      <td className={`${tdClass} text-zinc-500`}>{fmtRate(r.d30)}</td>
                      <td className={`${tdClass} font-semibold text-[#132960]`}>{fmtRate(r.recent)}</td>
                      <td className={`${tdClass} font-semibold text-[#027DFC]`}>{fmtRate(r.agora)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-2 text-[11px] text-zinc-400">
                D-90/D-30/Recente: títulos (TaxaSwap B3, D-1). Agora: futuro {tab === "ipca" ? "DAP" : "DI1"} de
                vencimento mais próximo (B3 ~15 min).
              </p>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
