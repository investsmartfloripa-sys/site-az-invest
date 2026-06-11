import type { Metadata } from "next";
import { Suspense } from "react";

import { CorridaDoAno } from "@/components/painel/indices-globais/CorridaDoAno";
import { buildLeituraValuation, buildMancheteDoDia } from "@/components/painel/indices-globais/narrativa";
import { RegioesHeatstrips } from "@/components/painel/indices-globais/RegioesHeatstrips";
import { RelogioMercados } from "@/components/painel/indices-globais/RelogioMercados";
import { TabelaCompleta } from "@/components/painel/indices-globais/TabelaCompleta";
import { ValuationEuaSection } from "@/components/painel/indices-globais/ValuationEuaSection";
import { PipelinePendingCard } from "@/components/painel/PipelinePendingCard";
import { DashboardScaffold, type DashboardBloco } from "@/components/painel/core";
import { fmtDataBR } from "@/lib/format-br";
import {
  EMPTY_HISTORY_SLICE,
  getGlobalValuation,
  getHistorySlice,
  getWorldIndicesReturnsPanorama,
  hojeIsoBrasilia,
} from "@/lib/painel-mercado-global";

export const metadata: Metadata = {
  title: "Índices globais — O dia dos mercados | AZ Invest",
  description:
    "A história do dia dos mercados globais: manchete gerada dos retornos por região, relógio das praças de Tóquio a Nova York, fotografia por região em 5 janelas, corrida do ano (rebase 100) e termômetro de valuation dos EUA.",
};

export const revalidate = 3600;

/** União dos tickers usados nos pelotões Desenvolvidos / Emergentes / Américas. */
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

/**
 * Índices globais como NARRATIVA: a página conta a história do dia dos
 * mercados — manchete em prosa (regras em indices-globais/narrativa.ts),
 * relógio das praças, fotografia por região, corrida do ano e termômetro de
 * valuation — no mesmo DNA do Painel IPCA (leitura rápida em cima,
 * esmiuçamento profissional abaixo).
 */
export default async function IndicesGlobaisPage() {
  const [panorama, history, valuation] = await Promise.all([
    getWorldIndicesReturnsPanorama(),
    getHistorySlice(HISTORY_TICKERS).catch(() => EMPTY_HISTORY_SLICE),
    getGlobalValuation(),
  ]);

  const nothingLoaded = !panorama && history.series.length === 0;

  // ── Camada narrativa (gerada por regra — nunca ad-hoc) ────────────────────
  const manchete = buildMancheteDoDia(panorama, hojeIsoBrasilia());
  const leituraValuation = buildLeituraValuation(valuation);

  // Retornos 1d por ticker p/ o relógio (objeto plano, serializável p/ client).
  const retornos1d: Record<string, number | null> = {};
  for (const r of panorama?.by_period?.["1d"]?.data ?? []) {
    if (!r?.ticker) continue;
    retornos1d[r.ticker] =
      typeof r.return_pct === "number" && Number.isFinite(r.return_pct) ? r.return_pct : null;
  }

  if (nothingLoaded) {
    return (
      <div className="space-y-6">
        <header className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#027DFC]">
            Ativos de mercado · Global · Índices globais
          </p>
          <h2 className="text-2xl font-semibold text-[#132960]">O dia dos mercados globais</h2>
        </header>
        <PipelinePendingCard
          blobPaths={["data/world_indices_returns_panorama.json", "data/market_history_full.json"]}
          workflow="data-pipeline.yml / market-data.yml"
        />
      </div>
    );
  }

  // ── Blocos numerados (esmiuçamento abaixo da leitura rápida) ──────────────
  const blocos: DashboardBloco[] = [
    {
      id: "regioes",
      eyebrow: "O mundo por região",
      titulo: "Américas, Europa e Ásia-Pacífico",
      descricao:
        "Cada praça com as cinco janelas (1D a 1A) em mapa de calor — o dia no contexto da semana, do trimestre e do ano.",
      children: panorama ? (
        <RegioesHeatstrips panorama={panorama} />
      ) : (
        <PipelinePendingCard blobPaths={["data/world_indices_returns_panorama.json"]} workflow="data-pipeline.yml" />
      ),
    },
    {
      id: "corrida-do-ano",
      eyebrow: "Quem acumula mais",
      titulo: "Corrida do ano",
      descricao:
        "Rebase 100: todas as bolsas partem do mesmo ponto e o gráfico mostra quem abriu vantagem — título gerado do acumulado do ano.",
      children:
        history.series.length > 0 ? (
          // Suspense exigido pelo useSearchParams do AzPeriodSelector em rota prerenderizada
          <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-white/60" />}>
            <CorridaDoAno history={history} />
          </Suspense>
        ) : (
          <PipelinePendingCard blobPaths={["data/market_history_full.json"]} workflow="market-data.yml" />
        ),
    },
    {
      id: "termometro-valuation",
      eyebrow: "Termômetro de valuation",
      titulo: "O mercado americano está caro ou barato?",
      descricao:
        "Três réguas clássicas — P/L corrente do S&P 500 (via SPY), CAPE de Shiller e indicador Buffett — cada uma contra a própria média histórica e banda de ±1σ: a pergunta certa é a distância da média, não o número absoluto.",
      children: valuation ? (
        <div className="space-y-3">
          {leituraValuation ? (
            <p className="rounded-xl border-l-4 border-[#FF5713] bg-white p-3 pl-4 text-sm leading-relaxed text-zinc-800 shadow-sm">
              {leituraValuation}
            </p>
          ) : null}
          {/* Suspense exigido pelo useSearchParams dos seletores em rota prerenderizada */}
          <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-white/60" />}>
            <ValuationEuaSection data={valuation} />
          </Suspense>
        </div>
      ) : (
        <PipelinePendingCard blobPaths={["data/global_valuation.json"]} workflow="market-data.yml" />
      ),
    },
  ];

  if (panorama) {
    blocos.push({
      id: "tabela-completa",
      eyebrow: "Esmiuçamento",
      titulo: "Tabela completa",
      descricao: "A planilha inteira — desenvolvidos × emergentes, ordenada pelo retorno de 12 meses.",
      children: <TabelaCompleta panorama={panorama} />,
    });
  }

  return (
    <div className="space-y-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-[#027DFC]">
        Ativos de mercado · Global · Índices globais
      </p>

      <DashboardScaffold
        header={{
          titulo: "O dia dos mercados globais",
          subtitulo:
            "De Tóquio a Nova York, a história de hoje em uma manchete — e o esmiuçamento por região, janela e valuation logo abaixo.",
          referencia: manchete?.dataDado
            ? `Fechamento de referência: ${fmtDataBR(manchete.dataDado)} · cesta intradiária de 16 índices, giro a cada 15 min`
            : "Cesta intradiária de 16 índices, giro a cada 15 min",
        }}
        manchete={
          manchete?.texto ??
          "Sem leitura do dia por enquanto: o panorama intradiário não trouxe índices suficientes neste giro — os blocos abaixo seguem com o último dado disponível."
        }
        anchor={
          <RelogioMercados
            retornos1d={retornos1d}
            geradoEm={panorama?.generated_at ?? null}
            dataDado={manchete?.dataDado ?? null}
          />
        }
        blocos={blocos}
        fichaTecnica={
          <div className="space-y-2">
            <p>
              <strong>Manchete gerada por regra</strong> (indices-globais/narrativa.ts): tom do dia
              pela proporção de altas/baixas PONDERADA POR REGIÃO (média das proporções de cada
              região; ≥ 60% de altas = apetite a risco, ≥ 60% de baixas = aversão, senão sinais
              mistos); banda de estabilidade de ±0,05% por índice; direção de região = média
              acima/abaixo de ±0,15%; Brasil “destoa” com EWZ ≥ 0,30% contra o tom. Se o fechamento
              mais recente for anterior ao dia de acesso (Brasília), a prosa diz “no último
              fechamento”.
            </p>
            <p>
              <strong>Relógio dos mercados.</strong> Horários REGULARES de pregão local, fixos por
              praça: Tóquio (TSE) 9h–11h30/12h30–15h30 · Hong Kong (HKEX) 9h30–12h/13h–16h · Mumbai
              (NSE) 9h15–15h30 · Frankfurt (Xetra) 9h–17h30 · Londres (LSE) 8h–16h30 · Nova York
              (NYSE) 9h30–16h. Fuso via Intl no navegador; NÃO considera feriados locais nem
              leilões de abertura/fechamento.
            </p>
            <p>
              <strong>Moeda local</strong>: cada índice é medido em pontos na própria moeda —
              retornos não são diretamente comparáveis em moeda comum (um DAX +10% com euro fraco
              rende menos em US$). Brasil entra na cesta via <code>EWZ</code>, ETF em dólar listado
              em NY.
            </p>
            <p>
              <strong>Mapa de calor por região</strong>: escala discreta divergente com degraus
              próprios por janela (em %, espelhados p/ o negativo) — 1D: 0,3/1/2 · 1S: 0,5/1,5/3 ·
              1M: 1/3/6 · 3M: 2/6/12 · 1A: 5/15/30. Um ±1% num dia é notícia; num ano, é ruído.
            </p>
            <p>
              <strong>Corrida do ano (rebase 100)</strong>: todas as séries valem 100 no primeiro
              pregão da janela; a inclinação relativa compara trajetórias, não níveis de valuation.
              O título afirmativo usa o acumulado do ano (último fechamento ÷ primeiro pregão do
              ano) do catálogo diário.
            </p>
            <p>
              <strong>Cobertura e fontes</strong>: cesta intradiária de 16 índices (data-pipeline,
              giro 15 min) e histórico diário de 5 anos do catálogo (S&amp;P 500, Nasdaq, Dow, Euro
              Stoxx 50, FTSE 100, Nikkei, Ibovespa, Hang Seng e Xangai) — Yahoo Finance. Valuation
              EUA: data/global_valuation.json (market-data.yml, diário útil).
            </p>
          </div>
        }
      />
    </div>
  );
}
