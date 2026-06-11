"use client";

import { useMemo, useState } from "react";

import { AzPeriodSelector, AzTimeSeriesChart, type AzPeriodValue, type AzTimeSeries } from "@/components/painel/charts";
import { DivergingReturnBars } from "@/components/painel/charts/DivergingReturnBars";
import { AzSegmented, ChartCard, KpiCard } from "@/components/painel/core";
import { PipelinePendingCard } from "@/components/painel/PipelinePendingCard";
import { fmtNum } from "@/lib/format-br";
import {
  PANORAMA_PERIODS,
  type CommoditiesReturnsPayload,
  type CommodityReturnRow,
  type HistorySlice,
  type PanoramaPeriodKey,
} from "@/lib/painel-mercado-global";

/**
 * Dashboard de Commodities (mercado · global): retornos por período
 * agrupados por setor (toggle USD/BRL) + histórico comparativo rebase 100
 * dos futuros com presets Energia / Metais / Agro BR.
 */

type Currency = "usd" | "brl";

// ── Grupos de setor (leitura econômica: Energia / Metais / Agro) ─────────────
const SECTOR_GROUPS: { id: string; label: string; sectors: string[]; note?: string }[] = [
  { id: "energia", label: "Energia", sectors: ["energia"] },
  { id: "metais", label: "Metais", sectors: ["metais"] },
  {
    id: "agro",
    label: "Agro",
    sectors: ["agricola", "softs", "pecuaria"],
    note: "consolida Agrícola, Softs e Pecuária",
  },
];

/** Normaliza "Agrícola"/"Pecuária" → "agricola"/"pecuaria" (compara sem acento). */
function normSector(s: string): string {
  return s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();
}

function rowValue(row: CommodityReturnRow, currency: Currency): number | null {
  const v = currency === "usd" ? row.return_pct_usd : row.return_pct_brl;
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

// ── Presets do histórico comparativo ─────────────────────────────────────────
const HISTORY_PRESETS: { id: string; label: string; tickers: string[] }[] = [
  { id: "energia", label: "Energia", tickers: ["BZ=F", "CL=F", "NG=F"] },
  { id: "metais", label: "Metais", tickers: ["GC=F", "SI=F", "HG=F"] },
  { id: "agro-br", label: "Agro BR", tickers: ["KC=F", "SB=F", "ZS=F", "ZC=F"] },
];

/** Rótulos curtos de legenda (os nomes do catálogo trazem "(futuro)"). */
const HISTORY_LABELS: Record<string, string> = {
  "BZ=F": "Brent",
  "CL=F": "WTI",
  "NG=F": "Gás natural",
  "GC=F": "Ouro",
  "SI=F": "Prata",
  "HG=F": "Cobre",
  "KC=F": "Café",
  "SB=F": "Açúcar",
  "ZS=F": "Soja",
  "ZC=F": "Milho",
};

/**
 * KPIs do topo (1D em USD): um nome por setor-chave. A unidade segue a
 * COTAÇÃO do contrato no Yahoo (soja e café cotam em cents, não em US$).
 */
const KPI_TICKERS: { ticker: string; label: string; unit: string }[] = [
  { ticker: "BZ=F", label: "Petróleo Brent", unit: "US$/barril" },
  { ticker: "GC=F", label: "Ouro", unit: "US$/onça" },
  { ticker: "ZS=F", label: "Soja", unit: "¢/bushel" },
  { ticker: "KC=F", label: "Café", unit: "¢/libra" },
];

type Props = {
  panorama: CommoditiesReturnsPayload | null;
  history: HistorySlice;
};

export function CommoditiesDashboard({ panorama, history }: Props) {
  const [period, setPeriod] = useState<PanoramaPeriodKey>("1mo");
  const [currency, setCurrency] = useState<Currency>("usd");
  const [preset, setPreset] = useState<string>("energia");
  const [histPeriod, setHistPeriod] = useState<AzPeriodValue>({ id: "1y" });

  // ── Retornos por setor (período + moeda selecionados) ─────────────────────
  const grouped = useMemo(() => {
    const rows = panorama?.by_period?.[period]?.data ?? [];
    let lo = 0;
    let hi = 0;
    const groups = SECTOR_GROUPS.map((g) => {
      const items = rows
        .filter((r) => g.sectors.includes(normSector(r.sector ?? "")))
        .map((r) => ({ label: r.name, value: rowValue(r, currency) }))
        .filter((r): r is { label: string; value: number } => r.value != null)
        .sort((a, b) => b.value - a.value);
      for (const it of items) {
        if (it.value < lo) lo = it.value;
        if (it.value > hi) hi = it.value;
      }
      return { ...g, items };
    });
    // Domain compartilhado entre os três grupos (barras comparáveis) + 12% de folga.
    const span = hi - lo;
    const pad = span > 0 ? span * 0.12 : 1;
    const xDomain: [number, number] = [lo - pad, hi + pad];
    return { groups, xDomain };
  }, [panorama, period, currency]);

  const hasReturns = grouped.groups.some((g) => g.items.length > 0);

  // ── KPIs (1D, USD) ─────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const rows = panorama?.by_period?.["1d"]?.data ?? [];
    return KPI_TICKERS.map((k) => {
      const row = rows.find((r) => r.ticker === k.ticker) ?? null;
      return {
        label: k.label,
        value: row?.last_close != null ? fmtNum(row.last_close, 2) : "—",
        unit: k.unit,
        delta: row ? rowValue(row, "usd") : null,
        hint: row?.exchange ?? undefined,
      };
    });
  }, [panorama]);

  // ── Histórico comparativo (rebase 100, USD) ───────────────────────────────
  const activePreset = HISTORY_PRESETS.find((p) => p.id === preset) ?? HISTORY_PRESETS[0];
  const historySeries = useMemo<AzTimeSeries[]>(
    () =>
      activePreset.tickers
        .map((ticker) => history.series.find((s) => s.ticker === ticker))
        .filter((s): s is NonNullable<typeof s> => s != null)
        .map((s) => ({ id: s.ticker, label: HISTORY_LABELS[s.ticker] ?? s.label, data: s.data })),
    [activePreset, history.series],
  );

  const histMin = history.series.length > 0 ? history.series[0].data[0]?.[0] : undefined;
  const histMax = history.lastDataDate ?? undefined;

  return (
    <div className="space-y-6">
      {/* KPIs */}
      {panorama ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {kpis.map((k) => (
            <KpiCard
              key={k.label}
              label={k.label}
              value={k.value}
              unit={k.unit}
              delta={k.delta}
              deltaHint="1D em USD"
              hint={k.hint}
            />
          ))}
        </div>
      ) : null}

      {/* Retornos por período, agrupados por setor */}
      {panorama ? (
        <ChartCard
          title="Retornos por setor"
          subtitle="Futuros front-month — variação no período, agrupada em Energia, Metais e Agro (Agrícola + Softs + Pecuária)"
          toolbar={
            <>
              <AzSegmented
                ariaLabel="Moeda do retorno"
                value={currency}
                onChange={(v) => setCurrency(v as Currency)}
                options={[
                  { id: "usd", label: "USD" },
                  { id: "brl", label: "BRL" },
                ]}
              />
              <AzSegmented
                ariaLabel="Período"
                value={period}
                onChange={(v) => setPeriod(v as PanoramaPeriodKey)}
                options={PANORAMA_PERIODS}
              />
            </>
          }
          footer={
            <>
              Retorno em BRL converte o futuro (cotado em US$) pela variação do USD/BRL no mesmo
              período. Fonte: Yahoo Finance, giro a cada 15 min.
            </>
          }
          stampGiro={panorama.generated_at}
          stampDado={panorama.generated_at}
        >
          {hasReturns ? (
            <div className="space-y-4">
              {grouped.groups.map((g) =>
                g.items.length === 0 ? null : (
                  <div key={g.id}>
                    <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-zinc-500">
                      {g.label}
                      {g.note ? <span className="ml-1.5 font-normal normal-case text-zinc-400">({g.note})</span> : null}
                    </h3>
                    <DivergingReturnBars rows={g.items} xDomain={grouped.xDomain} yAxisWidth={128} />
                  </div>
                ),
              )}
            </div>
          ) : (
            <p className="py-10 text-center text-sm text-zinc-500">Sem dados para este período.</p>
          )}
        </ChartCard>
      ) : (
        <PipelinePendingCard blobPaths={["data/commodities_returns_panorama.json"]} workflow="data-pipeline.yml" />
      )}

      {/* Histórico comparativo */}
      {history.series.length > 0 ? (
        <ChartCard
          title="Histórico comparativo dos futuros (USD)"
          subtitle="Rebase 100 = todas as séries valem 100 no primeiro pregão da janela; compara trajetória, não nível"
          toolbar={
            <AzSegmented
              ariaLabel="Grupo de commodities"
              value={preset}
              onChange={setPreset}
              options={HISTORY_PRESETS.map((p) => ({ id: p.id, label: p.label }))}
            />
          }
          footer={
            <>
              Fechamentos diários em US$ (5 anos), contratos contínuos front-month do Yahoo Finance.
              Calendários de pregão distintos são alinhados pelo último fechamento disponível.
            </>
          }
          stampGiro={history.generatedAt}
          stampDado={history.lastDataDate}
        >
          <div className="space-y-3">
            <AzPeriodSelector value={histPeriod} onChange={setHistPeriod} min={histMin} max={histMax} />
            <AzTimeSeriesChart
              series={historySeries}
              mode="rebase100"
              period={histPeriod}
              height={340}
              forwardFill
            />
          </div>
        </ChartCard>
      ) : (
        <PipelinePendingCard blobPaths={["data/market_history_full.json"]} workflow="market-data.yml" />
      )}
    </div>
  );
}
