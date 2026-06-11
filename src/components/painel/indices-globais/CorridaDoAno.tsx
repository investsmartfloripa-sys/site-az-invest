"use client";

import { useMemo, useState } from "react";

import {
  AzPeriodSelector,
  AzTimeSeriesChart,
  type AzPeriodValue,
  type AzTimeSeries,
} from "@/components/painel/charts";
import { AzSegmented, ChartCard } from "@/components/painel/core";
import type { HistorySlice } from "@/lib/painel-mercado-global";

import { buildTituloCorrida } from "./narrativa";

/**
 * Corrida do ano — o rebase 100 da página com TÍTULO AFIRMATIVO gerado dos
 * dados YTD do catálogo diário ("Em 2026, o Hang Seng (Hong Kong) lidera
 * (+18,2%) e o Ibovespa corre por fora (+5,1%)"); regras em narrativa.ts.
 * Janela default = YTD (a corrida é a do ano); o leitor troca pelotão e
 * janela à vontade.
 */

// ── Pelotões do comparativo (tickers disponíveis no market_history_full) ──
const PRESETS: { id: string; label: string; tickers: string[] }[] = [
  { id: "desenvolvidos", label: "Desenvolvidos", tickers: ["^GSPC", "^STOXX50E", "^FTSE", "^N225"] },
  { id: "emergentes", label: "Emergentes", tickers: ["^BVSP", "^HSI", "000001.SS"] },
  { id: "americas", label: "Américas", tickers: ["^GSPC", "^IXIC", "^DJI", "^BVSP"] },
];

const LABELS: Record<string, string> = {
  "^GSPC": "S&P 500",
  "^STOXX50E": "Euro Stoxx 50",
  "^FTSE": "FTSE 100",
  "^N225": "Nikkei 225",
  "^BVSP": "Ibovespa",
  "^HSI": "Hang Seng",
  "000001.SS": "Xangai",
  "^IXIC": "Nasdaq",
  "^DJI": "Dow Jones",
};

type Props = {
  history: HistorySlice;
};

export function CorridaDoAno({ history }: Props) {
  const [preset, setPreset] = useState<string>("desenvolvidos");
  const [periodo, setPeriodo] = useState<AzPeriodValue>({ id: "ytd" });

  // Título da corrida: calculado sobre TODO o catálogo carregado (não só o
  // pelotão visível) — o líder do ano é o líder do ano.
  const titulo = useMemo(() => buildTituloCorrida(history), [history]);

  const ativo = PRESETS.find((p) => p.id === preset) ?? PRESETS[0];
  const series = useMemo<AzTimeSeries[]>(
    () =>
      ativo.tickers
        .map((ticker) => history.series.find((s) => s.ticker === ticker))
        .filter((s): s is NonNullable<typeof s> => s != null)
        .map((s) => ({ id: s.ticker, label: LABELS[s.ticker] ?? s.label, data: s.data })),
    [ativo, history.series],
  );

  const min = history.series.length > 0 ? history.series[0].data[0]?.[0] : undefined;
  const max = history.lastDataDate ?? undefined;

  return (
    <ChartCard
      title={titulo}
      subtitle="Rebase 100 no primeiro pregão da janela — acima de 100 = acumulou alta; o título usa o acumulado do ano (YTD) do catálogo diário"
      toolbar={
        <AzSegmented
          ariaLabel="Grupo de índices"
          value={preset}
          onChange={setPreset}
          options={PRESETS.map((p) => ({ id: p.id, label: p.label }))}
        />
      }
      footer={
        <>
          Pontos de fechamento em moeda local (5 anos diários) — o rebase compara trajetória, não
          retorno em moeda comum. O histórico cobre o subconjunto do catálogo diário; Coreia,
          Taiwan e Índia aparecem só na fotografia por região.
        </>
      }
      stampGiro={history.generatedAt}
      stampDado={history.lastDataDate}
    >
      <div className="space-y-3">
        <AzPeriodSelector value={periodo} onChange={setPeriodo} min={min} max={max} />
        <AzTimeSeriesChart series={series} mode="rebase100" period={periodo} height={340} forwardFill />
      </div>
    </ChartCard>
  );
}
