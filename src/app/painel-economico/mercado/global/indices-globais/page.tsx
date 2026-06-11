import type { Metadata } from "next";
import { Suspense } from "react";

import { IndicesGlobaisDashboard } from "@/components/painel/indices-globais/IndicesGlobaisDashboard";
import { PipelinePendingCard } from "@/components/painel/PipelinePendingCard";
import {
  EMPTY_HISTORY_SLICE,
  getHistorySlice,
  getWorldIndicesReturnsPanorama,
} from "@/lib/painel-mercado-global";

export const metadata: Metadata = {
  title: "Índices globais — Ativos de mercado | AZ Invest",
  description:
    "Retornos das principais bolsas desenvolvidas e emergentes por período e comparativo histórico de 5 anos com rebase 100 (S&P 500, Euro Stoxx, Nikkei, Ibovespa, Hang Seng e mais).",
};

export const revalidate = 3600;

/** União dos tickers usados nos presets Desenvolvidos / Emergentes / Américas. */
const HISTORY_TICKERS = [
  { ticker: "^GSPC" },
  { ticker: "^IXIC" },
  { ticker: "^DJI" },
  { ticker: "^STOXX50E" },
  { ticker: "^FTSE" },
  { ticker: "^N225" },
  { ticker: "^BVSP" },
  { ticker: "^HSI" },
  { ticker: "000001.SS" },
];

export default async function IndicesGlobaisPage() {
  const [panorama, history] = await Promise.all([
    getWorldIndicesReturnsPanorama(),
    getHistorySlice(HISTORY_TICKERS).catch(() => EMPTY_HISTORY_SLICE),
  ]);

  const nothingLoaded = !panorama && history.series.length === 0;

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#027DFC]">
          Ativos de mercado · Global · Índices globais
        </p>
        <h2 className="text-2xl font-semibold text-[#132960]">Bolsas desenvolvidas e emergentes</h2>
        <p className="max-w-3xl text-sm text-zinc-600">
          A separação <strong>desenvolvidos × emergentes</strong> é a primeira pergunta da alocação
          global: o prêmio de risco está pagando? A tabela compara os retornos em janelas de 1 dia a
          1 ano e o gráfico de rebase 100 mostra quem acumulou mais desde o início da janela
          escolhida — incluindo o recorte das Américas com o Ibovespa contra as bolsas dos EUA.
        </p>
      </header>

      {nothingLoaded ? (
        <PipelinePendingCard
          blobPaths={["data/world_indices_returns_panorama.json", "data/market_history_full.json"]}
          workflow="data-pipeline.yml / market-data.yml"
        />
      ) : (
        <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-white/60" />}>
          <IndicesGlobaisDashboard panorama={panorama} history={history} />
        </Suspense>
      )}

      <section className="rounded-2xl border border-[#132960]/10 bg-zinc-50/50 p-4 text-xs text-zinc-600">
        <p className="font-semibold uppercase tracking-wide text-zinc-500">Notas metodológicas</p>
        <ul className="mt-2 list-disc space-y-1 pl-4">
          <li>
            <strong>Moeda local</strong>: cada índice é medido em pontos na própria moeda — retornos
            não são diretamente comparáveis em moeda comum (um DAX +10% com euro fraco rende menos em
            US$). Brasil entra na cesta do panorama via <code>EWZ</code>, ETF em dólar listado em NY.
          </li>
          <li>
            <strong>Rebase 100</strong>: todas as séries valem 100 no primeiro pregão da janela
            selecionada; a inclinação relativa compara trajetórias, não níveis de valuation.
          </li>
          <li>
            <strong>Cobertura</strong>: a tabela usa a cesta intradiária de 16 índices (giro 15 min);
            o histórico de 5 anos cobre o catálogo diário (S&amp;P 500, Nasdaq, Dow, Euro Stoxx 50,
            FTSE 100, Nikkei, Ibovespa, Hang Seng e Xangai). Fonte: Yahoo Finance.
          </li>
        </ul>
      </section>
    </div>
  );
}
