export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";

import { MarketCard } from "@/components/painel/market/MarketCard";
import { TickerSparkline } from "@/components/painel/market/TickerSparkline";
import {
  classLabel,
  formatBigNumber,
  formatPct,
  formatPctFromRatio,
  formatRatio,
  getMarketCatalog,
  getMarketFundamentals,
  getMarketHistoryFull,
  getMarketHistoryLatest,
  type CatalogAsset,
  type FundamentalsInfo,
} from "@/lib/painel-market-data";

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
      ["DY 5 anos médio",    "fiveYearAvgDividendYield",  "ratio"],
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
  const series = full?.tickers[tk]?.series_daily ?? [];
  // Pega 1y de série (~252 pregões) pro sparkline
  const series1y = series.slice(Math.max(0, series.length - 252));
  const fund = fundamentals?.tickers[tk] ?? null;
  const info = fund?.info ?? null;

  const last = latestRow?.last_close ?? null;
  const dayChange = latestRow?.returns["1d"] ?? null;
  const positive = (dayChange ?? 0) >= 0;

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
        <MarketCard title="Cotação" subtitle={latestRow ? `Última: ${latestRow.last_date}` : undefined}>
          <div>
            <p className="text-4xl font-semibold tabular-nums text-[#132960]">
              {last != null ? `${asset.currency === "BRL" ? "R$ " : "US$ "}${last.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}` : "—"}
            </p>
            <p className={`mt-1 text-sm font-semibold ${positive ? "text-[#16A34A]" : "text-[#DC2626]"}`}>
              {dayChange != null ? `${positive ? "▲" : "▼"} ${formatPct(dayChange)} hoje` : "—"}
            </p>
            <dl className="mt-4 grid grid-cols-2 gap-2 text-xs">
              {(["1w", "1m", "3m", "ytd", "1y", "5y"] as const).map((p) => {
                const val = latestRow?.returns[p];
                const pos = (val ?? 0) >= 0;
                return (
                  <div key={p} className="flex items-center justify-between rounded-lg border border-[#132960]/10 px-2 py-1.5">
                    <span className="text-zinc-500 uppercase">{p}</span>
                    <span className={`tabular-nums font-semibold ${pos ? "text-[#16A34A]" : "text-[#DC2626]"}`}>
                      {formatPct(val)}
                    </span>
                  </div>
                );
              })}
            </dl>
          </div>
        </MarketCard>

        <MarketCard title="Histórico 1 ano" subtitle="Preço bruto (close ajustado)">
          {series1y.length > 1 ? (
            <TickerSparkline series={series1y} positive={positive} height={180} />
          ) : (
            <div className="py-10 text-center text-sm text-zinc-500">
              Sem série histórica disponível para este ativo.
            </div>
          )}
        </MarketCard>
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
        <MarketCard title="Peers do mesmo setor" subtitle={`${peers.length} ativos em "${asset.sector}"`}>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {peers.map((p) => {
              const r = latest?.tickers[p.ticker]?.returns["1y"];
              const pos = (r ?? 0) >= 0;
              return (
                <li key={p.ticker}>
                  <Link
                    href={`/painel-economico/mercado/ativo/${encodeURIComponent(p.name)}`}
                    className="block rounded-xl border border-[#132960]/10 bg-white p-3 hover:border-[#027DFC]"
                  >
                    <p className="text-sm font-semibold text-[#132960]">{p.name}</p>
                    <p className="text-[10px] uppercase text-zinc-500">{p.ticker}</p>
                    <p className={`mt-1 text-xs font-semibold tabular-nums ${pos ? "text-[#16A34A]" : "text-[#DC2626]"}`}>
                      1A: {formatPct(r)}
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
