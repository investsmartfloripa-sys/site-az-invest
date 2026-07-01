"use client";

import { useCallback, useState } from "react";

import { ComparadorTabela, type ComparadorAtivoRow } from "@/components/painel/acoes/ComparadorTabela";
import { SimuladorCarteira, type SimAssetInput } from "@/components/painel/acoes/SimuladorCarteira";
import { FiiScreener } from "@/components/painel/fii/FiiScreener";
import { IfixHero, type IfixOverlaySeries } from "@/components/painel/fii/IfixHero";
import type { AzPeriodValue, AzSeriesPoint } from "@/components/painel/charts";
import type { FiiIfixData, FiiScreenerData } from "@/lib/painel-fii";

/**
 * Orquestrador do comparador de FIIs — espelho do RendaVariavelClient:
 * seleção no screener → overlays no hero do IFIX (retorno total, % base 0) →
 * tabela de retornos → simulador de carteira com gate de leads. Os componentes
 * do comparador/simulador são os MESMOS das ações (agnósticos de classe).
 */

/** Paleta das séries sobrepostas — evita o azul AZ (reservado ao IFIX). */
const OVERLAY_PALETTE = ["#132960", "#FF5713", "#1E8A5C", "#7C3AED", "#A16207", "#0891B2"];
const MAX_SELECTED = 5;

type Props = {
  ifix: FiiIfixData | null;
  screener: FiiScreenerData | null;
};

export function FundosImobiliariosClient({ ifix, screener }: Props) {
  // Janela do comparador — compartilhada entre gráfico e tabela.
  const [period, setPeriod] = useState<AzPeriodValue>({ id: "1y" });

  const [selected, setSelected] = useState<string[]>([]);
  const [colors, setColors] = useState<Record<string, string>>({});
  const [cache, setCache] = useState<Record<string, AzSeriesPoint[]>>({});
  const [loading, setLoading] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  const fetchSeries = useCallback(async (ticker: string) => {
    setLoading((l) => (l.includes(ticker) ? l : [...l, ticker]));
    try {
      const res = await fetch(`/api/fii/serie/${encodeURIComponent(ticker)}`);
      const json = (await res.json()) as { series?: Array<[string, number]> };
      const series = (json.series ?? []) as AzSeriesPoint[];
      if (series.length < 2) {
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

  const overlays: IfixOverlaySeries[] = selected
    .filter((t) => (cache[t]?.length ?? 0) >= 2)
    .map((t) => ({ ticker: t, label: t, color: colors[t] ?? OVERLAY_PALETTE[0], data: cache[t] }));

  const tabelaRows: ComparadorAtivoRow[] = overlays.map((o) => {
    const sc = screener?.rows.find((r) => r.ticker === o.ticker);
    return {
      ticker: o.ticker,
      label: o.label,
      color: o.color,
      data: o.data,
      logoSrc: null,
      dy12m: sc?.dy_12m_pct ?? null,
      price: sc?.price ?? null,
    };
  });

  // FIIs não têm "valor de mercado" no screener: o PL (patrimônio líquido) faz
  // o papel de peso por tamanho no atalho do simulador.
  const simAssets: SimAssetInput[] = overlays.map((o) => {
    const sc = screener?.rows.find((r) => r.ticker === o.ticker);
    return {
      ticker: o.ticker,
      color: o.color,
      series: o.data,
      dy12m: sc?.dy_12m_pct ?? null,
      marketCap: sc?.pl ?? null,
    };
  });

  const ifixSeries: AzSeriesPoint[] =
    ifix?.series_daily.map((p) => [p.date, p.ifix] as const) ?? [];
  const cdiSeries: AzSeriesPoint[] =
    ifix?.series_daily.flatMap((p) => (typeof p.CDI === "number" ? [[p.date, p.CDI] as const] : [])) ?? [];

  return (
    <div className="space-y-6">
      {ifix && ifix.status === "ok" ? (
        <>
          <IfixHero
            data={ifix}
            overlays={overlays}
            loadingTickers={loading}
            onRemoveOverlay={toggleSelect}
            period={period}
            onPeriodChange={setPeriod}
          />
          <ComparadorTabela ibovData={ifixSeries} rows={tabelaRows} period={period} indexLabel="IFIX" />
          <SimuladorCarteira
            assets={simAssets}
            ibovSeries={ifixSeries}
            cdiSeries={cdiSeries}
            benchLabel="IFIX"
          />
        </>
      ) : (
        <section
          aria-label="IFIX"
          className="rounded-2xl border border-[#132960]/15 bg-white p-6 shadow-sm"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">IFIX</p>
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
        <FiiScreener
          data={screener}
          selected={selected}
          selectedColors={colors}
          onToggleSelect={toggleSelect}
          maxSelected={MAX_SELECTED}
        />
      ) : (
        <section
          aria-label="Screener de FIIs"
          className="rounded-2xl border border-[#132960]/15 bg-white p-6 shadow-sm"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Screener</p>
          <p className="mt-2 text-sm text-zinc-500">
            Pipeline em construção — universo IFIX + métricas via CVM.
          </p>
        </section>
      )}
    </div>
  );
}
