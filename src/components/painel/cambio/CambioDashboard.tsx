"use client";

import { useMemo, useState } from "react";

import { AzPeriodSelector, AzTimeSeriesChart, type AzPeriodValue, type AzTimeSeries } from "@/components/painel/charts";
import { DivergingReturnBars } from "@/components/painel/charts/DivergingReturnBars";
import { AzSegmented, ChartCard, KpiCard } from "@/components/painel/core";
import { PipelinePendingCard } from "@/components/painel/PipelinePendingCard";
import { fmtBRL, fmtNum } from "@/lib/format-br";
import {
  FX_PERIOD_BY_PANORAMA,
  PANORAMA_PERIODS,
  type FxTopMoversPayload,
  type HistorySlice,
  type PanoramaPeriodKey,
} from "@/lib/painel-mercado-global";

/**
 * Dashboard de Câmbio (mercado · brasil): hero USD/BRL (5 anos diários),
 * cruzes do real (EUR/BRL, GBP/BRL), DXY e top movers globais contra o USD.
 */

const USD = "BRL=X";
const EUR = "EURBRL=X";
const GBP = "GBPBRL=X";
const DXY = "DX-Y.NYB";

/** Nome pt-BR da moeda nos top movers ("BRL / USD" → "Real (BRL)"). */
const CURRENCY_NAMES: Record<string, string> = {
  BRL: "Real (BRL)",
  EUR: "Euro (EUR)",
  GBP: "Libra (GBP)",
  JPY: "Iene (JPY)",
  CNY: "Yuan (CNY)",
  MXN: "Peso mexicano",
  ARS: "Peso argentino",
  CLP: "Peso chileno",
  COP: "Peso colombiano",
  ZAR: "Rand (ZAR)",
  INR: "Rupia (INR)",
  RUB: "Rublo (RUB)",
};

function moverLabel(ticker: string): string {
  const code = ticker.trim().slice(0, 3).toUpperCase();
  return CURRENCY_NAMES[code] ?? ticker;
}

/** Última cotação + variação 1D (%) a partir da série diária. */
function lastAndDayChange(data: Array<[string, number]> | undefined): {
  last: number | null;
  dayChangePct: number | null;
} {
  if (!data || data.length === 0) return { last: null, dayChangePct: null };
  const last = data[data.length - 1][1];
  if (data.length < 2) return { last, dayChangePct: null };
  const prev = data[data.length - 2][1];
  return { last, dayChangePct: prev > 0 ? (last / prev - 1) * 100 : null };
}

type Props = {
  movers: FxTopMoversPayload | null;
  /** Séries de BRL=X, EURBRL=X, GBPBRL=X e DX-Y.NYB. */
  history: HistorySlice;
};

export function CambioDashboard({ movers, history }: Props) {
  const [heroPeriod, setHeroPeriod] = useState<AzPeriodValue>({ id: "5y" });
  const [cruzesPeriod, setCruzesPeriod] = useState<AzPeriodValue>({ id: "1y" });
  const [cruzesMode, setCruzesMode] = useState<"raw" | "pct">("raw");
  const [dxyPeriod, setDxyPeriod] = useState<AzPeriodValue>({ id: "1y" });
  const [moversPeriod, setMoversPeriod] = useState<PanoramaPeriodKey>("1mo");

  const byTicker = useMemo(() => {
    const map = new Map<string, (typeof history.series)[number]>();
    for (const s of history.series) map.set(s.ticker, s);
    return map;
  }, [history.series]);

  const usd = byTicker.get(USD);
  const eur = byTicker.get(EUR);
  const gbp = byTicker.get(GBP);
  const dxy = byTicker.get(DXY);

  const histMin = usd?.data[0]?.[0];
  const histMax = history.lastDataDate ?? undefined;

  // ── KPIs (último fechamento + variação 1D) ────────────────────────────────
  const kpis = useMemo(
    () => [
      { label: "Dólar (USD/BRL)", ...lastAndDayChange(usd?.data), fmt: (v: number) => fmtBRL(v), unit: undefined },
      { label: "Euro (EUR/BRL)", ...lastAndDayChange(eur?.data), fmt: (v: number) => fmtBRL(v), unit: undefined },
      { label: "Libra (GBP/BRL)", ...lastAndDayChange(gbp?.data), fmt: (v: number) => fmtBRL(v), unit: undefined },
      { label: "DXY (índice do dólar)", ...lastAndDayChange(dxy?.data), fmt: (v: number) => fmtNum(v, 1), unit: "pts" },
    ],
    [usd, eur, gbp, dxy],
  );

  // ── Séries dos charts ──────────────────────────────────────────────────────
  const heroSeries = useMemo<AzTimeSeries[]>(
    () => (usd ? [{ id: USD, label: "USD/BRL", data: usd.data }] : []),
    [usd],
  );

  const cruzesSeries = useMemo<AzTimeSeries[]>(
    () =>
      [
        usd ? { id: USD, label: "USD/BRL", data: usd.data } : null,
        eur ? { id: EUR, label: "EUR/BRL", color: "#7C3AED", data: eur.data } : null,
        gbp ? { id: GBP, label: "GBP/BRL", color: "#A16207", data: gbp.data } : null,
      ].filter((s): s is NonNullable<typeof s> => s != null),
    [usd, eur, gbp],
  );

  const dxySeries = useMemo<AzTimeSeries[]>(
    () => (dxy ? [{ id: "dxy", label: "DXY", color: "#132960", data: dxy.data }] : []),
    [dxy],
  );

  // ── Top movers (up + down do período, sem o DXY — ele tem card próprio) ───
  const moverRows = useMemo(() => {
    const block = movers?.top?.[FX_PERIOD_BY_PANORAMA[moversPeriod]];
    const all = [...(block?.up ?? []), ...(block?.down ?? [])];
    const seen = new Set<string>();
    const rows: { label: string; value: number }[] = [];
    for (const r of all) {
      if (!r || !Number.isFinite(r.change_pct)) continue;
      if (r.ticker === "DXY" || seen.has(r.ticker)) continue;
      seen.add(r.ticker);
      rows.push({ label: moverLabel(r.ticker), value: r.change_pct });
    }
    return { rows: rows.sort((a, b) => b.value - a.value), asof: block?.asof };
  }, [movers, moversPeriod]);

  return (
    <div className="space-y-6">
      {/* KPIs */}
      {history.series.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {kpis.map((k) => (
            <KpiCard
              key={k.label}
              label={k.label}
              value={k.last != null ? k.fmt(k.last) : "—"}
              unit={k.unit}
              delta={k.dayChangePct}
              deltaHint="1D"
            />
          ))}
        </div>
      ) : null}

      {/* Hero USD/BRL */}
      {usd ? (
        <ChartCard
          title="Dólar — USD/BRL"
          subtitle="Fechamento diário dos últimos 5 anos"
          footer={<>Cotação spot de fechamento (Yahoo Finance), atualizada 1x/dia útil pelo pipeline.</>}
          stampGiro={history.generatedAt}
          stampDado={history.lastDataDate}
        >
          <div className="space-y-3">
            <AzPeriodSelector value={heroPeriod} onChange={setHeroPeriod} min={histMin} max={histMax} />
            <AzTimeSeriesChart series={heroSeries} unit="R$" period={heroPeriod} height={320} />
          </div>
        </ChartCard>
      ) : (
        <PipelinePendingCard blobPaths={["data/market_history_full.json"]} workflow="market-data.yml" />
      )}

      {/* Cruzes do real */}
      {cruzesSeries.length > 0 ? (
        <ChartCard
          title="Cruzes do real"
          subtitle="USD/BRL, EUR/BRL e GBP/BRL — quanto custa cada moeda em reais"
          toolbar={
            <AzSegmented
              ariaLabel="Modo de leitura"
              value={cruzesMode}
              onChange={(v) => setCruzesMode(v as "raw" | "pct")}
              options={[
                { id: "raw", label: "Cotação (R$)" },
                { id: "pct", label: "Variação %" },
              ]}
            />
          }
          footer={
            <>
              Em &quot;Variação %&quot;, cada série acumula a variação desde o primeiro pregão da
              janela — alta = real mais fraco contra a moeda.
            </>
          }
          stampGiro={history.generatedAt}
          stampDado={history.lastDataDate}
        >
          <div className="space-y-3">
            <AzPeriodSelector value={cruzesPeriod} onChange={setCruzesPeriod} min={histMin} max={histMax} />
            <AzTimeSeriesChart
              series={cruzesSeries}
              unit="R$"
              mode={cruzesMode === "pct" ? "pct_acum" : "raw"}
              period={cruzesPeriod}
              height={320}
              forwardFill
            />
          </div>
        </ChartCard>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* DXY */}
        {dxy ? (
          <ChartCard
            title="DXY — índice do dólar"
            subtitle="Força do USD contra a cesta de moedas desenvolvidas (EUR, JPY, GBP, CAD, SEK, CHF)"
            footer={<>Alta do DXY = dólar globalmente mais forte; pressão típica de alta no USD/BRL.</>}
            stampGiro={history.generatedAt}
            stampDado={history.lastDataDate}
          >
            <div className="space-y-3">
              <AzPeriodSelector
                value={dxyPeriod}
                onChange={setDxyPeriod}
                min={dxy.data[0]?.[0]}
                max={histMax}
                periods={["3m", "6m", "ytd", "1y", "5y", "max"]}
              />
              <AzTimeSeriesChart series={dxySeries} unit="index" period={dxyPeriod} height={300} />
            </div>
          </ChartCard>
        ) : null}

        {/* Top movers vs USD */}
        {movers ? (
          <ChartCard
            title="Moedas contra o dólar"
            subtitle="Variação de cada moeda em relação ao USD no período — positivo = moeda se valorizou"
            toolbar={
              <AzSegmented
                ariaLabel="Período"
                value={moversPeriod}
                onChange={(v) => setMoversPeriod(v as PanoramaPeriodKey)}
                options={PANORAMA_PERIODS}
              />
            }
            footer={
              <>
                Calculado sobre fechamentos diários (Yahoo Finance), giro a cada 15 min. O DXY fica
                no card ao lado por ser índice, não par de moedas.
              </>
            }
            stampGiro={movers.generated_at}
            stampDado={moverRows.asof ?? movers.generated_at}
          >
            <DivergingReturnBars rows={moverRows.rows} yAxisWidth={118} />
          </ChartCard>
        ) : (
          <PipelinePendingCard blobPaths={["data/fx_top_movers.json"]} workflow="data-pipeline.yml" />
        )}
      </div>
    </div>
  );
}
