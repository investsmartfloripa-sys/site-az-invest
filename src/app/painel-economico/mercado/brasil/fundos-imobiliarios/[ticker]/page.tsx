import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { FiiDetailDividends } from "@/components/painel/fii/FiiDetailDividends";
import { FiiDetailFicha } from "@/components/painel/fii/FiiDetailFicha";
import { FiiDetailIndicators } from "@/components/painel/fii/FiiDetailIndicators";
import { FiiDetailRelacionados } from "@/components/painel/fii/FiiDetailRelacionados";
import { FiiQuoteCard } from "@/components/painel/fii/FiiQuoteCard";
import { AtivoHeroChart, type AtivoHeroBenchmark } from "@/components/painel/market/AtivoHeroChart";
import { getFiiDetail, getFiiDetailWithMeta, getFiiIfix, type FiiIfixData } from "@/lib/painel-fii";

type Props = {
  params: Promise<{ ticker: string }>;
};

// Render dinâmico — o JSON de detalhes pesa ~4,6 MB e o cache ISR estava
// servindo páginas vazias pra tickers que não foram pré-renderizados no build.
// SSR puro garante que cada request vê o JSON atualizado no Blob.
// ISR: dados vêm do Blob com loaders guardados (degradam para null); ver plano AVALIACAO-GERAL §6.
export const revalidate = 3600;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { ticker } = await params;
  const entry = await getFiiDetail(ticker);
  if (!entry) {
    return { title: `${ticker.toUpperCase()} — Fundo Imobiliário | AZ Invest` };
  }
  return {
    title: `${entry.ticker} — ${entry.ficha.full_name || "Fundo Imobiliário"} | AZ Invest`,
    description: `Cotação, dividendos, P/VP, patrimônio e ficha cadastral do FII ${entry.ticker}.`,
  };
}

// `generateStaticParams` removido junto com `dynamic = "force-dynamic"`.
// O `getFiiTickers` ainda existe pro caso de voltarmos pro pré-render quando
// migrar pra um JSON menor (índice + entries on-demand).

/**
 * Benchmark do toggle "Comparar" do card de Histórico (AtivoHeroChart).
 *
 * O AtivoHeroChart é compartilhado com a página de ativo de ações e aceita UM
 * único benchmark (toggle Nenhum/<benchmark>). O FII tem dois candidatos no
 * fii_ifix.json (IFIX e CDI), mas escolhemos o **IFIX** — é o índice da classe,
 * a comparação que o leitor de FII faz por padrão ("bati o IFIX?"). O CDI fica
 * de fora desta versão do topo por limitação de 1 benchmark do componente
 * reusado (segue disponível em outras telas).
 *
 * Fatia NO SERVIDOR ao range da cotação do FII (nunca manda série além do
 * necessário; o rebase 100 da janela é feito no chart). Se o JSON falhar ou o
 * IFIX não tiver pontos suficientes, retorna null e o toggle some.
 */
function buildHeroBenchmark(
  ifixData: FiiIfixData | null,
  fiiFirstDate: string | undefined,
): AtivoHeroBenchmark | null {
  if (!ifixData || ifixData.status !== "ok" || ifixData.series_daily.length < 2) return null;
  const windowed = fiiFirstDate
    ? ifixData.series_daily.filter((p) => p.date >= fiiFirstDate)
    : ifixData.series_daily;
  const ifix = windowed.flatMap((p) =>
    Number.isFinite(p.ifix) ? [[p.date, p.ifix] as const] : [],
  );
  if (ifix.length < 2) return null;
  return { ticker: "IFIX", label: "IFIX", series: ifix };
}

export default async function FiiDetailPage({ params }: Props) {
  const { ticker } = await params;
  const upper = ticker.toUpperCase();
  const [detail, ifixData] = await Promise.all([getFiiDetailWithMeta(upper), getFiiIfix()]);
  if (!detail) notFound();
  const { entry, generatedAt } = detail;
  const benchmark = buildHeroBenchmark(ifixData, entry.price_series_daily[0]?.date);
  // Série de cota no formato [ISO, close] esperado pelo AtivoHeroChart.
  const priceSeries = entry.price_series_daily.map((p) => [p.date, p.close] as const);

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#027DFC]">
          Ativos de mercado · Brasil · Fundos Imobiliários
        </p>
        <div className="flex flex-wrap items-baseline gap-3">
          <h2 className="text-2xl font-semibold text-[#132960]">{entry.ticker}</h2>
          <span className="text-sm text-zinc-500">{entry.ficha.full_name || entry.name}</span>
        </div>
        <Link
          href="/painel-economico/mercado/brasil/fundos-imobiliarios"
          className="inline-block text-xs font-semibold text-[#027DFC] hover:underline"
        >
          ← Voltar ao Panorama FIIs
        </Link>
      </header>

      {/*
        Topo no formato da página de ativo de ações: dois cards lado a lado
        (lg:grid-cols-[1fr_2fr]) — à esquerda a Cotação com os indicadores
        padrão do FII, à direita o Histórico (AtivoHeroChart reusado, variant
        hero sombreado, seletor de período e comparação com o IFIX).
      */}
      <div className="grid gap-4 lg:grid-cols-[1fr_2fr]">
        <FiiQuoteCard entry={entry} generatedAt={generatedAt} />

        {/*
          O AzPeriodSelector (dentro do AtivoHeroChart) chama useSearchParams().
          A rota é ISR (revalidate) — o <Suspense> é obrigatório no prerender —
          e também é a convenção do repo (página de ativo, índices, câmbio);
          o seletor roda controlado por estado local.
        */}
        <Suspense fallback={<div className="min-h-[380px] animate-pulse rounded-2xl bg-white/60" />}>
          <AtivoHeroChart
            name={`Cotação · ${entry.ticker}`}
            series={priceSeries}
            unit="R$"
            benchmark={benchmark}
            stampGiro={generatedAt ?? null}
            stampDado={priceSeries[priceSeries.length - 1]?.[0] ?? entry.hero.price_date}
          />
        </Suspense>
      </div>

      <FiiDetailIndicators indicators={entry.indicators} generatedAt={generatedAt} />
      <FiiDetailDividends dividends={entry.dividends} />
      <FiiDetailFicha ticker={entry.ticker} ficha={entry.ficha} />
      <FiiDetailRelacionados />

      <section className="rounded-2xl border border-[#132960]/10 bg-white p-4 text-xs text-zinc-600">
        <p className="font-semibold uppercase tracking-wide text-zinc-500">Notas metodológicas</p>
        <ul className="mt-2 space-y-1 list-disc pl-4">
          <li>
            <strong>Cotação, dividendos, máx/mín 12m, DY 12m</strong>: yfinance (B3 via Yahoo
            Finance) usando o ticker <code>{entry.ticker}.SA</code>.
          </li>
          <li>
            <strong>PL, Valor Patrimonial por cota, nº de cotistas</strong>: CVM Dados Abertos —
            Informe Mensal FII <code>inf_mensal_fii_complemento</code> (defasagem ~30 dias após o
            mês de referência).
          </li>
          <li>
            <strong>CNPJ, administrador, segmento</strong>: CVM Informe Mensal{" "}
            <code>inf_mensal_fii_geral</code> + override de segmento curado (Papel/Logística/Lajes/
            Shoppings/etc.) — corrige a categoria genérica "Multicategoria" da CVM.
          </li>
          <li>
            <strong>DY CAGR 3a</strong>: taxa anualizada equivalente da soma anual de dividendos
            entre o último ano cheio e 3 anos antes.
          </li>
          <li>
            <strong>Valor CAGR 3a</strong>: variação anualizada da cotação price-only (sem
            reinvestimento de dividendos) nos últimos 3 anos.
          </li>
          <li>
            <strong>Participação no IFIX</strong>: B3 <code>GetPortfolioDay</code> (carteira teórica
            diária do índice).
          </li>
        </ul>
      </section>
    </div>
  );
}
