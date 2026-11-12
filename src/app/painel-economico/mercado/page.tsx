import Link from "next/link";

import { MarketCard } from "@/components/painel/market/MarketCard";
import { MarketOverviewTable } from "@/components/painel/market/MarketOverviewTable";
import { TickerSparkline } from "@/components/painel/market/TickerSparkline";
import { AZ_NEUTRAL_BAND, variationText } from "@/lib/az-chart-theme";
import { fmtSignedPct } from "@/lib/format-br";
import {
  formatQuote,
  getMarketCatalog,
  getMarketHistoryFull,
  getMarketHistoryLatest,
  type TickerLatest,
} from "@/lib/painel-market-data";

export const metadata = {
  title: "Mercado — Painel econômico",
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
}: {
  label: string;
  ticker: string;
  latest: TickerLatest | null;
  series: Array<[string, number]> | null;
}) {
  const dayChange = latest?.returns["1d"] ?? null;
  // Mesma régua da tabela: dentro da banda neutra (±0,03%) é "no zero" — azul, sem seta.
  const neutro = dayChange != null && Math.abs(dayChange) < AZ_NEUTRAL_BAND;
  const positive = (dayChange ?? 0) >= 0;
  const seta = dayChange == null || neutro ? "" : positive ? "▲ " : "▼ ";
  return (
    <article className="rounded-2xl border border-[#132960]/15 bg-white p-3 shadow-sm sm:p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 sm:text-xs">{label}</p>
      <p className="mt-1 text-base font-semibold tabular-nums text-[#132960] sm:text-2xl">
        {latest ? formatQuote(latest.last_close, latest) : "—"}
      </p>
      <p
        className="text-xs font-semibold tabular-nums"
        style={dayChange != null ? { color: variationText(dayChange) } : undefined}
      >
        {dayChange != null ? `${seta}${fmtSignedPct(dayChange, 2)} hoje` : "—"}
      </p>
      <div className="mt-2">
        {series && series.length > 1 ? (
          <TickerSparkline series={series.slice(Math.max(0, series.length - 252))} positive={positive} height={40} />
        ) : (
          <div className="h-[40px]" />
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
        <h1 className="text-2xl font-semibold text-[#132960]">Mercado</h1>
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

      {/* Hero — 2×2 no celular (empilhados, ocupavam quase duas telas) */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {heroData.map((h) => (
          <HeroCard
            key={h.ticker}
            label={h.label}
            ticker={h.ticker}
            latest={h.latest}
            series={h.series}
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
            As cotações ainda não foram carregadas. Volte em alguns minutos.
          </p>
        </MarketCard>
      ) : (
        <MarketOverviewTable catalog={catalog?.assets ?? []} latest={latest} />
      )}
    </div>
  );
}
