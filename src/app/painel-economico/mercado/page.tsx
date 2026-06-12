import Link from "next/link";

import { MarketCard } from "@/components/painel/market/MarketCard";
import { MarketOverviewTable } from "@/components/painel/market/MarketOverviewTable";
import { TickerSparkline } from "@/components/painel/market/TickerSparkline";
import {
  formatPct,
  getMarketCatalog,
  getMarketHistoryFull,
  getMarketHistoryLatest,
  type TickerLatest,
} from "@/lib/painel-market-data";

export const metadata = {
  title: "Ativos de mercado — Painel econômico | AZ Invest",
  description:
    "Visão completa dos ativos de mercado: retornos por classe, histórico comparativo, múltiplos fundamentalistas e páginas individuais por ativo.",
};

const HERO_TICKERS = [
  { ticker: "^BVSP",  label: "Ibovespa" },
  { ticker: "BRL=X",  label: "USD/BRL" },
  { ticker: "^GSPC",  label: "S&P 500" },
  { ticker: "BTC-USD", label: "Bitcoin" },
];

function HeroCard({
  label,
  ticker,
  latest,
  series,
  currencyHint,
}: {
  label: string;
  ticker: string;
  latest: TickerLatest | null;
  series: Array<[string, number]> | null;
  currencyHint: "BRL" | "USD" | "";
}) {
  const dayChange = latest?.returns["1d"] ?? null;
  const positive = (dayChange ?? 0) >= 0;
  const cur = currencyHint || latest?.currency || "";
  const symbol = cur === "BRL" ? "R$ " : cur === "USD" ? "US$ " : "";
  return (
    <article className="rounded-2xl border border-[#132960]/15 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-[#132960]">
        {latest?.last_close != null
          ? `${symbol}${latest.last_close.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`
          : "—"}
      </p>
      <p className={`text-xs font-semibold ${positive ? "text-[#16A34A]" : "text-[#DC2626]"}`}>
        {dayChange != null ? `${positive ? "▲" : "▼"} ${formatPct(dayChange)} hoje` : "—"}
      </p>
      <div className="mt-2">
        {series && series.length > 1 ? (
          <TickerSparkline series={series.slice(Math.max(0, series.length - 252))} positive={positive} height={50} />
        ) : (
          <div className="h-[50px]" />
        )}
      </div>
      <Link
        href={`/painel-economico/mercado/ativo/${encodeURIComponent(ticker)}`}
        className="mt-2 inline-block text-[11px] font-semibold text-[#027DFC] hover:underline"
      >
        Abrir ativo →
      </Link>
    </article>
  );
}

// ISR: dados vêm do Blob com loaders guardados (degradam para null); ver plano AVALIACAO-GERAL §6.
export const revalidate = 3600;

export default async function MercadoOverviewPage() {
  const [catalog, latest, full] = await Promise.all([
    getMarketCatalog(),
    getMarketHistoryLatest(),
    getMarketHistoryFull(),
  ]);

  const heroData = HERO_TICKERS.map((h) => ({
    label: h.label,
    ticker: h.ticker,
    latest: latest?.tickers[h.ticker] ?? null,
    series: full?.tickers[h.ticker]?.series_daily ?? null,
  }));

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#027DFC]">Painel econômico</p>
        <h2 className="text-2xl font-semibold text-[#132960]">Ativos de mercado</h2>
        <p className="max-w-3xl text-sm text-zinc-600">
          Visão completa de ações, ETFs, índices, câmbio, commodities e cripto. A tabela abaixo lista os
          retornos por classe em diferentes horizontes; abra cada ativo para múltiplos, peers e histórico
          longo. Para análises cruzadas, use as ferramentas de{" "}
          <Link href="/painel-economico/mercado/historico" className="underline hover:text-[#027DFC]">
            histórico comparativo
          </Link>{" "}
          e{" "}
          <Link href="/painel-economico/mercado/fundamentos" className="underline hover:text-[#027DFC]">
            fundamentos
          </Link>
          .
        </p>
      </header>

      {/* Hero */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {heroData.map((h) => (
          <HeroCard
            key={h.ticker}
            label={h.label}
            ticker={h.ticker}
            latest={h.latest}
            series={h.series}
            currencyHint={h.ticker.endsWith(".SA") || h.ticker === "^BVSP" || h.ticker === "BRL=X" ? "BRL" : "USD"}
          />
        ))}
      </div>

      {/* Atalhos pras ferramentas */}
      <div className="grid gap-3 md:grid-cols-2">
        <Link
          href="/painel-economico/mercado/historico"
          className="block rounded-2xl border border-[#132960]/15 bg-white p-4 shadow-sm transition hover:border-[#027DFC]"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-[#027DFC]">Ferramenta</p>
          <h3 className="mt-1 text-lg font-semibold text-[#132960]">Histórico comparativo</h3>
          <p className="mt-1 text-sm text-zinc-600">
            Compare até 8 ativos lado a lado em janelas de 1M a 5A com rebase 100, % acumulada ou preço bruto.
          </p>
        </Link>
        <Link
          href="/painel-economico/mercado/fundamentos"
          className="block rounded-2xl border border-[#132960]/15 bg-white p-4 shadow-sm transition hover:border-[#027DFC]"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-[#027DFC]">Ferramenta</p>
          <h3 className="mt-1 text-lg font-semibold text-[#132960]">Fundamentos e múltiplos</h3>
          <p className="mt-1 text-sm text-zinc-600">
            Screener com P/L, P/VP, EV/EBITDA, ROE, dividend yield. Heatmap de mediana por setor.
          </p>
        </Link>
      </div>

      {!latest ? (
        <MarketCard title="Aguardando dados">
          <p className="text-sm text-zinc-600">
            O pipeline diário ainda não publicou os JSONs em <code>data/market_*.json</code>. Rode o workflow
            <code className="mx-1 rounded bg-zinc-100 px-1">market-data</code> via GitHub Actions e refaça
            deploy. Em ambientes de preview sem variáveis de Blob, a página fica vazia.
          </p>
        </MarketCard>
      ) : (
        <MarketOverviewTable catalog={catalog?.assets ?? []} latest={latest} />
      )}
    </div>
  );
}
