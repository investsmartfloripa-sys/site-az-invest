import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { FiiDetailDividends } from "@/components/painel/fii/FiiDetailDividends";
import { FiiDetailFicha } from "@/components/painel/fii/FiiDetailFicha";
import { FiiDetailHero } from "@/components/painel/fii/FiiDetailHero";
import { FiiDetailIndicators } from "@/components/painel/fii/FiiDetailIndicators";
import { FiiDetailRelacionados } from "@/components/painel/fii/FiiDetailRelacionados";
import { getFiiDetail } from "@/lib/painel-fii";

type Props = {
  params: Promise<{ ticker: string }>;
};

// Render dinâmico — o JSON de detalhes pesa ~4,6 MB e o cache ISR estava
// servindo páginas vazias pra tickers que não foram pré-renderizados no build.
// SSR puro garante que cada request vê o JSON atualizado no Blob.
export const dynamic = "force-dynamic";

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

export default async function FiiDetailPage({ params }: Props) {
  const { ticker } = await params;
  const upper = ticker.toUpperCase();
  const entry = await getFiiDetail(upper);
  if (!entry) notFound();

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

      <FiiDetailHero entry={entry} />
      <FiiDetailIndicators indicators={entry.indicators} />
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
