"use client";

import { useMemo, useState } from "react";

import {
  AzPeriodSelector,
  AzTimeSeriesChart,
  type AzPeriodValue,
  type AzTimeSeries,
} from "@/components/painel/charts";
import { ChartCard, KpiCard } from "@/components/painel/core";
import { MethodInfo } from "@/components/painel/core/MethodInfo";
import { AZ_BRAND, AZ_CHART } from "@/lib/az-chart-theme";
import { fmtDataBR, fmtNum, fmtPct, fmtSignedNum } from "@/lib/format-br";
import type {
  GlobalValuationPayload,
  GlobalValuationStats,
} from "@/lib/painel-mercado-global";

/**
 * Seção "Valuation EUA" da página de índices globais: múltiplos do S&P 500
 * via SPY (P/L e DY), CAPE de Shiller e indicador Buffett (market cap ÷ PIB)
 * — cada série histórica com média e banda de ±1σ, mesmo visual do P/L do
 * Ibovespa em AcoesValuation.
 *
 * Fonte: data/global_valuation.json (market-data.yml, diário útil). A página
 * só monta esta seção quando o payload existe; blocos individuais ausentes
 * degradam com nota honesta.
 */

const SERIES_COLOR = AZ_BRAND.navy; // série principal (mesmo navy do P/L Ibov)
const MEAN_COLOR = AZ_CHART.ticks; // linha da média (referência discreta)
const BAND_COLOR = AZ_BRAND.azure; // banda ±1σ

type Props = {
  data: GlobalValuationPayload;
};

/** Leitura leiga do z-score vs média histórica (mesma régua do P/L do Ibov). */
function leituraZ(z: number | null | undefined): { text: string; color: string } {
  if (z == null || !Number.isFinite(z)) return { text: "—", color: AZ_CHART.ticks };
  if (z >= 1) return { text: `acima da média (caro, ${fmtSignedNum(z, 1)}σ)`, color: AZ_CHART.negText };
  if (z <= -1) return { text: `abaixo da média (barato, ${fmtSignedNum(z, 1)}σ)`, color: AZ_CHART.posText };
  return { text: `na média histórica (${fmtSignedNum(z, 1)}σ)`, color: AZ_CHART.neutral };
}

/** refLines/refAreas de média ± 1σ a partir das stats do pipeline. */
function bandsOf(stats: GlobalValuationStats | null | undefined) {
  if (!stats) return { refLines: [], refAreas: [] };
  return {
    refLines: [{ y: stats.mean, label: "média", color: MEAN_COLOR, dashed: true }],
    refAreas: [{ y1: stats.minus1, y2: stats.plus1, color: BAND_COLOR, opacity: 0.1 }],
  };
}

function BlocoIndisponivel({ nome }: { nome: string }) {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
      <p className="font-semibold">{nome}: dado ainda não disponível</p>
      <p className="mt-1">
        O builder não conseguiu montar este bloco no último giro (fonte fora do ar) e ainda não há
        dado anterior preservado. A série monta sozinha no próximo run do{" "}
        <code className="rounded bg-amber-100 px-1 py-0.5">market-data.yml</code>.
      </p>
    </div>
  );
}

export function ValuationEuaSection({ data }: Props) {
  const [buffettPeriod, setBuffettPeriod] = useState<AzPeriodValue>({ id: "max" });
  const [capePeriod, setCapePeriod] = useState<AzPeriodValue>({ id: "max" });

  const buffett = data.buffett ?? null;
  const cape = data.cape ?? null;
  const spy = data.spy ?? null;

  const buffettSeries = useMemo<AzTimeSeries[]>(() => {
    const pts = buffett?.series ?? [];
    return pts.length > 0
      ? [{ id: "buffett", label: "Market cap ÷ PIB", color: SERIES_COLOR, data: pts }]
      : [];
  }, [buffett]);

  const capeSeries = useMemo<AzTimeSeries[]>(() => {
    const pts = cape?.series ?? [];
    return pts.length > 0 ? [{ id: "cape", label: "CAPE", color: SERIES_COLOR, data: pts }] : [];
  }, [cape]);

  const buffettBands = bandsOf(buffett?.stats);
  const capeBands = bandsOf(cape?.stats);

  const buffettLeitura = leituraZ(buffett?.stats?.current_z);
  const capeLeitura = leituraZ(cape?.stats?.current_z);

  const spyCur = spy?.current ?? null;

  return (
    <div className="space-y-4">
      {/* KPIs — leitura rápida em linguagem leiga */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="P/L do S&P 500 (SPY)"
          value={spyCur?.trailing_pe != null ? fmtNum(spyCur.trailing_pe, 1) : "—"}
          unit="x"
          hint="preço ÷ lucros dos últimos 12 meses"
        />
        <KpiCard
          label="Dividend yield (SPY)"
          value={spyCur?.dividend_yield_pct != null ? fmtPct(spyCur.dividend_yield_pct, 2) : "—"}
          unit="a.a."
          hint="dividendos pagos ÷ preço do ETF"
        />
        <KpiCard
          label="CAPE (Shiller)"
          value={cape?.current?.value != null ? fmtNum(cape.current.value, 1) : "—"}
          unit="x"
          hint={
            cape?.stats
              ? `média histórica ${fmtNum(cape.stats.mean, 1)}x — ${capeLeitura.text}`
              : "P/L ajustado pelo ciclo (lucros reais de 10 anos)"
          }
        />
        <KpiCard
          label="Indicador Buffett"
          value={buffett?.current?.ratio_pct != null ? fmtNum(buffett.current.ratio_pct, 0) : "—"}
          unit="% do PIB"
          hint={
            buffett?.stats
              ? `média histórica ${fmtNum(buffett.stats.mean, 0)}% — ${buffettLeitura.text}`
              : "valor da bolsa ÷ tamanho da economia"
          }
        />
      </div>

      {/* Gráfico 1 — Buffett com média e banda ±1σ */}
      {buffettSeries.length > 0 ? (
        <ChartCard
          title="Indicador Buffett — valor de mercado ÷ PIB dos EUA"
          subtitle="Quanto a bolsa americana vale em relação ao tamanho da economia; banda = média histórica ± 1 desvio-padrão"
          toolbar={
            <AzPeriodSelector
              value={buffettPeriod}
              onChange={setBuffettPeriod}
              min={buffett?.series?.[0]?.[0]}
              max={buffett?.current?.date ?? undefined}
            />
          }
          footer={
            <>
              Numerador: equities de corporações não-financeiras (Fed Z.1, série FRED{" "}
              <code>{buffett?.numerator_series ?? "NCBEILQ027S"}</code> — a clássica Wilshire 5000
              foi descontinuada no FRED em 2023). Denominador: PIB nominal (FRED{" "}
              <code>{buffett?.denominator_series ?? "GDP"}</code>). Série <strong>trimestral</strong>{" "}
              com ~10 semanas de defasagem; exclui financeiras, por isso a leitura certa é contra a
              própria média histórica, não contra o &quot;100% do PIB&quot; do folclore.
              {buffett?.stale ? " Último giro falhou — exibindo o dado bom anterior." : ""} Não é
              recomendação.
            </>
          }
          stampGiro={data.generated_at ?? null}
          stampDado={buffett?.current?.date ?? null}
        >
          <AzTimeSeriesChart
            series={buffettSeries}
            unit="%"
            period={buffettPeriod}
            height={300}
            refLines={buffettBands.refLines}
            refAreas={buffettBands.refAreas}
          />
        </ChartCard>
      ) : (
        <BlocoIndisponivel nome="Indicador Buffett" />
      )}

      {/* Gráfico 2 — CAPE com média longa */}
      {capeSeries.length > 0 ? (
        <ChartCard
          title="CAPE — P/L de Shiller do S&P 500"
          subtitle="Preço ÷ média de 10 anos dos lucros reais: o múltiplo que atravessa ciclos; banda = média histórica ± 1 desvio-padrão"
          toolbar={
            <AzPeriodSelector
              value={capePeriod}
              onChange={setCapePeriod}
              min={cape?.series?.[0]?.[0]}
              max={cape?.current?.date ?? undefined}
            />
          }
          footer={
            <>
              Dataset público de Robert Shiller (Yale), mensal desde {cape?.series?.[0]?.[0]?.slice(0, 4) ?? "1881"}.
              O CAPE suaviza o lucro pelo ciclo — evita o P/L &quot;barato&quot; artificial de topo
              de lucros. Comparações longas carregam mudanças de contabilidade e de composição
              setorial do índice.{cape?.stale ? " Último giro falhou — exibindo o dado bom anterior." : ""}{" "}
              Não é recomendação.
            </>
          }
          stampGiro={data.generated_at ?? null}
          stampDado={cape?.current?.date ?? null}
        >
          <AzTimeSeriesChart
            series={capeSeries}
            unit="index"
            period={capePeriod}
            height={300}
            refLines={capeBands.refLines}
            refAreas={capeBands.refAreas}
          />
        </ChartCard>
      ) : (
        <BlocoIndisponivel nome="CAPE (Shiller)" />
      )}

      {/* Rodapé do SPY: leitura visível + fonte dos múltiplos atrás do ícone (?) */}
      <p className="text-[11px] text-zinc-500">
        CAPE e Buffett medem régua longa; o P/L trailing mede o preço de hoje contra o lucro dos
        últimos 12 meses.
        <MethodInfo className="ml-1.5 align-middle">
          P/L e dividend yield do S&amp;P 500 medidos pelo ETF SPY (yfinance, giro diário útil
          {spyCur?.date ? ` — último dado ${fmtDataBR(spyCur.date)}` : ""}); a série diária desses
          múltiplos é acumulada pelo pipeline a cada giro
          {spy?.series?.length ? ` (${spy.series.length} snapshot${spy.series.length > 1 ? "s" : ""} até aqui)` : ""}.
        </MethodInfo>
      </p>
    </div>
  );
}
