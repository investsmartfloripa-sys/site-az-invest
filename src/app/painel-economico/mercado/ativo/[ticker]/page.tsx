export const dynamic = "force-dynamic";

import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { MarketCard } from "@/components/painel/market/MarketCard";
import { AtivoHeroChart, type AtivoHeroBenchmark } from "@/components/painel/market/AtivoHeroChart";
import {
  classLabel,
  formatBigNumber,
  formatPctFromRatio,
  formatRatio,
  getMarketCatalog,
  getMarketFundamentals,
  getMarketHistoryFull,
  getMarketHistoryLatest,
  type AssetClass,
  type CatalogAsset,
  type FundamentalsInfo,
  type MarketHistoryFull,
} from "@/lib/painel-market-data";
import type { AzUnit } from "@/components/painel/charts";
import { variationText } from "@/lib/az-chart-theme";
import { fmtSignedPct } from "@/lib/format-br";

type Props = { params: Promise<{ ticker: string }> };

function findCatalogAsset(catalog: CatalogAsset[], slug: string): CatalogAsset | null {
  const decoded = decodeURIComponent(slug);
  // Aceita ticker exato (PETR4.SA) ou nome (Petrobras)
  return (
    catalog.find((a) => a.ticker.toLowerCase() === decoded.toLowerCase()) ??
    catalog.find((a) => a.name.toLowerCase() === decoded.toLowerCase()) ??
    null
  );
}

/**
 * Benchmark de comparação por CLASSE de ativo (a pergunta que o leitor faz:
 * "bati o índice da minha classe?"). Tickers conferidos no catálogo do
 * pipeline (data-pipeline/python/market_catalog.py → market_history_full):
 * ^BVSP, ^GSPC, DX-Y.NYB (DXY), GC=F e BTC-USD estão todos no histórico.
 * Labels casam com BENCHMARK_COLORS (cor fixa) quando existe a convenção.
 */
const BENCHMARK_BY_CLASS: Record<AssetClass, { ticker: string; label: string }> = {
  br_acoes: { ticker: "^BVSP", label: "Ibovespa" },
  br_etf: { ticker: "^BVSP", label: "Ibovespa" },
  br_fii: { ticker: "^BVSP", label: "Ibovespa" },
  us_acoes: { ticker: "^GSPC", label: "S&P 500" },
  us_etf: { ticker: "^GSPC", label: "S&P 500" },
  indice: { ticker: "^GSPC", label: "S&P 500" },
  fx: { ticker: "DX-Y.NYB", label: "DXY" },
  commodity: { ticker: "GC=F", label: "Ouro" },
  cripto: { ticker: "BTC-USD", label: "Bitcoin" },
};

/** Quando o próprio ativo É o benchmark da classe, oferece o alternativo óbvio. */
const BENCHMARK_ALT: Record<string, { ticker: string; label: string }> = {
  "^BVSP": { ticker: "^GSPC", label: "S&P 500" },
  "^GSPC": { ticker: "^BVSP", label: "Ibovespa" },
  "DX-Y.NYB": { ticker: "BRL=X", label: "USD/BRL" },
  "GC=F": { ticker: "DX-Y.NYB", label: "DXY" },
  "BTC-USD": { ticker: "ETH-USD", label: "Ethereum" },
};

/**
 * Resolve o benchmark da classe e FATIA a série no servidor (recorta ao range
 * do ativo — nunca manda o JSON inteiro pro client). Fallback: se o benchmark
 * escolhido não está no histórico, cai pro ^GSPC; se nada, null (sem toggle).
 */
function pickBenchmark(
  asset: CatalogAsset,
  full: MarketHistoryFull | null,
  assetFirstDate: string | undefined,
): AtivoHeroBenchmark | null {
  let cand = BENCHMARK_BY_CLASS[asset.klass] ?? null;
  if (cand && cand.ticker === asset.ticker) cand = BENCHMARK_ALT[asset.ticker] ?? null;
  if (!cand) return null;

  let series = full?.tickers[cand.ticker]?.series_daily ?? [];
  if (series.length < 2 && cand.ticker !== "^GSPC" && asset.ticker !== "^GSPC") {
    cand = { ticker: "^GSPC", label: "S&P 500" };
    series = full?.tickers["^GSPC"]?.series_daily ?? [];
  }
  if (series.length < 2) return null;

  // Recorta o benchmark p/ começar junto com o ativo: o "Máx" da janela é o
  // máximo do ATIVO, não dos 5 anos do índice.
  const sliced = assetFirstDate ? series.filter(([d]) => d >= assetFirstDate) : series;
  if (sliced.length < 2) return null;
  return { ticker: cand.ticker, label: cand.label, series: sliced };
}

const STAT_GROUPS: Array<{ label: string; rows: Array<[string, keyof FundamentalsInfo, "ratio" | "pct" | "big" | "raw"]> }> = [
  {
    label: "Valuation",
    rows: [
      ["P/L (trailing)",     "trailingPE",                "ratio"],
      ["P/L (forward)",      "forwardPE",                 "ratio"],
      ["P/VP",               "priceToBook",               "ratio"],
      ["P/S",                "priceToSalesTrailing12Months", "ratio"],
      ["EV/EBITDA",          "enterpriseToEbitda",        "ratio"],
      ["EV/Receita",         "enterpriseToRevenue",       "ratio"],
    ],
  },
  {
    label: "Rentabilidade",
    rows: [
      ["ROE",                "returnOnEquity",            "pct"],
      ["ROA",                "returnOnAssets",            "pct"],
      ["Margem bruta",       "grossMargins",              "pct"],
      ["Margem operacional", "operatingMargins",          "pct"],
      ["Margem EBITDA",      "ebitdaMargins",             "pct"],
      ["Margem líquida",     "profitMargins",             "pct"],
    ],
  },
  {
    label: "Endividamento e liquidez",
    rows: [
      ["Dívida/PL",          "debtToEquity",              "ratio"],
      ["Current Ratio",      "currentRatio",              "ratio"],
      ["Quick Ratio",        "quickRatio",                "ratio"],
    ],
  },
  {
    label: "Dividendos",
    rows: [
      ["Dividend Yield",     "dividendYield",             "pct"],
      ["DY 5 anos médio",    "fiveYearAvgDividendYield",  "pct"],
      ["Payout",             "payoutRatio",               "pct"],
    ],
  },
  {
    label: "Mercado",
    rows: [
      ["Market Cap",         "marketCap",                 "big"],
      ["Enterprise Value",   "enterpriseValue",           "big"],
      ["Beta",               "beta",                      "ratio"],
      ["52w máx",            "fiftyTwoWeekHigh",          "ratio"],
      ["52w mín",            "fiftyTwoWeekLow",           "ratio"],
      ["Volume médio",       "averageVolume",             "big"],
    ],
  },
  {
    label: "Crescimento",
    rows: [
      ["Receita (YoY)",      "revenueGrowth",             "pct"],
      ["Lucro (YoY)",        "earningsGrowth",            "pct"],
      ["Lucro trimestral",   "earningsQuarterlyGrowth",   "pct"],
    ],
  },
];

export default async function AtivoPage({ params }: Props) {
  const { ticker: rawSlug } = await params;

  const [catalogPayload, latest, full, fundamentals] = await Promise.all([
    getMarketCatalog(),
    getMarketHistoryLatest(),
    getMarketHistoryFull(),
    getMarketFundamentals(),
  ]);

  const catalog = catalogPayload?.assets ?? [];
  const asset = findCatalogAsset(catalog, rawSlug);
  if (!asset) {
    notFound();
  }

  const tk = asset.ticker;
  const assetCurrency = asset.currency;
  const latestRow = latest?.tickers[tk] ?? null;
  // Série COMPLETA disponível (até 5 anos) — alimenta o hero chart.
  const series = full?.tickers[tk]?.series_daily ?? [];
  // Último 1y (~252 pregões) só p/ o range de 52 semanas.
  const series1y = series.slice(Math.max(0, series.length - 252));
  const fund = fundamentals?.tickers[tk] ?? null;
  const info = fund?.info ?? null;

  const last = latestRow?.last_close ?? null;
  const dayChange = latestRow?.returns["1d"] ?? null;

  // Benchmark da classe, já fatiado no servidor (nunca o JSON inteiro).
  const benchmark = pickBenchmark(asset, full, series[0]?.[0]);
  // Unidade do eixo no modo raw: índices em pontos-índice; BRL em R$; resto número puro.
  const heroUnit: AzUnit = asset.klass === "indice" ? "index" : assetCurrency === "BRL" ? "R$" : "none";

  // Range 52 semanas a partir da própria série (fallback: .info do Yahoo).
  const closes1y = series1y.map(([, v]) => v).filter((v) => Number.isFinite(v));
  const low52 = closes1y.length > 0 ? Math.min(...closes1y) : info?.fiftyTwoWeekLow ?? null;
  const high52 = closes1y.length > 0 ? Math.max(...closes1y) : info?.fiftyTwoWeekHigh ?? null;
  const range52Pct =
    last != null && low52 != null && high52 != null && high52 > low52
      ? Math.min(100, Math.max(0, ((last - low52) / (high52 - low52)) * 100))
      : null;
  const fmtPrice = (v: number) =>
    `${assetCurrency === "BRL" ? "R$ " : "US$ "}${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;

  // Peers do mesmo setor (mesma klass, mesmo sector)
  const peers = catalog
    .filter((a) => a.ticker !== tk && a.klass === asset.klass && a.sector === asset.sector)
    .slice(0, 8);

  function renderValue(key: keyof FundamentalsInfo, kind: "ratio" | "pct" | "big" | "raw"): string {
    if (!info) return "—";
    const v = info[key] as number | string | null | undefined;
    if (v == null) return "—";
    if (kind === "big") return formatBigNumber(v as number, assetCurrency);
    if (kind === "pct") return formatPctFromRatio(v as number);
    if (kind === "ratio") return formatRatio(v as number);
    return String(v);
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#027DFC]">
          Ativos de mercado · {classLabel(asset.klass)}
        </p>
        <div className="flex flex-wrap items-baseline gap-2">
          <h2 className="text-3xl font-semibold text-[#132960]">{asset.name}</h2>
          <code className="rounded bg-zinc-100 px-2 py-0.5 text-sm text-zinc-700">{asset.ticker}</code>
          <span className="rounded-full bg-[#ebf4ff] px-2 py-0.5 text-xs font-semibold text-[#027DFC]">
            {asset.sector}
          </span>
        </div>
        <p className="text-sm text-zinc-600">
          {info?.longName ?? info?.shortName ?? ""}{" "}
          {info?.industry ? <span>· {info.industry}</span> : null}
          {info?.exchange ? <span> · {info.exchange}</span> : null}
        </p>
      </header>

      {/* Hero: preço + sparkline */}
      <div className="grid gap-4 lg:grid-cols-[1fr_2fr]">
        <MarketCard
          title="Cotação"
          subtitle={latestRow ? `Última: ${latestRow.last_date}` : undefined}
          stampGiro={latest?.generated_at ?? null}
          stampDado={latestRow?.last_date ?? null}
        >
          <div>
            <p className="text-4xl font-semibold tabular-nums text-[#132960]">
              {last != null ? `${asset.currency === "BRL" ? "R$ " : "US$ "}${last.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}` : "—"}
            </p>
            <p
              className={`mt-1 text-sm font-semibold ${dayChange == null ? "text-zinc-400" : ""}`}
              style={dayChange != null ? { color: variationText(dayChange) } : undefined}
            >
              {dayChange != null ? `${fmtSignedPct(dayChange, 2)} hoje` : "—"}
            </p>
            <dl className="mt-4 grid grid-cols-2 gap-2 text-xs">
              {(["1w", "1m", "3m", "ytd", "1y", "5y"] as const).map((p) => {
                const val = latestRow?.returns[p];
                return (
                  <div key={p} className="flex items-center justify-between rounded-lg border border-[#132960]/10 px-2 py-1.5">
                    <span className="text-zinc-500 uppercase">{p}</span>
                    <span
                      className={`tabular-nums font-semibold ${val == null ? "text-zinc-400" : ""}`}
                      style={val != null ? { color: variationText(val) } : undefined}
                    >
                      {fmtSignedPct(val, 2)}
                    </span>
                  </div>
                );
              })}
            </dl>

            {/* Range 52 semanas: mín—máx com marcador da cotação atual */}
            {range52Pct != null && low52 != null && high52 != null ? (
              <div className="mt-4">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                  Range 52 semanas
                </p>
                <div
                  className="relative mt-2 h-1.5 rounded-full bg-gradient-to-r from-[#BE3B33]/25 via-zinc-200 to-[#1E8A5C]/25"
                  role="img"
                  aria-label={`Cotação atual a ${range52Pct.toFixed(0)}% do caminho entre a mínima e a máxima de 52 semanas`}
                >
                  <span
                    aria-hidden
                    className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-[#027DFC] shadow-md"
                    style={{ left: `${range52Pct}%` }}
                  />
                </div>
                <div className="mt-1.5 flex items-baseline justify-between text-[10px] tabular-nums text-zinc-500">
                  <span>
                    mín <span className="font-semibold text-[#132960]">{fmtPrice(low52)}</span>
                  </span>
                  <span>
                    máx <span className="font-semibold text-[#132960]">{fmtPrice(high52)}</span>
                  </span>
                </div>
              </div>
            ) : null}
          </div>
        </MarketCard>

        {/*
          O AzPeriodSelector (dentro do AtivoHeroChart) chama useSearchParams().
          Esta página é force-dynamic, então o Next 16 não EXIGE <Suspense>
          (o build só falha em rotas prerenderizadas estaticamente), mas
          seguimos a convenção do repo (índices-globais/câmbio/commodities) e
          envolvemos mesmo assim; o seletor roda controlado por estado local,
          sem querystring.
        */}
        <Suspense fallback={<div className="min-h-[380px] animate-pulse rounded-2xl bg-white/60" />}>
          <AtivoHeroChart
            name={asset.name}
            series={series}
            unit={heroUnit}
            benchmark={benchmark}
            stampGiro={full?.generated_at ?? null}
            stampDado={series[series.length - 1]?.[0] ?? null}
          />
        </Suspense>
      </div>

      {/* Stats */}
      <MarketCard
        title="Múltiplos e estatísticas"
        subtitle={
          info
            ? `Fonte: Yahoo Finance .info${fund?.stale ? " (dado em cache, pode estar desatualizado)" : ""}`
            : "Yahoo Finance não retornou múltiplos para este ativo."
        }
        bodyClassName="px-4 pb-4 pt-2"
        stampGiro={fundamentals?.generated_at ?? null}
        stampDado={fundamentals?.generated_at ?? null}
      >
        {!info ? (
          <div className="py-6 text-center text-sm text-zinc-500">
            Múltiplos não disponíveis no momento.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {STAT_GROUPS.map((group) => (
              <div key={group.label} className="rounded-xl border border-[#132960]/10 bg-zinc-50/50 p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">{group.label}</p>
                <dl className="space-y-1 text-sm">
                  {group.rows.map(([label, key, kind]) => (
                    <div key={String(key)} className="flex items-center justify-between border-b border-zinc-100 py-1 last:border-0">
                      <dt className="text-[#132960]">{label}</dt>
                      <dd className="font-semibold tabular-nums text-[#132960]">{renderValue(key, kind)}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
          </div>
        )}
      </MarketCard>

      {/* Peers */}
      {peers.length > 0 ? (
        <MarketCard
          title="Peers do mesmo setor"
          subtitle={`${peers.length} ativos em "${asset.sector}"`}
          stampGiro={latest?.generated_at ?? null}
          stampDado={latest?.generated_at ?? null}
        >
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {peers.map((p) => {
              const r = latest?.tickers[p.ticker]?.returns["1y"];
              return (
                <li key={p.ticker}>
                  <Link
                    href={`/painel-economico/mercado/ativo/${encodeURIComponent(p.ticker)}`}
                    className="block rounded-xl border border-[#132960]/10 bg-white p-3 hover:border-[#027DFC]"
                  >
                    <p className="text-sm font-semibold text-[#132960]">{p.name}</p>
                    <p className="text-[10px] uppercase text-zinc-500">{p.ticker}</p>
                    <p
                      className={`mt-1 text-xs font-semibold tabular-nums ${r == null ? "text-zinc-400" : ""}`}
                      style={r != null ? { color: variationText(r) } : undefined}
                    >
                      1A: {fmtSignedPct(r, 2)}
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        </MarketCard>
      ) : null}

      <div className="flex flex-wrap gap-3 text-sm">
        <Link
          href="/painel-economico/mercado"
          className="rounded-lg border border-[#132960]/20 px-3 py-1.5 font-semibold text-[#132960] hover:border-[#027DFC] hover:text-[#027DFC]"
        >
          ← Voltar para Ativos de mercado
        </Link>
        <Link
          href="/painel-economico/mercado/historico"
          className="rounded-lg border border-[#132960]/20 px-3 py-1.5 font-semibold text-[#132960] hover:border-[#027DFC] hover:text-[#027DFC]"
        >
          Comparar no histórico
        </Link>
      </div>
    </div>
  );
}
