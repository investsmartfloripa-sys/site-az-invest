import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { AtivoHeroChart, type AtivoHeroBenchmark } from "@/components/painel/market/AtivoHeroChart";
import { FundoKpis } from "@/components/painel/fundos-investimento/FundoKpis";
import { getFundoDetail, type QuoteSeries } from "@/lib/painel-fundos-investimento-data";

type Props = {
  params: Promise<{ slug: string }>;
};

// ISR: dados vêm do Blob (loaders degradam para null). Sem generateStaticParams
// nem <Suspense> — o AzPeriodSelector dentro do AtivoHeroChart roda controlado
// por estado local; um boundary aqui quebraria a hidratação (Next 16.2.4).
export const revalidate = 3600;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const detail = await getFundoDetail(slug);
  if (!detail) return { title: "Fundo — Ativos de mercado" };
  return {
    title: `${detail.fund.nome} — Fundo de Investimento`,
    description: `Cota histórica vs CDI, retorno, Sharpe, volatilidade e drawdown do fundo ${detail.fund.nome} (${detail.fund.gestora ?? ""}). Fonte: Mais Retorno (D-1).`,
  };
}

/** CDI fatiado ao range da série do fundo (rebase 100 é feito no chart). */
function buildBenchmarks(cdiSeries: QuoteSeries, fundFirstDate: string | undefined): AtivoHeroBenchmark[] {
  if (cdiSeries.length < 2) return [];
  const windowed = fundFirstDate ? cdiSeries.filter(([d]) => d >= fundFirstDate) : cdiSeries;
  if (windowed.length < 2) return [];
  return [{ ticker: "CDI", label: "CDI", series: windowed }];
}

export default async function FundoDetailPage({ params }: Props) {
  const { slug } = await params;
  const detail = await getFundoDetail(slug);
  if (!detail) notFound();

  const { fund, categoria, series, cdiSeries, generatedAt, dataDate, cdi } = detail;
  const benchmarks = buildBenchmarks(cdiSeries, series[0]?.[0]);
  const hasSeries = series.length > 1;

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#027DFC]">
          Ativos de mercado · Brasil · Fundos de Investimento · {categoria.label}
        </p>
        <div className="flex flex-wrap items-baseline gap-3">
          <h2 className="text-2xl font-semibold text-[#132960]">{fund.nome}</h2>
          <span className="text-sm text-zinc-500">{fund.gestora ?? ""}</span>
        </div>
        <Link
          href="/painel-economico/mercado/brasil/fundos-investimento"
          className="inline-block text-xs font-semibold text-[#027DFC] hover:underline"
        >
          ← Voltar aos rankings de fundos
        </Link>
      </header>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        {hasSeries ? (
          <AtivoHeroChart
            name={`Cota · ${fund.nome}`}
            series={series}
            unit="R$"
            benchmarks={benchmarks}
            stampGiro={generatedAt ?? null}
            stampDado={series[series.length - 1]?.[0] ?? dataDate}
          />
        ) : (
          <section className="flex min-h-[280px] items-center justify-center rounded-2xl border border-dashed border-[#132960]/20 bg-zinc-50/60 p-6 text-center">
            <p className="max-w-xs text-xs text-zinc-500">
              Série de cota deste fundo em preparação. As métricas abaixo já refletem os dados mais
              recentes.
            </p>
          </section>
        )}

        <div className="rounded-2xl border border-[#132960]/15 bg-white p-4 shadow-sm">
          <FundoKpis fund={fund} cdi={cdi} />
        </div>
      </div>

      <section className="rounded-2xl border border-[#132960]/10 bg-white p-4 text-xs text-zinc-600">
        <p className="font-semibold uppercase tracking-wide text-zinc-500">Notas metodológicas</p>
        <ul className="mt-2 space-y-1 list-disc pl-4">
          <li>
            <strong>Cota e métricas</strong>: <strong>Mais Retorno</strong> (Data API), dados de
            fechamento (D-1). CNPJ <code>{fund.cnpj ?? "—"}</code>.
          </li>
          <li>
            <strong>Gráfico</strong>: ative o <strong>CDI</strong> no botão de comparar para ver a
            trajetória rebaseada em 100 (cota × CDI valem 100 no início da janela).
          </li>
          <li>
            <strong>Sharpe e a cor do retorno</strong> usam o CDI como ativo livre de risco. No plano
            atual o histórico vai até ~12 meses.
          </li>
        </ul>
        <p className="mt-2 text-[10px] text-zinc-400">Conteúdo informativo. Não é recomendação de investimento.</p>
      </section>
    </div>
  );
}
