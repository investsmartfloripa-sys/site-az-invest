"use client";

import { useMemo } from "react";

import type { AtividadePibData } from "@/lib/painel-atividade";
import { ChartCard } from "@/components/painel/core";
import { AzTimeSeriesChart, type AzRefLine, type AzTimeSeries } from "@/components/painel/charts/AzTimeSeriesChart";
import { AZ_BRAND, AZ_SERIES } from "@/lib/az-chart-theme";
import { fmtPct } from "@/lib/format-br";

/**
 * Evolução das expectativas Focus — a DIREÇÃO da revisão é a informação
 * (o mercado está ficando mais otimista ou pessimista?). O pipeline guarda o
 * histórico diário; aqui plotamos a mediana por ano-referência, com o carrego
 * estatístico do ano corrente como régua ("o que já está contratado").
 */

export function FocusPibCard({ pib, geradoEm }: { pib: AtividadePibData; geradoEm: string }) {
  const anoCorrente = parseInt(pib.trim_recente.slice(0, 4), 10);

  const series = useMemo<AzTimeSeries[]>(() => {
    const out: AzTimeSeries[] = [];
    const anos = [anoCorrente, anoCorrente + 1].filter((a) => (pib.focus[String(a)] ?? []).length > 0);
    anos.forEach((ano, i) => {
      const pontos = (pib.focus[String(ano)] ?? [])
        .filter((p) => p.mediana != null && p.data)
        .map((p) => [p.data, p.mediana as number] as const);
      out.push({
        id: `focus-${ano}`,
        label: `PIB ${ano} (mediana Focus)`,
        color: i === 0 ? AZ_BRAND.azure : AZ_SERIES[4],
        data: pontos,
      });
    });
    return out;
  }, [pib.focus, anoCorrente]);

  const refLines = useMemo<AzRefLine[]>(() => {
    const carrego = pib.carrego;
    if (!carrego || carrego.ano !== anoCorrente) return [];
    return [{ y: carrego.valor, label: `carrego ${carrego.ano}: ${fmtPct(carrego.valor, 1)}`, color: AZ_BRAND.navy }];
  }, [pib.carrego, anoCorrente]);

  const ultimaMediana = (ano: number): number | null => {
    const arr = pib.focus[String(ano)] ?? [];
    for (let i = arr.length - 1; i >= 0; i--) {
      if (arr[i].mediana != null) return arr[i].mediana;
    }
    return null;
  };

  const m0 = ultimaMediana(anoCorrente);
  const carregoAcima = pib.carrego && m0 != null && pib.carrego.ano === anoCorrente && pib.carrego.valor > m0;

  return (
    <ChartCard
      title={
        m0 != null
          ? `Mercado espera ${fmtPct(m0, 1)} para ${anoCorrente}${carregoAcima ? " — abaixo do que já está contratado" : ""}`
          : "Expectativas Focus — PIB anual"
      }
      subtitle="Mediana das projeções do boletim Focus ao longo do tempo de coleta. A linha navy é o carrego estatístico: o crescimento que o ano já garante se a economia ficar parada daqui em diante."
      footer="BCB Olinda — ExpectativasMercadoAnuais (PIB Total), mediana por data de coleta. Carrego: média do índice SA do ano com o último trimestre divulgado congelado ÷ média do ano anterior. Se o carrego supera a mediana, o Focus tende a ser revisado para cima."
      stampGiro={geradoEm}
      stampDado={series[0]?.data[series[0].data.length - 1]?.[0] ?? null}
    >
      <AzTimeSeriesChart series={series} unit="%" height={280} refLines={refLines} dots={false} />
    </ChartCard>
  );
}
