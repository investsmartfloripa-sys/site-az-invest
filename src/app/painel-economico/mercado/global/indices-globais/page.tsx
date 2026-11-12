import type { Metadata } from "next";
import type { ReactNode } from "react";

import { CorridaDoAno } from "@/components/painel/indices-globais/CorridaDoAno";
import { buildLeituraValuation, buildMancheteDoDia } from "@/components/painel/indices-globais/narrativa";
import { RegioesHeatstrips } from "@/components/painel/indices-globais/RegioesHeatstrips";
import { RelogioMercados } from "@/components/painel/indices-globais/RelogioMercados";
import { TabelaCompleta } from "@/components/painel/indices-globais/TabelaCompleta";
import { ValuationEuaSection } from "@/components/painel/indices-globais/ValuationEuaSection";
import { PipelinePendingCard } from "@/components/painel/PipelinePendingCard";
import { ComunidadeMercado } from "@/components/painel/market/ComunidadeMercado";
import { fmtDataBR } from "@/lib/format-br";
import {
  EMPTY_HISTORY_SLICE,
  getGlobalValuation,
  getHistorySlice,
  getWorldIndicesReturnsPanorama,
  hojeIsoBrasilia,
} from "@/lib/painel-mercado-global";

export const metadata: Metadata = {
  title: "Índices globais — O dia dos mercados",
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

/** Seção da página: título e nota curta acima do conteúdo. */
type Secao = { id: string; titulo: string; descricao?: string; children: ReactNode };

/** Mesmo estilo de destaque para as duas leituras em prosa da página (manchete e valuation). */
const CALLOUT =
  "rounded-xl border-l-4 border-[#027DFC] bg-white p-3 pl-4 text-sm leading-relaxed text-zinc-800 shadow-sm";

/**
 * Índices globais: manchete do dia (regras em indices-globais/narrativa.ts), relógio das
 * praças, fotografia por região, corrida do ano e termômetro de valuation.
 *
 * Desde a revisão de 12/11/2026 a página usa o MESMO desenho das outras abas de Mercado
 * (cabeçalho solto, seções com título simples, notas metodológicas no rodapé), no lugar do
 * template narrativo de Economia (título dentro de cartão, blocos numerados "01 ·" com filete
 * e duas caixas de manchete de cores diferentes).
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
            Mercado · Global · Índices globais
          </p>
          <h1 className="text-2xl font-semibold text-[#132960]">O dia dos mercados globais</h1>
        </header>
        <PipelinePendingCard
          blobPaths={["data/world_indices_returns_panorama.json", "data/market_history_full.json"]}
          workflow="data-pipeline.yml / market-data.yml"
        />
      </div>
    );
  }

  // ── Seções (esmiuçamento abaixo da leitura rápida) ────────────────────────
  const secoes: Secao[] = [
    {
      id: "regioes",
      titulo: "O mundo por região",
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
      titulo: "Corrida do ano",
      descricao:
        "Base 100: todas as bolsas partem do mesmo ponto e o gráfico mostra quem abriu vantagem; o título resume o acumulado do ano do grupo exibido.",
      children:
        history.series.length > 0 ? (
          // Sem <Suspense>: sem useSearchParams (CSR bailout) o boundary quebraria a hidratação (Next 16.2.4).
          <CorridaDoAno history={history} />
        ) : (
          <PipelinePendingCard blobPaths={["data/market_history_full.json"]} workflow="market-data.yml" />
        ),
    },
    {
      id: "termometro-valuation",
      titulo: "Termômetro de valuation: o mercado americano está caro ou barato?",
      descricao:
        "Três réguas clássicas — P/L corrente do S&P 500 (via SPY), CAPE de Shiller e indicador Buffett — cada uma contra a própria média histórica e banda de ±1σ: a pergunta certa é a distância da média, não o número absoluto.",
      children: valuation ? (
        <div className="space-y-3">
          {leituraValuation ? <p className={CALLOUT}>{leituraValuation}</p> : null}
          {/* Sem <Suspense>: sem useSearchParams o boundary quebraria a hidratação (Next 16.2.4). */}
          <ValuationEuaSection data={valuation} />
        </div>
      ) : (
        <PipelinePendingCard blobPaths={["data/global_valuation.json"]} workflow="market-data.yml" />
      ),
    },
  ];

  if (panorama) {
    secoes.push({
      id: "tabela-completa",
      titulo: "Tabela completa",
      descricao: "A planilha inteira — desenvolvidos × emergentes, ordenada pelo retorno de 12 meses.",
      children: <TabelaCompleta panorama={panorama} />,
    });
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#027DFC]">
          Mercado · Global · Índices globais
        </p>
        <h1 className="text-2xl font-semibold text-[#132960]">O dia dos mercados globais</h1>
        <p className="max-w-3xl text-sm text-zinc-600">
          De Tóquio a Nova York, o dia de hoje em uma manchete; abaixo, cada região em cinco janelas,
          a corrida do ano e o termômetro de valuation dos EUA.
        </p>
        <p className="text-xs text-zinc-500">
          {manchete?.dataDado
            ? `Fechamento de referência: ${fmtDataBR(manchete.dataDado)} · 16 índices, atualizados a cada 15 minutos`
            : "16 índices, atualizados a cada 15 minutos"}
        </p>
      </header>

      <p className={CALLOUT}>
        {manchete?.texto ??
          "Sem leitura do dia por enquanto: a última atualização não trouxe índices suficientes. As seções abaixo seguem com o último dado disponível."}
      </p>

      <RelogioMercados
        retornos1d={retornos1d}
        geradoEm={panorama?.generated_at ?? null}
        dataDado={manchete?.dataDado ?? null}
      />

      {secoes.map((s) => (
        <section key={s.id} id={s.id} className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold text-[#132960]">{s.titulo}</h2>
            {s.descricao ? <p className="mt-0.5 text-sm text-zinc-600">{s.descricao}</p> : null}
          </div>
          <div className="min-w-0">{s.children}</div>
        </section>
      ))}

      <section className="rounded-2xl border border-[#132960]/10 bg-zinc-50/50 p-4 text-xs leading-relaxed text-zinc-600">
        <p className="font-semibold uppercase tracking-wide text-zinc-500">Notas metodológicas</p>
        <div className="mt-2 space-y-2">
          <p>
            <strong>Manchete gerada por regra</strong>: o tom do dia sai da proporção de altas e
            baixas ponderada por região (média das proporções de cada região; 60% ou mais de altas
            = apetite a risco, 60% ou mais de baixas = aversão, senão sinais mistos); variação de
            até ±0,05% conta como estável; a direção de cada região é a média acima ou abaixo de
            ±0,15%; o Brasil “destoa” quando o EWZ anda 0,30% ou mais contra o tom. Se o
            fechamento mais recente for de um dia anterior ao de hoje (horário de Brasília), o
            texto diz “no último fechamento”.
          </p>
          <p>
            <strong>Relógio dos mercados.</strong> Horários REGULARES de pregão local, fixos por
            praça: Tóquio (TSE) 9h–11h30/12h30–15h30 · Hong Kong (HKEX) 9h30–12h/13h–16h · Mumbai
            (NSE) 9h15–15h30 · Frankfurt (Xetra) 9h–17h30 · Londres (LSE) 8h–16h30 · Nova York
            (NYSE) 9h30–16h, no fuso de cada praça. Não considera feriados locais nem
            leilões de abertura/fechamento.
          </p>
          <p>
            <strong>Moeda local</strong>: cada índice é medido em pontos na própria moeda —
            retornos não são diretamente comparáveis em moeda comum (um DAX +10% com euro fraco
            rende menos em US$). O Brasil entra na cesta pelo EWZ, ETF em dólar listado
            em NY.
          </p>
          <p>
            <strong>Mapa de calor por região</strong>: escala discreta divergente com degraus
            próprios por janela (em %, espelhados p/ o negativo) — 1D: 0,3/1/2 · 1S: 0,5/1,5/3 ·
            1M: 1/3/6 · 3M: 2/6/12 · 1A: 5/15/30. Um ±1% num dia é notícia; num ano, é ruído.
          </p>
          <p>
            <strong>Corrida do ano (base 100)</strong>: todas as séries valem 100 no primeiro
            pregão da janela; a inclinação compara trajetórias, não níveis de valuation. O título
            usa o acumulado do ano (último fechamento ÷ primeiro pregão do ano) das bolsas do
            grupo exibido.
          </p>
          <p>
            <strong>Cobertura e fontes</strong>: 16 índices atualizados a cada 15 minutos e
            histórico diário de 5 anos (S&amp;P 500, Nasdaq, Dow, Euro Stoxx 50, FTSE 100, Nikkei,
            Ibovespa, Hang Seng e Xangai), do Yahoo Finance. Valuation dos EUA: Yahoo Finance (SPY),
            FRED (indicador Buffett) e Robert Shiller (CAPE), atualizado a cada dia útil.
          </p>
        </div>
      </section>

      <ComunidadeMercado assunto="bolsas globais" origem="PAINEL_INDICES" />
    </div>
  );
}
