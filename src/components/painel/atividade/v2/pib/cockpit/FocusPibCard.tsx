"use client";

import { useMemo, useState } from "react";

import { AzPeriodSelector, type AzPeriodValue } from "@/components/painel/charts/AzPeriodSelector";
import {
  AzTimeSeriesChart,
  type AzRefLine,
  type AzTimeSeries,
} from "@/components/painel/charts/AzTimeSeriesChart";
import { ChartCard, CockpitChip, tomPorSinal } from "@/components/painel/core";
import { AZ_BRAND, AZ_CHART } from "@/lib/az-chart-theme";
import { addDaysUTC, fmtDataBR, fmtNum, fmtPct, fmtSignedNum, fmtSignedPct } from "@/lib/format-br";
import type { AtividadePibData, FocusPonto } from "@/lib/painel-atividade";

/**
 * COCKPIT · Focus — mediana diária das projeções de PIB anual (BCB Olinda,
 * ExpectativasMercadoAnuais "PIB Total") para o ano corrente, +1 e +2, com a
 * dispersão (desvio-padrão) no chip e o carrego estatístico (builder) como
 * régua. Chips carregam o último valor de cada ano e a
 * revisão em 4 semanas; editorial e metodologia ficam no (?).
 */

/** Janela da revisão exibida no chip do ano corrente (dias corridos). */
const JANELA_REVISAO_DIAS = 28;

/** Cores por posição: ano corrente, +1, +2. */
const CORES_ANOS = [AZ_BRAND.azure, AZ_BRAND.navy, AZ_CHART.ticks] as const;

type PontoFocus = { data: string; mediana: number; dp: number | null };

/**
 * Pontos válidos de um ano, ordenados e com UMA linha por data. O builder não
 * grava `baseCalculo` e o Olinda devolve duas linhas por dia de coleta (bases
 * de 30 dias e de 5 dias úteis); a última linha gravada de cada data vence —
 * mesmo critério do overlay por data do AzTimeSeriesChart, que mantém a
 * leitura estável entre chip e gráfico.
 */
function pontosDoAno(arr: ReadonlyArray<FocusPonto> | undefined): PontoFocus[] {
  if (!arr || arr.length === 0) return [];
  const porData = new Map<string, PontoFocus>();
  for (const p of arr) {
    if (!p.data || p.mediana == null || !Number.isFinite(p.mediana)) continue;
    porData.set(p.data, { data: p.data, mediana: p.mediana, dp: p.dp != null && Number.isFinite(p.dp) ? p.dp : null });
  }
  return [...porData.values()].sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0));
}

/** Última mediana com data ≤ (última coleta − `dias`), ou null se a série não alcança. */
function medianaHaDias(pontos: ReadonlyArray<PontoFocus>, dias: number): PontoFocus | null {
  if (pontos.length === 0) return null;
  const alvo = addDaysUTC(pontos[pontos.length - 1].data, -dias);
  for (let i = pontos.length - 1; i >= 0; i--) {
    if (pontos[i].data <= alvo) return pontos[i];
  }
  return null;
}

export function FocusPibCard({ pib, geradoEm }: { pib: AtividadePibData; geradoEm: string }) {
  const [period, setPeriod] = useState<AzPeriodValue>({ id: "1y" });

  const anoCorrente = pib.carrego?.ano ?? parseInt(pib.trim_recente.slice(0, 4), 10);

  // Anos plotados (corrente, +1, +2) — só os que o builder gravou com dados.
  const anos = useMemo(
    () =>
      [anoCorrente, anoCorrente + 1, anoCorrente + 2]
        .map((ano, i) => ({ ano, cor: CORES_ANOS[i], pontos: pontosDoAno(pib.focus[String(ano)]) }))
        .filter((a) => a.pontos.length > 0),
    [pib.focus, anoCorrente],
  );

  const series = useMemo<AzTimeSeries[]>(
    () =>
      anos.map((a) => ({
        id: `focus-${a.ano}`,
        label: `PIB ${a.ano}`,
        color: a.cor,
        data: a.pontos.map((p) => [p.data, p.mediana] as const),
      })),
    [anos],
  );

  // Desvio-padrão do ano corrente na última coleta — vai para o chip, não para
  // o gráfico (as linhas ±1 dp diárias são ruidosas e escondem a mediana).
  const dpCorrente = useMemo<number | null>(() => {
    const corrente = anos.find((a) => a.ano === anoCorrente);
    if (!corrente) return null;
    for (let i = corrente.pontos.length - 1; i >= 0; i--) {
      const dp = corrente.pontos[i].dp;
      if (dp != null) return dp;
    }
    return null;
  }, [anos, anoCorrente]);

  // Carrego estatístico do ano corrente (builder) → régua navy.
  const carrego = pib.carrego && pib.carrego.ano === anoCorrente ? pib.carrego : null;
  const refLines = useMemo<AzRefLine[]>(
    () =>
      carrego
        ? [{ y: carrego.valor, label: `carrego ${carrego.ano} ${fmtSignedPct(carrego.valor, 1)}`, color: AZ_BRAND.navy }]
        : [],
    [carrego],
  );

  // Range da série p/ o seletor (todos os anos plotados).
  const { minIso, maxIso } = useMemo(() => {
    let min = "";
    let max = "";
    for (const a of anos) {
      const first = a.pontos[0].data;
      const last = a.pontos[a.pontos.length - 1].data;
      if (!min || first < min) min = first;
      if (!max || last > max) max = last;
    }
    return { minIso: min, maxIso: max };
  }, [anos]);

  // Estado dos chips: último ponto de cada ano + revisão em 4 semanas do corrente.
  const corrente = anos.find((a) => a.ano === anoCorrente) ?? null;
  const ultimoCorrente = corrente ? corrente.pontos[corrente.pontos.length - 1] : null;
  const ha4s = corrente ? medianaHaDias(corrente.pontos, JANELA_REVISAO_DIAS) : null;
  const delta4s = ultimoCorrente && ha4s ? +(ultimoCorrente.mediana - ha4s.mediana).toFixed(2) : null;

  const subtitulo = [
    `Expectativas de mercado para ${anos.length > 0 ? anos.map((a) => String(a.ano)).join(" · ") : anoCorrente}`,
    refLines.length > 0 ? "régua = carrego estatístico" : null,
  ]
    .filter((s): s is string => s != null)
    .join(" · ");

  const footer = (
    <div className="space-y-1.5">
      <p>
        <strong>Fonte:</strong> BCB Olinda (API de dados abertos do Banco Central) — ExpectativasMercadoAnuais,
        indicador &quot;PIB Total&quot;, mediana das projeções por data de coleta (série diária). Anos: corrente = ano do carrego gravado pelo builder (ou do
        trimestre mais recente), +1 e +2 quando existem no payload.
      </p>
      <p>
        <strong>dp:</strong> desvio-padrão das projeções do ano corrente na última coleta — dispersão entre as
        instituições respondentes, não intervalo de confiança da previsão (fica no chip; as linhas ±1 dp diárias
        eram ruidosas demais para o gráfico).
      </p>
      <p>
        <strong>Δ 4 semanas:</strong> mediana da última coleta − mediana da última coleta com data ≤ D−
        {JANELA_REVISAO_DIAS}, em pontos percentuais. Verde = revisão para cima, vermelho = para baixo.
      </p>
      <p>
        <strong>Carrego estatístico:</strong> média do índice de volume SA do ano com o último trimestre divulgado
        congelado nos trimestres restantes ÷ média do ano anterior − 1 (calculado pelo builder;{" "}
        {carrego ? `${carrego.trimestres_divulgados} trimestre(s) divulgado(s)` : "não gravado para o ano corrente"}
        ). É o crescimento que o ano já garante se a economia ficar parada; carrego acima da mediana sugere Focus com
        viés de revisão para cima, e vice-versa.
      </p>
      <p>
        <strong>Defasagem:</strong> o BCB revisa a mediana toda semana, mas este payload só é regravado no giro do
        PIB (trimestral, lag ~60 dias) — o carimbo &quot;Dado&quot; mostra a última coleta gravada
        {ultimoCorrente ? ` (${fmtDataBR(ultimoCorrente.data)})` : ""}. O builder não grava o campo{" "}
        <code>baseCalculo</code>: o Olinda devolve duas linhas por data (bases de 30 dias e de 5 dias úteis) e o
        card usa a última gravada de cada data.
      </p>
    </div>
  );

  return (
    <ChartCard
      title="Focus — PIB anual, mediana por coleta (%)"
      subtitle={subtitulo}
      footer={footer}
      stampGiro={geradoEm}
      stampDado={ultimoCorrente?.data ?? (maxIso || null)}
      toolbar={
        <AzPeriodSelector
          value={period}
          onChange={setPeriod}
          min={minIso || undefined}
          max={maxIso || undefined}
          periods={["3m", "6m", "1y", "max"]}
        />
      }
    >
      <div className="mb-2 flex flex-wrap gap-1.5">
        {anos.map((a) => {
          const ult = a.pontos[a.pontos.length - 1];
          if (a.ano === anoCorrente) {
            return (
              <CockpitChip
                key={a.ano}
                tom={delta4s != null ? tomPorSinal(delta4s) : "navy"}
                title={
                  ha4s
                    ? `Mediana em ${fmtDataBR(ult.data)} vs ${fmtDataBR(ha4s.data)} (${fmtPct(ha4s.mediana, 2)})`
                    : `Mediana em ${fmtDataBR(ult.data)}`
                }
              >
                {a.ano}: {fmtPct(ult.mediana, 2)}
                {delta4s != null ? ` · Δ 4 semanas ${fmtSignedNum(delta4s, 2)} p.p.` : " · Δ 4 semanas —"}
                {dpCorrente != null ? ` · dp ${fmtNum(dpCorrente, 2)}` : ""}
              </CockpitChip>
            );
          }
          return (
            <CockpitChip key={a.ano} tom="navy" title={`Mediana em ${fmtDataBR(ult.data)}`}>
              {a.ano}: {fmtPct(ult.mediana, 2)}
            </CockpitChip>
          );
        })}
        <CockpitChip
          tom="navy"
          title={carrego ? `${carrego.trimestres_divulgados} trimestre(s) divulgado(s)` : "carrego não gravado para o ano corrente"}
        >
          carrego {anoCorrente}: {carrego ? fmtPct(carrego.valor, 2) : "—"}
        </CockpitChip>
      </div>
      <AzTimeSeriesChart
        series={series}
        unit="%"
        period={period}
        height={240}
        refLines={refLines}
        dots={false}
        showLegend
        variant="default"
      />
    </ChartCard>
  );
}
