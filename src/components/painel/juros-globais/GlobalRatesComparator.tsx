"use client";

import { useEffect, useMemo, useState } from "react";

import {
  AzPeriodSelector,
  AzTimeSeriesChart,
  type AzPeriodValue,
  type AzTimeSeries,
} from "@/components/painel/charts";
import { MethodInfo } from "@/components/painel/core/MethodInfo";
import { seriesColor } from "@/lib/az-chart-theme";
import {
  COMPARATOR_TENORS,
  GLOBAL_COUNTRIES,
  countryById,
  type CountryHistory,
  type GlobalCountryId,
} from "@/lib/global-rates";

type HistoryResp = {
  tenors: number[];
  cutoff: string;
  generatedAt: string;
  countries: CountryHistory[];
};

/** Prazos do comparador como number[] (COMPARATOR_TENORS é tupla literal). */
const ALL_TENORS: number[] = [...COMPARATOR_TENORS];

/** Janela longa (anos) do 2º estágio de carga — vira o "Max" do seletor. */
const LONG_YEARS = 25;

/** Cor fixa por país (consistente em todo o comparador). */
const COUNTRY_COLOR: Record<GlobalCountryId, string> = {
  br: "#009C3B", // verde-bandeira
  us: "#132960", // navy
  jp: "#FF5713", // rust
  de: "#027DFC", // azure
  gb: "#1E8A5C", // verde-mar
  co: "#D97706", // âmbar
  cl: "#6D28D9", // violeta
  cn: "#B91C1C", // vermelho escuro
};

function tenorLabel(years: number): string {
  return years < 1 ? `${Math.round(years * 12)}m` : `${years} ano${years > 1 ? "s" : ""}`;
}

export function GlobalRatesComparator() {
  const [resp, setResp] = useState<HistoryResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const [selected, setSelected] = useState<GlobalCountryId[]>([]);
  const [tenorSingle, setTenorSingle] = useState<number>(10);
  const [tenorsMulti, setTenorsMulti] = useState<number[]>([2, 5, 10]);
  const [period, setPeriod] = useState<AzPeriodValue>({ id: "1y" });

  useEffect(() => {
    const ctrl = new AbortController();
    let cancelled = false;
    let longLoaded = false;
    let gotAny = false;

    async function load(years: number) {
      try {
        const res = await fetch(`/api/global-rates/history?years=${years}`, {
          cache: "no-store",
          signal: ctrl.signal,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as HistoryResp;
        if (cancelled || json.countries.length === 0) return;
        // Resposta curta atrasada não pode regredir o histórico longo já carregado.
        if (years < LONG_YEARS && longLoaded) return;
        if (years >= LONG_YEARS) longLoaded = true;
        gotAny = true;
        setResp(json);
        setFailed(false);
        // Default: todos os países que vieram com dados, ordem do catálogo —
        // mas preserva a seleção do usuário nos reloads.
        const order = GLOBAL_COUNTRIES.map((c) => c.id);
        setSelected((prev) =>
          prev.length > 0
            ? prev
            : json.countries
                .map((c) => c.country)
                .sort((a, b) => order.indexOf(a) - order.indexOf(b)),
        );
      } catch {
        // Falha individual é tolerada; `failed` só se nada carregou no boot.
      }
    }

    async function boot() {
      // 2 estágios: 3 anos pinta rápido; o histórico longo substitui em seguida.
      await load(3);
      if (!cancelled) setLoading(false);
      await load(LONG_YEARS);
      if (!cancelled && !gotAny) setFailed(true);
    }

    boot();
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") load(longLoaded ? LONG_YEARS : 3);
    }, 6 * 60_000);
    return () => {
      cancelled = true;
      ctrl.abort();
      window.clearInterval(id);
    };
  }, []);

  const byCountry = useMemo(() => {
    const m = new Map<GlobalCountryId, CountryHistory>();
    for (const c of resp?.countries ?? []) m.set(c.country, c);
    return m;
  }, [resp]);

  /** Prazos disponíveis em pelo menos um país selecionado. */
  const tenorsAvailable = useMemo(() => {
    const set = new Set<number>();
    for (const cid of selected) {
      const ch = byCountry.get(cid);
      for (const s of ch?.series ?? []) set.add(s.years);
    }
    return ALL_TENORS.filter((t) => set.has(t));
  }, [selected, byCountry]);

  const single = selected.length === 1;

  // Garante que o prazo único escolhido exista; senão cai no 1º disponível.
  const effTenorSingle = tenorsAvailable.includes(tenorSingle)
    ? tenorSingle
    : (tenorsAvailable[0] ?? 10);

  // No modo 1-país, restringe os prazos múltiplos aos que o país tem.
  const effTenorsMulti = useMemo(() => {
    const sel = tenorsMulti.filter((t) => tenorsAvailable.includes(t));
    return sel.length > 0 ? sel : tenorsAvailable.slice(0, 3);
  }, [tenorsMulti, tenorsAvailable]);

  const series = useMemo<AzTimeSeries[]>(() => {
    const out: AzTimeSeries[] = [];
    if (single) {
      const cid = selected[0];
      const ch = byCountry.get(cid);
      if (ch) {
        effTenorsMulti.forEach((t, i) => {
          const s = ch.series.find((x) => x.years === t);
          if (s) out.push({ id: `${cid}-${t}`, label: tenorLabel(t), color: seriesColor(i), data: s.points });
        });
      }
    } else {
      selected.forEach((cid) => {
        const ch = byCountry.get(cid);
        const s = ch?.series.find((x) => x.years === effTenorSingle);
        if (s) out.push({ id: cid, label: countryById(cid)?.name ?? cid, color: COUNTRY_COLOR[cid], data: s.points });
      });
    }
    return out;
  }, [single, selected, byCountry, effTenorsMulti, effTenorSingle]);

  // Países sem o prazo escolhido (no modo multi-país) — nota de transparência.
  const missingForTenor = useMemo(() => {
    if (single) return [] as string[];
    return selected
      .filter((cid) => !byCountry.get(cid)?.series.some((s) => s.years === effTenorSingle))
      .map((cid) => countryById(cid)?.name ?? cid);
  }, [single, selected, byCountry, effTenorSingle]);

  const range = useMemo(() => {
    let min = "";
    let max = "";
    for (const s of series) {
      const f = s.data[0]?.[0];
      const l = s.data[s.data.length - 1]?.[0];
      if (f && (!min || f < min)) min = f;
      if (l && (!max || l > max)) max = l;
    }
    return { min: min || resp?.cutoff || "2023-01-01", max: max || resp?.generatedAt?.slice(0, 10) || "2026-06-30" };
  }, [series, resp]);

  function toggleCountry(cid: GlobalCountryId) {
    setSelected((prev) => {
      const has = prev.includes(cid);
      if (has) {
        if (prev.length === 1) return prev; // mantém ao menos 1
        return prev.filter((c) => c !== cid);
      }
      const order = GLOBAL_COUNTRIES.map((c) => c.id);
      return [...prev, cid].sort((a, b) => order.indexOf(a) - order.indexOf(b));
    });
  }

  function toggleTenorMulti(t: number) {
    setTenorsMulti((prev) => {
      const has = prev.includes(t);
      if (has) {
        if (prev.length === 1) return prev;
        return prev.filter((x) => x !== t);
      }
      return [...prev, t].sort((a, b) => a - b);
    });
  }

  const availableCountries = GLOBAL_COUNTRIES.filter((c) => byCountry.has(c.id));

  return (
    <section className="overflow-hidden rounded-2xl border border-[#132960]/15 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#132960] px-4 py-3 md:px-5">
        <h2 className="flex items-center gap-2 text-base font-semibold text-white md:text-lg">
          Juros soberanos — comparativo por prazo
          <MethodInfo align="left" className="align-middle">
            Yields nominais soberanos por prazo constante, fechamento diário (amostragem semanal no
            histórico p/ leveza). Fontes: Brasil — ANBIMA (ETTJ pré 1/2/5/10a; histórico antigo via
            Tesouro Direto LTN/NTN-F); EUA — FRED (Treasury constant maturity); Japão — Ministério
            das Finanças (JGB); Alemanha — Deutsche Bundesbank (curva Svensson); Reino Unido — Bank
            of England (par yields de gilts, só 5/10/20a); Colômbia — Banco de la República (TES
            zero cupom 1/5/10a, dias de defasagem de carga); China — ChinaBond/CCDC (CGB, via
            pipeline diário). A leitura intraday do Brasil (curva DI/IPCA+ da B3) vive no Panorama.
            França não tem curva diária gratuita.
          </MethodInfo>
        </h2>
        <p className="text-[11px] text-[#9db8e8]">
          {resp ? `Atualizado ${resp.generatedAt.slice(0, 10).split("-").reverse().join("/")}` : "Carregando…"}
        </p>
      </div>

      {loading && !resp ? (
        <div className="flex h-[360px] items-center justify-center text-sm text-zinc-400">
          Carregando curvas soberanas…
        </div>
      ) : failed || availableCountries.length === 0 ? (
        <div className="flex h-[260px] items-center justify-center px-6 text-center text-sm text-zinc-500">
          Fontes de juros internacionais indisponíveis no momento — atualiza automaticamente na próxima janela.
        </div>
      ) : (
        <div className="space-y-4 p-4 md:p-5">
          {/* Seleção de países (chips com bandeira) */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Países</span>
            <div className="flex flex-wrap items-center gap-2">
              {availableCountries.map((c) => {
                const active = selected.includes(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => toggleCountry(c.id)}
                    className={`inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-sm font-semibold transition ${
                      active
                        ? "border-transparent text-white shadow-sm"
                        : "border-[#132960]/15 bg-white text-[#132960] hover:border-[#027DFC]"
                    }`}
                    style={active ? { backgroundColor: COUNTRY_COLOR[c.id] } : undefined}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`https://flagcdn.com/w40/${c.flag}.png`}
                      alt={`Bandeira ${c.name}`}
                      width={22}
                      height={16}
                      className="h-4 w-[22px] rounded-[3px] shadow-sm"
                    />
                    {c.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Seleção de prazos — regra: vários países ⇒ 1 prazo; 1 país ⇒ vários prazos */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
              {single ? "Prazos (vários — um país selecionado)" : "Prazo (um — vários países)"}
            </span>
            <div className="flex flex-wrap items-center gap-2">
              {tenorsAvailable.map((t) => {
                const active = single ? effTenorsMulti.includes(t) : effTenorSingle === t;
                return (
                  <button
                    key={t}
                    type="button"
                    aria-pressed={active}
                    onClick={() => (single ? toggleTenorMulti(t) : setTenorSingle(t))}
                    className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                      active
                        ? "bg-[#027DFC] text-white"
                        : "border border-[#132960]/15 bg-zinc-50 text-[#132960] hover:border-[#027DFC]"
                    }`}
                  >
                    {tenorLabel(t)}
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] italic text-zinc-500">
              {single
                ? "Um país selecionado: plote vários vencimentos ao mesmo tempo. Adicione países para comparar um prazo único."
                : "Vários países: compare um prazo por vez. Deixe só um país selecionado para abrir vários vencimentos."}
            </p>
          </div>

          {/* Janela temporal */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-zinc-500">Janela:</span>
            <AzPeriodSelector value={period} onChange={setPeriod} min={range.min} max={range.max} />
          </div>

          {/* Gráfico */}
          {series.length === 0 ? (
            <div className="flex h-[360px] items-center justify-center text-sm text-zinc-500">
              Sem dados para a combinação selecionada.
            </div>
          ) : (
            <AzTimeSeriesChart
              series={series}
              unit="%"
              mode="raw"
              period={period}
              height={420}
              yAxisLabel="Taxa (% a.a.)"
              dots={false}
              forwardFill
              seriesEndLabels
            />
          )}

          {missingForTenor.length > 0 ? (
            <p className="text-[11px] italic text-amber-700">
              Sem {tenorLabel(effTenorSingle)} disponível para: {missingForTenor.join(", ")} (prazo não publicado pela fonte).
            </p>
          ) : null}

        </div>
      )}
    </section>
  );
}
