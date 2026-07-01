"use client";

import { useCallback, useState } from "react";

import { AcoesScreener } from "@/components/painel/acoes/AcoesScreener";
import { AcoesValuation } from "@/components/painel/acoes/AcoesValuation";
import { FluxoInvestidores } from "@/components/painel/acoes/FluxoInvestidores";
import { IbovHero, type IbovOverlaySeries } from "@/components/painel/acoes/IbovHero";
import type { AzSeriesPoint } from "@/components/painel/charts";
import type {
  AcoesIbovData,
  AcoesScreenerData,
  AcoesValuationData,
  FluxoInvestidoresData,
} from "@/lib/painel-acoes";

/** Paleta das ações sobrepostas — evita o azul AZ (reservado ao Ibovespa). */
const OVERLAY_PALETTE = ["#132960", "#FF5713", "#1E8A5C", "#7C3AED", "#A16207", "#0891B2"];
const MAX_SELECTED = 5;

type TabId = "visao" | "analitico";

type Props = {
  ibov: AcoesIbovData | null;
  valuation: AcoesValuationData | null;
  fluxo: FluxoInvestidoresData | null;
  screener: AcoesScreenerData | null;
  logos: Record<string, string>;
};

export function RendaVariavelClient({ ibov, valuation, fluxo, screener, logos }: Props) {
  const [tab, setTab] = useState<TabId>("visao");

  // Comparador: seleção ordenada + cache das séries de retorno total + cores estáveis.
  const [selected, setSelected] = useState<string[]>([]);
  const [colors, setColors] = useState<Record<string, string>>({});
  const [cache, setCache] = useState<Record<string, AzSeriesPoint[]>>({});
  const [loading, setLoading] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  const fetchSeries = useCallback(async (ticker: string) => {
    setLoading((l) => (l.includes(ticker) ? l : [...l, ticker]));
    try {
      const res = await fetch(`/api/acoes/serie/${encodeURIComponent(ticker)}`);
      const json = (await res.json()) as { series?: Array<[string, number]> };
      const series = (json.series ?? []) as AzSeriesPoint[];
      if (series.length < 2) {
        // Sem série (papel fora do dataset de total return): desfaz a seleção.
        setSelected((s) => s.filter((t) => t !== ticker));
        setColors((c) => {
          const { [ticker]: _drop, ...rest } = c;
          void _drop;
          return rest;
        });
        setNotice(`Série de retorno total de ${ticker} indisponível no momento.`);
        return;
      }
      setCache((c) => ({ ...c, [ticker]: series }));
    } catch {
      setSelected((s) => s.filter((t) => t !== ticker));
      setNotice(`Não foi possível carregar a série de ${ticker}.`);
    } finally {
      setLoading((l) => l.filter((t) => t !== ticker));
    }
  }, []);

  const toggleSelect = useCallback(
    (ticker: string) => {
      setNotice(null);
      setSelected((prev) => {
        if (prev.includes(ticker)) {
          setColors((c) => {
            const { [ticker]: _drop, ...rest } = c;
            void _drop;
            return rest;
          });
          return prev.filter((t) => t !== ticker);
        }
        if (prev.length >= MAX_SELECTED) return prev;
        // Atribui a 1ª cor livre da paleta (estável enquanto selecionada).
        setColors((c) => {
          const used = new Set(Object.values(c));
          const color = OVERLAY_PALETTE.find((x) => !used.has(x)) ?? OVERLAY_PALETTE[prev.length % OVERLAY_PALETTE.length];
          return { ...c, [ticker]: color };
        });
        if (!cache[ticker]) void fetchSeries(ticker);
        return [...prev, ticker];
      });
    },
    [cache, fetchSeries],
  );

  const overlays: IbovOverlaySeries[] = selected
    .filter((t) => (cache[t]?.length ?? 0) >= 2)
    .map((t) => ({ ticker: t, label: t, color: colors[t] ?? OVERLAY_PALETTE[0], data: cache[t] }));

  const tabBtn = (id: TabId, label: string) => (
    <button
      type="button"
      onClick={() => setTab(id)}
      aria-pressed={tab === id}
      className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
        tab === id ? "bg-white text-[#132960] shadow-sm" : "text-zinc-500 hover:text-[#132960]"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-6">
      <div className="inline-flex rounded-full border border-[#132960]/15 bg-zinc-100/70 p-1">
        {tabBtn("visao", "Visão geral")}
        {tabBtn("analitico", "Analítico")}
      </div>

      {tab === "visao" ? (
        <div className="space-y-6">
          {ibov && ibov.status === "ok" ? (
            <IbovHero
              data={ibov}
              overlays={overlays}
              loadingTickers={loading}
              onRemoveOverlay={toggleSelect}
            />
          ) : (
            <section className="rounded-2xl border border-[#132960]/15 bg-white p-6 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Ibovespa</p>
              <p className="mt-2 text-sm text-zinc-500">
                Pipeline em construção — dados serão preenchidos no próximo deploy.
              </p>
            </section>
          )}

          {notice ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              {notice}
            </p>
          ) : null}

          {screener && screener.status === "ok" ? (
            <AcoesScreener
              data={screener}
              logos={logos}
              selected={selected}
              selectedColors={colors}
              onToggleSelect={toggleSelect}
              maxSelected={MAX_SELECTED}
            />
          ) : (
            <section className="rounded-2xl border border-[#132960]/15 bg-white p-6 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Screener</p>
              <p className="mt-2 text-sm text-zinc-500">
                Em construção — universo Ibovespa com P/L, P/VP, DY, ROE, valor de mercado e peso no
                índice.
              </p>
            </section>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {valuation && valuation.status === "ok" ? (
            <AcoesValuation data={valuation} />
          ) : (
            <section className="rounded-2xl border border-[#132960]/15 bg-white p-6 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Valuation</p>
              <p className="mt-2 text-sm text-zinc-500">Em construção.</p>
            </section>
          )}
          {fluxo && fluxo.status === "ok" ? <FluxoInvestidores data={fluxo} /> : null}
        </div>
      )}
    </div>
  );
}
