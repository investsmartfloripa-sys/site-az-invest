import Link from "next/link";

import { MethodInfo } from "@/components/painel/core/MethodInfo";
import { ComunidadeMercado } from "@/components/painel/market/ComunidadeMercado";
import { FundosRankingDashboard } from "@/components/painel/fundos-investimento/FundosRankingDashboard";
import { getFundosRanking } from "@/lib/painel-fundos-investimento-data";

export const metadata = {
  title: "Fundos de investimento — Mercado",
  description:
    "Rankings de fundos de investimento brasileiros por categoria (multimercado, ações e renda fixa): retorno, volatilidade, Sharpe e drawdown. Fonte: Mais Retorno (D-1).",
};

// ISR: dados vêm do Blob (loader degrada para null se o JSON não existir ainda).
export const revalidate = 3600;

/** Dado com mais de 10 dias: a página avisa no topo em vez de exibir números velhos como se fossem de hoje. */
const DIAS_PARA_AVISO = 10;

function dataBR(iso: string): string {
  return iso.slice(0, 10).split("-").reverse().join("/");
}

function diasDesde(iso: string): number {
  return (Date.now() - new Date(iso).getTime()) / 86_400_000;
}

export default async function FundosInvestimentoPage() {
  const ranking = await getFundosRanking();
  const dataDado = ranking?.data_date ?? ranking?.generated_at ?? null;
  const diasDoDado = dataDado ? diasDesde(dataDado) : 0;

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#027DFC]">
          Mercado · Brasil · Fundos de investimento
        </p>
        <h1 className="text-2xl font-semibold text-[#132960]">
          Rankings de fundos por categoria
          <MethodInfo className="ml-1.5 align-middle">
            Fonte: <strong>Mais Retorno</strong>, atualizada após o fechamento (D-1).
          </MethodInfo>
        </h1>
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

      {dataDado && diasDoDado > DIAS_PARA_AVISO ? (
        <p className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <strong>Dados de {dataBR(dataDado)}.</strong> A atualização automática desta aba está suspensa; os
          números abaixo não refletem o mercado de hoje.
        </p>
      ) : null}

      {ranking && ranking.status === "ok" && ranking.categories?.length ? (
        <FundosRankingDashboard data={ranking} />
      ) : (
        <section className="rounded-2xl border border-dashed border-[#132960]/20 bg-zinc-50/60 p-8 text-center">
          <p className="text-sm font-semibold text-[#132960]">Dados em preparação</p>
          <p className="mx-auto mt-1 max-w-md text-xs text-zinc-500">
            O ranking de fundos ainda está sendo montado. Assim que os dados chegarem, esta página
            mostra as tabelas por categoria automaticamente.
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
            <strong>Métricas</strong>: retorno acumulado por janela (3M, 6M, YTD e 1A),
            volatilidade anualizada, índice de Sharpe e máximo drawdown — todos da{" "}
            <strong>Mais Retorno</strong>, com dados de fechamento (D-1).
          </li>
          <li>
            <strong>Sharpe</strong>: usa o CDI como ativo livre de risco. Sharpe negativo significa
            retorno abaixo do CDI naquela janela, mesmo que o retorno absoluto seja positivo.
          </li>
          <li>
            <strong>Histórico</strong>: as janelas vão até 1 ano; Sharpe e volatilidade de 3 a 5 anos
            ainda não estão disponíveis.
          </li>
        </ul>
        <p className="mt-2 text-[10px] text-zinc-500">Conteúdo informativo. Não é recomendação de investimento.</p>
      </section>

      <ComunidadeMercado assunto="fundos de investimento" origem="PAINEL_FUNDOS" />
    </div>
  );
}
