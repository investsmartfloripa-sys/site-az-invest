"use client";

import { useMemo, useState } from "react";

import type { AtividadeCodaceData, AtividadePibData } from "@/lib/painel-atividade";
import { ChartCard, AzSegmented, IndicadorBox } from "@/components/painel/core";
import { AzPeriodSelector, type AzPeriodValue } from "@/components/painel/charts/AzPeriodSelector";
import { AzTimeSeriesChart, type AzSeriesPoint } from "@/components/painel/charts/AzTimeSeriesChart";
import { AZ_BRAND } from "@/lib/az-chart-theme";
import { fmtTrimCurto, num, trimIsoCentral } from "../shared";

/**
 * A qualidade do financiamento externo da economia — quanto da necessidade
 * líquida de financiamento (B.9, capacidade/necessidade de financiar o resto do
 * mundo) é coberta por Investimento Direto no País (IDP). Duas leituras (toggle):
 *
 *   - "B.9 vs IDP (R$ bi)": as duas séries em acumulado de 4 trimestres (fluxo
 *     anualizado). B.9 é quase sempre negativo (a economia PRECISA captar
 *     poupança externa); IDP é positivo (entrada de capital produtivo, estável e
 *     não-volátil). Convenção macro: financiamento de QUALIDADE é aquele
 *     ancorado em IDP, não em capital de curto prazo.
 *   - "Cobertura IDP / |B.9| (%)": a razão entre o IDP e o tamanho (módulo) da
 *     necessidade de financiamento. RefLine em 100% = o IDP cobre integralmente a
 *     necessidade; acima de 100% a economia financia toda a necessidade com
 *     capital produtivo e ainda sobra (financiamento de alta qualidade).
 *
 * Dados: conta financeira do PIB (SIDRA 2205, desde 2010), `serie_acum4t`. Os
 * valores de B.9 e IDP vêm na coluna de passivo da carga (lado de captação do
 * resto do mundo) — lemos de forma robusta (liquido → passivo → ativo) p/
 * sobreviver a mudanças de layout. `conta_financeira` não está no tipo
 * AtividadePibData — acesso via cast; ausência vira placeholder "sem dados".
 */

type FinRow = Record<string, number | null | string> & { trim: string };

type ContaFinanceira = {
  conta_financeira?: { serie?: FinRow[]; serie_acum4t?: FinRow[] };
  labels_financeiro?: Record<string, string>;
};

type Vista = "valores" | "cobertura";

/**
 * Lê o valor de um instrumento da conta financeira de forma robusta. Os campos
 * canônicos são `<k>_liquido`, mas nesta carga B.9 e IDP chegam só em
 * `<k>_passivo` (lado da captação externa) — testamos liquido → passivo → ativo.
 */
function valorInstrumento(row: FinRow | undefined | null, k: string): number | null {
  if (!row) return null;
  for (const campo of [`${k}_liquido`, `${k}_passivo`, `${k}_ativo`]) {
    const v = num(row, campo);
    if (v != null) return v;
  }
  return null;
}

export function QualidadeFinanciamentoPib({
  pib,
  // codace aceito por simetria com os demais cards da face; não usado aqui.
  geradoEm,
}: {
  pib: AtividadePibData;
  codace?: AtividadeCodaceData | null;
  geradoEm: string;
}) {
  const [vista, setVista] = useState<Vista>("valores");
  const [period, setPeriod] = useState<AzPeriodValue>({ id: "max" });

  const cf = (pib as unknown as ContaFinanceira).conta_financeira;
  const serieAcum = cf?.serie_acum4t ?? [];

  const { b9Pts, idpPts, cobPts, minIso, maxIso, cobAtual, trimAtual } = useMemo(() => {
    const b9Pts: AzSeriesPoint[] = []; // R$ bi
    const idpPts: AzSeriesPoint[] = []; // R$ bi
    const cobPts: AzSeriesPoint[] = []; // %
    let cobAtual: number | null = null;
    let trimAtual: string | null = null;

    for (const r of serieAcum) {
      const iso = trimIsoCentral(String(r.trim));
      const b9 = valorInstrumento(r, "b9"); // R$ milhões (negativo = necessidade)
      const idp = valorInstrumento(r, "idp"); // R$ milhões (positivo = entrada)

      if (b9 != null) b9Pts.push([iso, +(b9 / 1000).toFixed(2)]);
      if (idp != null) idpPts.push([iso, +(idp / 1000).toFixed(2)]);

      // Cobertura = IDP ÷ |B.9| × 100. Só faz sentido quando há necessidade (B.9 < 0).
      if (b9 != null && idp != null && Math.abs(b9) > 0) {
        const cob = +((idp / Math.abs(b9)) * 100).toFixed(1);
        cobPts.push([iso, cob]);
        cobAtual = cob;
        trimAtual = String(r.trim);
      }
    }

    const todas = [...b9Pts, ...idpPts];
    let minIso = "";
    let maxIso = "";
    for (const [d] of todas) {
      if (!minIso || d < minIso) minIso = d;
      if (!maxIso || d > maxIso) maxIso = d;
    }

    return { b9Pts, idpPts, cobPts, minIso, maxIso, cobAtual, trimAtual };
  }, [serieAcum]);

  const semDados = b9Pts.length === 0 && idpPts.length === 0;

  if (semDados) {
    return (
      <ChartCard
        title="A qualidade do financiamento: o IDP cobre quanto da necessidade?"
        subtitle="Necessidade líquida de financiamento (B.9) e Investimento Direto no País (IDP), acumulado em 4 trimestres."
        footer="Fonte: IBGE/SIDRA — Contas Nacionais Trimestrais, conta financeira por instrumento (2205, desde 2010)."
        stampGiro={geradoEm}
        stampDado={pib.trim_recente}
      >
        <p className="flex h-48 items-center justify-center text-center text-sm text-zinc-400">
          Conta financeira (SIDRA 2205) indisponível nesta carga.
        </p>
      </ChartCard>
    );
  }

  return (
    <ChartCard
      title="A qualidade do financiamento: o IDP cobre quanto da necessidade?"
      subtitle={
        vista === "valores"
          ? "Necessidade líquida de financiamento (B.9, quase sempre negativa) e Investimento Direto no País (IDP), em R$ bilhões — acumulado de 4 trimestres (fluxo anualizado)."
          : "Cobertura = IDP ÷ tamanho da necessidade (|B.9|). Linha em 100% = o IDP cobre integralmente a necessidade de financiamento; acima de 100% a economia capta capital produtivo de sobra (financiamento de alta qualidade, não volátil)."
      }
      toolbar={
        <>
          <AzSegmented
            ariaLabel="Leitura do financiamento"
            options={[
              { id: "valores", label: "B.9 vs IDP (R$ bi)" },
              { id: "cobertura", label: "Cobertura IDP/B.9 (%)" },
            ]}
            value={vista}
            onChange={(id) => setVista(id === "cobertura" ? "cobertura" : "valores")}
          />
          <AzPeriodSelector
            value={period}
            onChange={setPeriod}
            min={minIso}
            max={maxIso}
            periods={["5y", "max"]}
          />
        </>
      }
      footer="Fonte: IBGE/SIDRA — Contas Nacionais Trimestrais, conta financeira por instrumento (2205, desde 2010). B.9 = capacidade (+) / necessidade (−) líquida de financiamento da economia; IDP = investimento direto no país (entrada de capital produtivo). Séries em acumulado de 4 trimestres. Cobertura = IDP ÷ |B.9| × 100, calculada pela AZ."
      stampGiro={geradoEm}
      stampDado={trimAtual ?? pib.trim_recente}
    >
      <div className="flex flex-col gap-3">
        {vista === "valores" ? (
          <AzTimeSeriesChart
            series={[
              { id: "idp", label: "IDP (entrada, +)", color: AZ_BRAND.azure, data: idpPts },
              { id: "b9", label: "B.9 (necessidade, −)", color: AZ_BRAND.rust, data: b9Pts },
            ]}
            unit="R$"
            period={period}
            height={340}
            showLegend
          />
        ) : (
          <AzTimeSeriesChart
            series={[{ id: "cob", label: "Cobertura IDP / |B.9|", color: AZ_BRAND.navy, data: cobPts }]}
            unit="%"
            period={period}
            height={340}
            variant="hero"
            refLines={[{ y: 100, label: "100% — IDP cobre a necessidade", color: AZ_BRAND.rust }]}
          />
        )}

        <IndicadorBox
          titulo="Cobertura atual do IDP sobre a necessidade de financiamento"
          valor={cobAtual}
          unidade="%"
          formula="IDP ÷ |B.9| × 100 (acum. 4 trimestres)"
          origem="calculado"
          trend={cobAtual == null ? "neutra" : cobAtual >= 100 ? "boa" : "ruim"}
          narrativa={
            cobAtual == null
              ? "Sem cobertura calculável no trimestre mais recente."
              : cobAtual >= 100
                ? `No ${fmtTrimCurto(trimAtual ?? pib.trim_recente)}, o IDP cobre mais de 100% da necessidade líquida de financiamento — a economia financia toda a necessidade com capital produtivo estável, o que caracteriza financiamento de qualidade.`
                : `No ${fmtTrimCurto(trimAtual ?? pib.trim_recente)}, o IDP cobre menos de 100% da necessidade líquida de financiamento — parte da necessidade depende de outras fontes (carteira, dívida), tipicamente mais voláteis.`
          }
          siglas={[
            { sigla: "B.9", expansao: "Capacidade (+) ou necessidade (−) líquida de financiamento da economia — saldo das contas externas pela ótica financeira." },
            { sigla: "IDP", expansao: "Investimento Direto no País — entrada de capital produtivo (participação/empréstimos intercompanhia); fonte estável de financiamento." },
          ]}
        />
      </div>
    </ChartCard>
  );
}
