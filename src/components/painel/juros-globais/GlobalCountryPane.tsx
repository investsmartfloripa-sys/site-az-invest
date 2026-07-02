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
import { Landmark, LineChart as LineChartIcon } from "lucide-react";

import { MethodInfo } from "@/components/painel/core/MethodInfo";
import { PanelTabs, type PanelTabItem } from "@/components/painel/panorama/PanelTabs";
import { PolicyStepChart } from "@/components/painel/juros-globais/PolicyStepChart";
import type { CountryRatesPayload, GlobalCountry } from "@/lib/global-rates";

const REFRESH_MS = 5 * 60_000; // curvas soberanas são diárias; futuros ~15 min (revalidados na rota)

const GRID = "#E2E8F0";
const TICKS = "#64748B";
const LIVE = "#000000";
const PAL = { d1: "#000000" } as const;

type PaneTab = "curve" | "policy";

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

function fmtRate(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${v.toFixed(2).replace(".", ",")}%`;
}
function tenorLabel(years: number): string {
  if (years <= 0) return "0";
  if (years < 1) return `${Math.round(years * 12)}m`;
  return `${years}a`;
}
/** Formata taxa do eixo com vírgula (padrão pt-BR). */
const axisPct = (v: number | string) => `${Number(v).toFixed(1).replace(".", ",")}%`;
function dateLabelBR(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y.slice(2)}`;
}

function paddedYDomain(values: (number | null | undefined)[]): [number, number] | undefined {
  let lo = Infinity;
  let hi = -Infinity;
  for (const v of values) {
    if (v != null && Number.isFinite(v)) {
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
  }
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return undefined;
  const range = hi - lo || 0.5;
  const pad = Math.max(0.05, range * 0.08);
  return [Math.floor((lo - pad) * 10) / 10, Math.ceil((hi + pad) * 10) / 10];
}

type CurveRow = { years: number; atual: number | null; d1: number | null; d30: number | null; d90: number | null };
/** Cortes históricos da curva (gradiente verde, igual à curva Treasury dos EUA). */
const CURVE_PAL = { d30: "#2BBF5E", d90: "#8BE28F" } as const;

export function GlobalCountryPane({ country }: { country: GlobalCountry }) {
  const [payload, setPayload] = useState<CountryRatesPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [tab, setTab] = useState<PaneTab>("curve");

  // O pane é remontado (key={country.id}) ao trocar de país, então o estado já
  // nasce limpo aqui — não precisamos (nem devemos) resetá-lo dentro do effect.
  useEffect(() => {
    const ctrl = new AbortController();
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(`/api/global-rates/${country.id}`, { cache: "no-store", signal: ctrl.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as CountryRatesPayload;
        if (cancelled) return;
        setPayload(json);
        setFailed(json.curve == null);
      } catch {
        if (!cancelled) setFailed(true);
      } finally {
        if (!cancelled) setLoading(false);
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
  }, [country.id]);

  const curve = payload?.curve ?? null;
  const policy = payload?.policy ?? null;
  const hasPolicy = !!policy && policy.rows.length > 0;

  const tabs: PanelTabItem<PaneTab>[] = useMemo(() => {
    const base: PanelTabItem<PaneTab>[] = [{ id: "curve", label: `Curva ${country.curveLabel}`, icon: LineChartIcon }];
    if (hasPolicy) base.push({ id: "policy", label: policy!.label, icon: Landmark });
    return base;
  }, [country.curveLabel, hasPolicy, policy]);

  const activeTab: PaneTab = tab === "policy" && !hasPolicy ? "curve" : tab;

  const curveRows = useMemo<CurveRow[]>(() => {
    if (!curve) return [];
    const map = new Map<number, CurveRow>();
    const ensure = (years: number): CurveRow => {
      let r = map.get(years);
      if (!r) {
        r = { years, atual: null, d1: null, d30: null, d90: null };
        map.set(years, r);
      }
      return r;
    };
    for (const p of curve.tenors) ensure(p.years).atual = p.rate;
    for (const p of curve.prevTenors ?? []) ensure(p.years).d1 = p.rate;
    for (const p of curve.d30Tenors ?? []) ensure(p.years).d30 = p.rate;
    for (const p of curve.d90Tenors ?? []) ensure(p.years).d90 = p.rate;
    return [...map.values()].sort((a, b) => a.years - b.years);
  }, [curve]);

  const curveYDomain = useMemo(
    () => paddedYDomain(curveRows.flatMap((r) => [r.atual, r.d1, r.d30, r.d90])),
    [curveRows],
  );
  // Domínio do eixo X: começa perto do 1º prazo (evita o vão vazio à esquerda de
  // curvas curtas como a do Reino Unido, que só publica 5/10/20 anos).
  const xDomain = useMemo<[number, number]>(() => {
    if (curveRows.length === 0) return [0, 30];
    const min = curveRows[0].years;
    const max = curveRows[curveRows.length - 1].years;
    return [min >= 4 ? Math.max(0, Math.floor(min) - 1) : 0, max];
  }, [curveRows]);

  return (
    <div aria-label={`Juros ${country.name}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 px-4 pb-2 pt-3 md:px-5">
        <PanelTabs ariaLabel={`Visão de juros ${country.name}`} tabs={tabs} value={activeTab} onChange={setTab} accent="#0B6B2E" />
        <span className="inline-flex items-center gap-1.5 text-[11px] text-zinc-500">
          {curve ? dateLabelBR(curve.asOf) : null}
          <MethodInfo align="right">
            Fonte: {curve ? curve.source : country.source}. Dados diários oficiais buscados ao
            vivo pelo servidor do site.
          </MethodInfo>
        </span>
      </div>

      {loading && !payload ? (
        <div className="flex h-[340px] items-center justify-center text-sm text-zinc-400">Carregando curva ao vivo…</div>
      ) : failed || !curve ? (
        <div className="flex h-[260px] items-center justify-center px-6 text-center text-sm text-zinc-500">
          Curva de {country.name} indisponível no momento — a fonte oficial ({country.source}) não respondeu. Atualiza
          automaticamente na próxima janela.
        </div>
      ) : activeTab === "policy" && hasPolicy ? (
        <div className="p-4 md:p-5">
          <PolicyStepChart rows={policy!.rows} meetings={policy!.meetings} labels={policy!.labels} note={policy!.note} />
        </div>
      ) : (
        <div className="grid gap-5 p-4 md:p-5 lg:grid-cols-[minmax(0,8fr)_minmax(0,4fr)]">
          <div className="min-w-0">
            <div className="h-[300px] w-full md:h-[340px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={curveRows} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
                  <CartesianGrid stroke={GRID} strokeWidth={1} />
                  <XAxis
                    dataKey="years"
                    type="number"
                    domain={xDomain}
                    tickFormatter={(v) => tenorLabel(Number(v))}
                    tick={{ fontSize: 10, fill: TICKS }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: TICKS }}
                    width={52}
                    domain={curveYDomain ?? ["auto", "auto"]}
                    tickFormatter={axisPct}
                    axisLine={false}
                    tickLine={false}
                    label={{ value: "Taxa (% a.a.)", angle: -90, position: "insideLeft", fontSize: 10, fill: TICKS }}
                  />
                  <Tooltip
                    labelFormatter={(v) => tenorLabel(Number(v))}
                    formatter={(v, name) => [fmtRate(typeof v === "number" ? v : Number(v)), String(name)]}
                    contentStyle={tooltipStyle}
                    itemStyle={{ color: "#fff" }}
                    labelStyle={{ color: "#94A3B8", fontWeight: 600 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {curve.d90Tenors && curve.d90Tenors.length > 0 ? (
                    <Line
                      type="monotone"
                      dataKey="d90"
                      name={`D-90${curve.d90AsOf ? ` (${dateLabelBR(curve.d90AsOf)})` : ""}`}
                      stroke={CURVE_PAL.d90}
                      strokeWidth={1.6}
                      dot={{ r: 2 }}
                      connectNulls
                      isAnimationActive={false}
                    />
                  ) : null}
                  {curve.d30Tenors && curve.d30Tenors.length > 0 ? (
                    <Line
                      type="monotone"
                      dataKey="d30"
                      name={`D-30${curve.d30AsOf ? ` (${dateLabelBR(curve.d30AsOf)})` : ""}`}
                      stroke={CURVE_PAL.d30}
                      strokeWidth={1.6}
                      dot={{ r: 2 }}
                      connectNulls
                      isAnimationActive={false}
                    />
                  ) : null}
                  {curve.prevTenors && curve.prevTenors.length > 0 ? (
                    <Line
                      type="monotone"
                      dataKey="d1"
                      name={`Ajuste D-1${curve.prevAsOf ? ` (${dateLabelBR(curve.prevAsOf)})` : ""}`}
                      stroke={PAL.d1}
                      strokeWidth={1.6}
                      strokeDasharray="6 4"
                      dot={false}
                      connectNulls
                      isAnimationActive={false}
                    />
                  ) : null}
                  <Line
                    type="monotone"
                    dataKey="atual"
                    name={`Agora (${dateLabelBR(curve.asOf)})`}
                    stroke={LIVE}
                    strokeWidth={2.4}
                    dot={{ r: 2.5 }}
                    connectNulls
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 flex justify-end">
              <MethodInfo align="right">
                {`Curva soberana de ${country.name} por prazo — yields nominais por maturidade. “Agora”: fechamento mais recente (${dateLabelBR(curve.asOf)}); “Ajuste D-1”: pregão anterior; “D-30”/“D-90”: a curva há ~30 e ~90 dias. Fonte: ${country.source}.`}
              </MethodInfo>
            </div>
          </div>

          <div className="min-w-0 overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="border-b border-zinc-200 text-[10px] uppercase tracking-wider text-zinc-500">
                  <th className="py-2 pr-2 text-left font-semibold">Prazo</th>
                  <th className={thClass}>D-90</th>
                  <th className={thClass}>D-30</th>
                  <th className={thClass}>D-1</th>
                  <th className={thClass}>Agora</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {curveRows.map((r) => (
                  <tr key={r.years}>
                    <td className="py-1.5 pr-2 font-semibold text-[#132960]">{tenorLabel(r.years)}</td>
                    <td className={`${tdClass} text-zinc-400`}>{fmtRate(r.d90)}</td>
                    <td className={`${tdClass} text-zinc-500`}>{fmtRate(r.d30)}</td>
                    <td className={`${tdClass} text-zinc-500`}>{fmtRate(r.d1)}</td>
                    <td className={`${tdClass} font-semibold text-[#000000]`}>{fmtRate(r.atual)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
