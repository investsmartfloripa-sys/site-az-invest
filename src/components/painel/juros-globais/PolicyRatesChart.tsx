"use client";

import { useEffect, useMemo, useRef, useState, type RefObject } from "react";

import {
  AzPeriodSelector,
  AzTimeSeriesChart,
  resolvePeriodRange,
  type AzPeriodValue,
  type AzTimeSeries,
} from "@/components/painel/charts";
import { CockpitChip } from "@/components/painel/core/CockpitChip";
import { MethodInfo } from "@/components/painel/core/MethodInfo";
import { AZ_CHART } from "@/lib/az-chart-theme";
import {
  addDaysUTC,
  addMonthsUTC,
  diffDaysUTC,
  fmtDataBR,
  fmtMesCurto,
  fmtMesLongo,
  fmtNum,
  fmtSignedNum,
} from "@/lib/format-br";
import {
  PAUSE_AFTER_DAYS,
  POLICY_CYCLE_START,
  POLICY_RATE_COUNTRIES,
  policyCountry,
  policyStats,
  type PolicyRateCountryId,
  type PolicyRateSeries,
  type PolicyRatesPayload,
  type PolicyStats,
  type PolicyStep,
} from "@/lib/policy-rates";

const DEFAULT_IDS: PolicyRateCountryId[] = POLICY_RATE_COUNTRIES.filter((c) => c.defaultOn).map((c) => c.id);
const ORDER: PolicyRateCountryId[] = POLICY_RATE_COUNTRIES.map((c) => c.id);

/** Janela padrão: o ciclo pós-pandemia (jan/2021 → último dado). */
const DEFAULT_PERIOD: AzPeriodValue = { id: "custom", from: POLICY_CYCLE_START };

/** Série com dado mais velho que a mediana por mais que isto ganha aviso. */
const STALE_GAP_DAYS = 14;

/**
 * Datas-âncora do calendário na janela (semanal até ~3 anos, mensal acima):
 * dão ao tooltip um ponto em qualquer altura do gráfico — só com os degraus o
 * hover pularia de decisão em decisão.
 */
function calendarGrid(from: string, to: string): string[] {
  const out: string[] = [];
  if (diffDaysUTC(from, to) <= 1100) {
    for (let d = from; d <= to; d = addDaysUTC(d, 7)) out.push(d);
    return out;
  }
  let d = `${from.slice(0, 7)}-01`;
  if (d < from) d = addMonthsUTC(d, 1);
  for (; d <= to; d = addMonthsUTC(d, 1)) out.push(d);
  return out;
}

/**
 * Recorta os degraus na janela [from, to]: abre com a taxa EM VIGOR no início
 * (senão a linha só apareceria na 1ª decisão dentro da janela), inclui cada
 * mudança e fecha no último dado publicado (ou no fim da janela).
 */
function windowSteps(steps: PolicyStep[], asOf: string, from: string, to: string, grid: string[]): [string, number][] {
  if (steps.length === 0) return [];
  const start = steps[0][0] > from ? steps[0][0] : from;
  const end = asOf < to ? asOf : to;
  if (end < start) return [];
  const dates = new Set<string>([start, end]);
  for (const [d] of steps) if (d > start && d <= end) dates.add(d);
  for (const g of grid) if (g > start && g < end) dates.add(g);
  const out: [string, number][] = [];
  let j = 0;
  let cur: number | null = null;
  for (const d of [...dates].sort()) {
    while (j < steps.length && steps[j][0] <= d) {
      cur = steps[j][1];
      j++;
    }
    if (cur != null) out.push([d, cur]);
  }
  return out;
}

function median(isos: string[]): string | null {
  if (isos.length === 0) return null;
  const s = [...isos].sort();
  return s[Math.floor((s.length - 1) / 2)];
}

function fmtRate(v: number): string {
  return `${fmtNum(v, 2)}%`;
}

function fmtPP(v: number): string {
  return `${fmtSignedNum(v, 2)} p.p.`;
}

function fmtDataCurta(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(2, 4)}`;
}

const STATUS_LABEL: Record<PolicyStats["status"], string> = {
  subindo: "Subindo",
  cortando: "Cortando",
  pausa: "Pausa",
};

const STATUS_COLOR: Record<PolicyStats["status"], string> = {
  subindo: AZ_CHART.pos,
  cortando: AZ_CHART.neg,
  pausa: AZ_CHART.neutral,
};

/** Taxa com as casas necessárias (3,875 do ponto médio do Fed não vira 3,88). */
function fmtRateExact(v: number): string {
  const dec = Math.round(v * 1000) % 10 !== 0 ? 3 : 2;
  return `${fmtNum(v, dec)}%`;
}

/** Banda (EUA) ou taxa simples. */
function fmtRateBand(v: number, band?: number): string {
  return band ? `${fmtNum(v - band / 2, 2)}–${fmtNum(v + band / 2, 2)}%` : fmtRate(v);
}

const CHART_H = 420;

/** Largura da coluna de rótulos à direita do gráfico. */
const END_LABEL_W = 56;
/** Distância mínima (px) entre dois rótulos empilhados. */
const END_LABEL_GAP = 13;

type EndLabel = { id: string; y: number; color: string; text: string };

/**
 * Rótulos do VALOR ATUAL no fim de cada linha, numa coluna à direita do
 * gráfico. A posição vem das bolinhas de fim de série que o AzTimeSeriesChart
 * já desenha (seriesEndLabels) — mede o DOM em vez de refazer a escala Y do
 * Recharts — e rótulos próximos são empurrados p/ não se sobreporem.
 */
function useEndLabels(
  hostRef: RefObject<HTMLDivElement | null>,
  series: AzTimeSeries[],
  height: number,
): EndLabel[] {
  const [labels, setLabels] = useState<EndLabel[]>([]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const byColor = new Map<string, AzTimeSeries>();
    for (const s of series) if (s.color) byColor.set(s.color.toLowerCase(), s);

    // setTimeout (não requestAnimationFrame): rAF fica pausado em aba oculta e
    // os rótulos não apareceriam se os dados chegassem com a aba em 2º plano.
    let timer: ReturnType<typeof setTimeout> | null = null;
    const measure = () => {
      timer = null;
      const hostTop = host.getBoundingClientRect().top;
      const raw: EndLabel[] = [];
      host.querySelectorAll<SVGCircleElement>(".recharts-reference-dot circle").forEach((c) => {
        const s = byColor.get((c.getAttribute("fill") ?? "").toLowerCase());
        if (!s) return;
        const last = s.data[s.data.length - 1];
        const r = c.getBoundingClientRect();
        if (!last || r.height === 0) return;
        raw.push({ id: s.id, y: r.top + r.height / 2 - hostTop, color: s.color!, text: fmtRateExact(last[1]) });
      });
      raw.sort((a, b) => a.y - b.y);
      // Empilha de cima p/ baixo; se estourar o fundo, sobe o bloco.
      for (let i = 1; i < raw.length; i++) raw[i].y = Math.max(raw[i].y, raw[i - 1].y + END_LABEL_GAP);
      const overflow = raw.length ? raw[raw.length - 1].y - (height - 6) : 0;
      if (overflow > 0) {
        raw[raw.length - 1].y -= overflow;
        for (let i = raw.length - 2; i >= 0; i--) raw[i].y = Math.min(raw[i].y, raw[i + 1].y - END_LABEL_GAP);
      }
      setLabels((prev) => {
        const same =
          prev.length === raw.length &&
          prev.every((p, i) => p.id === raw[i].id && Math.abs(p.y - raw[i].y) < 0.5 && p.text === raw[i].text);
        return same ? prev : raw;
      });
    };
    const schedule = () => {
      if (!timer) timer = setTimeout(measure, 30);
    };
    schedule();
    const mo = new MutationObserver(schedule);
    mo.observe(host, { subtree: true, childList: true, attributes: true, attributeFilter: ["cx", "cy"] });
    const ro = new ResizeObserver(schedule);
    ro.observe(host);
    return () => {
      if (timer) clearTimeout(timer);
      mo.disconnect();
      ro.disconnect();
    };
  }, [hostRef, series, height]);

  return labels;
}

function Flag({ code, name }: { code: string; name: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://flagcdn.com/w40/${code}.png`}
      alt={`Bandeira ${name}`}
      width={22}
      height={16}
      className="h-4 w-[22px] shrink-0 rounded-[3px] object-cover shadow-sm"
    />
  );
}

export function PolicyRatesChart() {
  const [resp, setResp] = useState<PolicyRatesPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [selected, setSelected] = useState<PolicyRateCountryId[]>(DEFAULT_IDS);
  const [period, setPeriod] = useState<AzPeriodValue>(DEFAULT_PERIOD);

  useEffect(() => {
    const ctrl = new AbortController();
    (async () => {
      try {
        const res = await fetch("/api/global-rates/policy-rates", { signal: ctrl.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as PolicyRatesPayload;
        if (json.series.length === 0) throw new Error("vazio");
        setResp(json);
      } catch {
        if (!ctrl.signal.aborted) setFailed(true);
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    })();
    return () => ctrl.abort();
  }, []);

  const byId = useMemo(() => {
    const m = new Map<PolicyRateCountryId, PolicyRateSeries>();
    for (const s of resp?.series ?? []) m.set(s.id, s);
    return m;
  }, [resp]);

  const active = useMemo(() => selected.filter((id) => byId.has(id)), [selected, byId]);

  // Range disponível dos países ativos (limita o seletor e o "Máx").
  const range = useMemo(() => {
    let min = "";
    let max = "";
    for (const id of active) {
      const s = byId.get(id)!;
      const f = s.steps[0]?.[0];
      if (f && (!min || f < min)) min = f;
      if (!max || s.asOf > max) max = s.asOf;
    }
    return { min: min || POLICY_CYCLE_START, max: max || new Date().toISOString().slice(0, 10) };
  }, [active, byId]);

  const win = useMemo(() => resolvePeriodRange(period, range.min, range.max), [period, range]);

  const series = useMemo<AzTimeSeries[]>(() => {
    const grid = calendarGrid(win.from, win.to);
    const out: AzTimeSeries[] = [];
    for (const id of active) {
      const s = byId.get(id)!;
      const data = windowSteps(s.steps, s.asOf, win.from, win.to, grid);
      if (data.length === 0) continue;
      const c = policyCountry(id);
      out.push({ id, label: c.name, color: c.color, type: "stepAfter", data });
    }
    return out;
  }, [active, byId, win]);

  // Tabela: mesmos países do gráfico, do juro mais alto ao mais baixo.
  const rows = useMemo(() => {
    return active
      .map((id) => ({ c: policyCountry(id), s: byId.get(id)!, st: policyStats(byId.get(id)!) }))
      .filter((r): r is { c: ReturnType<typeof policyCountry>; s: PolicyRateSeries; st: PolicyStats } => r.st != null)
      .sort((a, b) => b.st.current - a.st.current);
  }, [active, byId]);

  const refAsOf = useMemo(() => median(active.map((id) => byId.get(id)!.asOf)), [active, byId]);

  const stale = useMemo(() => {
    if (!refAsOf) return [] as { name: string; asOf: string }[];
    return active
      .map((id) => ({ name: policyCountry(id).name, asOf: byId.get(id)!.asOf }))
      .filter((x) => diffDaysUTC(x.asOf, refAsOf) > STALE_GAP_DAYS);
  }, [active, byId, refAsOf]);

  const missingSelected = selected.filter((id) => resp && !byId.has(id)).map((id) => policyCountry(id).name);

  const isDefaultSelection =
    selected.length === DEFAULT_IDS.length && DEFAULT_IDS.every((id) => selected.includes(id));

  function toggle(id: PolicyRateCountryId) {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.length === 1 ? prev : prev.filter((x) => x !== id);
      return [...prev, id].sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));
    });
  }

  const chartHostRef = useRef<HTMLDivElement>(null);
  const endLabels = useEndLabels(chartHostRef, series, CHART_H);

  const titleMonth = refAsOf ? fmtMesLongo(refAsOf) : null;

  return (
    <section className="overflow-hidden rounded-2xl border border-[#132960]/15 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#132960] px-4 py-3 md:px-5">
        <h2 className="flex items-center gap-2 text-base font-semibold text-white md:text-lg">
          Taxas básicas de juros pelo mundo{titleMonth ? ` — ${titleMonth}` : ""}
          <MethodInfo align="left" className="align-middle">
            Taxa básica de cada banco central (a taxa-meta que ele controla), desenhada em degraus: a linha só muda
            no dia em que a nova taxa passa a valer. Fonte: BIS — Central bank policy rates (WS_CBPOL), compilada a
            partir dos próprios bancos centrais, com cerca de uma semana de defasagem (a coluna &quot;Dados
            até&quot; mostra a última data de cada país). Zona do Euro: taxa de depósito do BCE (ECB Data Portal) —
            é a taxa que guia o mercado europeu; o BIS só passa a usá-la em set/2024 (antes publicava a MRO). EUA:
            ponto médio da banda do Fed no gráfico (a tabela mostra a banda). China: LPR de 1 ano (desde ago/2019;
            antes, taxa oficial de empréstimo de 1 ano). Séries cortadas onde a definição muda: México desde
            jan/2008 (antes, taxa de mercado), Indonésia desde ago/2016 (a troca da BI rate pela 7-day reverse repo
            aparece no BIS como uma queda de 1,25 p.p. que não foi corte) e Chile desde ago/2001 (antes, taxa real).
            Fora do gráfico: Turquia (taxa acima de 35% achataria a escala dos demais) e Índia (série do BIS sem
            atualização). &quot;Situação&quot;: direção da última decisão se ela ocorreu nos últimos{" "}
            {PAUSE_AFTER_DAYS} dias; senão, pausa. &quot;vs. pico&quot;: distância da taxa atual até a máxima desde
            jan/2021.
          </MethodInfo>
        </h2>
        <p className="text-[11px] text-[#9db8e8]">
          {refAsOf ? `Dados até ${fmtDataBR(refAsOf)} · BIS` : loading ? "Carregando…" : ""}
        </p>
      </div>

      {loading && !resp ? (
        <div className="flex h-[420px] items-center justify-center text-sm text-zinc-400">
          Carregando taxas básicas…
        </div>
      ) : failed || !resp ? (
        <div className="flex h-[260px] items-center justify-center px-6 text-center text-sm text-zinc-500">
          Fonte das taxas básicas (BIS) indisponível no momento — tenta de novo na próxima visita.
        </div>
      ) : (
        <div className="space-y-4 p-4 md:p-5">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Países</span>
              {!isDefaultSelection ? (
                <button
                  type="button"
                  onClick={() => setSelected(DEFAULT_IDS)}
                  className="text-[11px] font-semibold text-[#027DFC] hover:underline"
                >
                  Restaurar seleção padrão
                </button>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {POLICY_RATE_COUNTRIES.filter((c) => byId.has(c.id)).map((c) => {
                const on = selected.includes(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggle(c.id)}
                    className={`inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-sm font-semibold transition ${
                      on
                        ? "border-transparent text-white shadow-sm"
                        : "border-[#132960]/15 bg-white text-[#132960] hover:border-[#027DFC]"
                    }`}
                    style={on ? { backgroundColor: c.color } : undefined}
                  >
                    <Flag code={c.flag} name={c.name} />
                    {c.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-zinc-500">Janela:</span>
            <AzPeriodSelector value={period} onChange={setPeriod} min={range.min} max={range.max} />
          </div>

          {series.length === 0 ? (
            <div className="flex h-[420px] items-center justify-center text-sm text-zinc-500">
              Sem dados para a combinação selecionada.
            </div>
          ) : (
            <div className="relative" style={{ paddingRight: END_LABEL_W }}>
              <div ref={chartHostRef}>
                <AzTimeSeriesChart
                  series={series}
                  unit="%"
                  mode="raw"
                  period={{ id: "max" }}
                  height={CHART_H}
                  yAxisLabel="Taxa básica (% a.a.)"
                  dots={false}
                  forwardFill
                  seriesEndLabels
                  niceYTicks
                />
              </div>
              <div
                aria-hidden
                className="pointer-events-none absolute right-0 top-0"
                style={{ width: END_LABEL_W, height: CHART_H }}
              >
                {endLabels.map((l) => (
                  <span
                    key={l.id}
                    className="absolute left-1 -translate-y-1/2 whitespace-nowrap text-[11px] font-bold tabular-nums leading-none"
                    style={{ top: l.y, color: l.color }}
                  >
                    {l.text}
                  </span>
                ))}
              </div>
            </div>
          )}

          {stale.length > 0 || missingSelected.length > 0 ? (
            <p className="text-[11px] italic text-amber-700">
              {stale.length > 0
                ? `Defasagem maior na fonte: ${stale.map((x) => `${x.name} (até ${fmtDataBR(x.asOf)})`).join(", ")}. `
                : ""}
              {missingSelected.length > 0 ? `Sem resposta da fonte agora: ${missingSelected.join(", ")}.` : ""}
            </p>
          ) : null}

          <div className="-mx-4 overflow-x-auto md:mx-0">
            <table className="w-full min-w-[760px] border-collapse whitespace-nowrap text-sm">
              <thead>
                <tr className="border-b border-[#132960]/15 text-left text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                  <th className="py-2 pl-4 pr-3 md:pl-0">País</th>
                  <th className="px-3 py-2 text-right">Taxa atual</th>
                  <th className="px-3 py-2 text-right">Último movimento</th>
                  <th className="px-3 py-2 text-right">12 meses</th>
                  <th className="px-3 py-2 text-right">vs. pico desde 2021</th>
                  <th className="px-3 py-2">Situação</th>
                  <th className="py-2 pl-3 pr-4 text-right md:pr-0">Dados até</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ c, s, st }) => {
                  const lagging = refAsOf != null && diffDaysUTC(s.asOf, refAsOf) > STALE_GAP_DAYS;
                  return (
                    <tr key={c.id} className="border-b border-zinc-100 last:border-0">
                      <td className="py-2 pl-4 pr-3 md:pl-0">
                        <div className="flex items-center gap-2">
                          <span className="h-3 w-1 shrink-0 rounded-full" style={{ background: c.color }} aria-hidden />
                          <Flag code={c.flag} name={c.name} />
                          <div className="min-w-0 leading-tight">
                            <div className="font-semibold text-[#132960]">{c.name}</div>
                            <div className="max-w-[230px] truncate text-[11px] text-zinc-500" title={`${c.bank} · ${c.rate}`}>
                              {c.bank} · {c.rate}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right font-bold tabular-nums text-[#132960]">
                        {fmtRateBand(st.current, c.band)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {st.lastMove ? (
                          <div className="leading-tight">
                            <div className="font-semibold text-[#132960]">{fmtPP(st.lastMove.delta)}</div>
                            <div className="text-[11px] text-zinc-500">em {fmtDataCurta(st.lastMove.date)}</div>
                          </div>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-[#132960]">
                        {st.chg12m == null ? "—" : st.chg12m === 0 ? "estável" : fmtPP(st.chg12m)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {st.peak == null || st.fromPeak == null ? (
                          "—"
                        ) : st.fromPeak === 0 ? (
                          <span className="font-semibold text-[#132960]">no pico</span>
                        ) : (
                          <div className="leading-tight">
                            <div className="font-semibold text-[#132960]">{fmtPP(st.fromPeak)}</div>
                            <div className="text-[11px] text-zinc-500">
                              pico {fmtRateBand(st.peak.value, c.band)}
                              {st.peak.date > POLICY_CYCLE_START ? ` em ${fmtMesCurto(st.peak.date)}` : " em jan/21"}
                            </div>
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <CockpitChip
                          cor={STATUS_COLOR[st.status]}
                          title={
                            st.status === "pausa" && st.lastMove
                              ? `Sem mudança desde ${fmtDataBR(st.lastMove.date)} (último movimento foi ${st.lastDirection})`
                              : undefined
                          }
                        >
                          {STATUS_LABEL[st.status]}
                          {st.status === "pausa" && st.lastDirection ? ` após ${st.lastDirection}` : ""}
                        </CockpitChip>
                      </td>
                      <td
                        className={`py-2 pl-3 pr-4 text-right text-[12px] tabular-nums md:pr-0 ${
                          lagging ? "font-semibold text-amber-700" : "text-zinc-500"
                        }`}
                      >
                        {fmtDataCurta(s.asOf)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
