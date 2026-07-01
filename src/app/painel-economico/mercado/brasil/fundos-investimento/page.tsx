import Link from "next/link";

import { MethodInfo } from "@/components/painel/core/MethodInfo";
import { FundosRankingDashboard } from "@/components/painel/fundos-investimento/FundosRankingDashboard";
import { getFundosRanking } from "@/lib/painel-fundos-investimento-data";

export const metadata = {
  title: "Fundos de Investimento — Ativos de mercado",
  description:
    "Rankings de fundos de investimento brasileiros por categoria (multimercado, ações e renda fixa): retorno, volatilidade, Sharpe e drawdown. Fonte: Mais Retorno (D-1).",
};

// ISR: dados vêm do Blob (loader degrada para null se o JSON não existir ainda).
export const revalidate = 3600;

export default async function FundosInvestimentoPage() {
  const ranking = await getFundosRanking();

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#027DFC]">
          Ativos de mercado · Brasil · Fundos de Investimento
        </p>
        <h2 className="text-2xl font-semibold text-[#132960]">
          Rankings de fundos por categoria
          <MethodInfo className="ml-1.5 align-middle">
            Fonte: <strong>Mais Retorno</strong>, atualizada após o fechamento (D-1).
          </MethodInfo>
        </h2>
        <p className="max-w-3xl text-sm text-zinc-600">
          Compare os fundos de um universo curado por categoria (multimercado, ações e renda fixa)
          pelo retorno em diferentes janelas, pela volatilidade e pelo <strong>Sharpe vs CDI</strong>.
          Para a bolsa, veja também{" "}
          <Link href="/painel-economico/mercado/brasil/renda-variavel" className="underline hover:text-[#027DFC]">
            Ibovespa
          </Link>
          .
        </p>
      </header>

      {ranking && ranking.status === "ok" && ranking.categories?.length ? (
        <FundosRankingDashboard data={ranking} />
      ) : (
        <section className="rounded-2xl border border-dashed border-[#132960]/20 bg-zinc-50/60 p-8 text-center">
          <p className="text-sm font-semibold text-[#132960]">Dados em preparação</p>
          <p className="mx-auto mt-1 max-w-md text-xs text-zinc-500">
            O ranking de fundos está sendo gerado pela primeira carga do pipeline Mais Retorno. Assim
            que o arquivo estiver no ar, esta página exibe as tabelas por categoria automaticamente.
          </p>
        </section>
      )}

      <section className="rounded-2xl border border-[#132960]/10 bg-zinc-50/50 p-4 text-xs text-zinc-600">
        <p className="font-semibold uppercase tracking-wide text-zinc-500">Notas metodológicas</p>
        <ul className="mt-2 space-y-1 list-disc pl-4">
          <li>
            <strong>Universo</strong>: lista curada de fundos relevantes por categoria — não é o
            screener completo da base CVM. A lista é expandida ao longo do tempo.
          </li>
          <li>
            <strong>Métricas</strong>: retorno acumulado por janela (3M, 6M, no ano, 12M),
            volatilidade anualizada, índice de Sharpe e máximo drawdown — todos via{" "}
            <strong>Mais Retorno Data API</strong>, com dados de fechamento (D-1).
          </li>
          <li>
            <strong>Sharpe</strong>: usa o CDI como ativo livre de risco. Sharpe negativo significa
            retorno abaixo do CDI naquela janela, mesmo que o retorno absoluto seja positivo.
          </li>
          <li>
            <strong>Histórico</strong>: no plano atual, as janelas vão até 12 meses. Track records
            mais longos (Sharpe/volatilidade de 3–5 anos) são liberados em plano superior.
          </li>
        </ul>
        <p className="mt-2 text-[10px] text-zinc-400">Conteúdo informativo. Não é recomendação de investimento.</p>
      </section>
    </div>
  );
}
