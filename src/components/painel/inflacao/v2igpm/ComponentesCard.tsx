"use client";

import { useMemo } from "react";

import type { IgpmData } from "@/lib/painel-igpm";
import { ChartCard } from "@/components/painel/core";
import { AzTimeSeriesChart, type AzSeriesPoint } from "@/components/painel/charts/AzTimeSeriesChart";
import { AZ_CHART } from "@/lib/az-chart-theme";
import { fmtPct } from "@/lib/format-br";
import { CORES_COMPONENTE, mesIso, nomeCurto } from "./shared";

/**
 * Bloco 01 — "o que está acelerando dentro do IGP-M?".
 *
 * Os três componentes em acumulado 12m COMPOSTO (calculado no builder, único
 * lugar certo) + IPCA 12m como referência em cinza tracejado (regra do
 * padrão: o IPCA no painel IGP-M é régua, não protagonista). Janela de 10
 * anos — pega o episódio 2020-21 (câmbio+commodities → IPA a 35%+).
 */
export function ComponentesCard({ data }: { data: IgpmData }) {
  const componentes = data.componentes;
  const nomes = Object.keys(CORES_COMPONENTE).filter((c) => componentes[c]);

  const series = useMemo(
    () =>
      nomes.map((c) => ({
        id: c,
        label: `${nomeCurto(c)} 12m`,
        color: CORES_COMPONENTE[c],
        data: componentes[c].serie_longa
          .filter((r) => r.acum_12m != null)
          .map((r) => [mesIso(r.mes), r.acum_12m as number] as const),
      })),
    [componentes, nomes],
  );

  const ipca = useMemo<AzSeriesPoint[]>(() => {
    const primeiro = nomes[0] ? componentes[nomes[0]] : undefined;
    return (primeiro?.serie_longa ?? [])
      .filter((r) => r.ipca_12m != null)
      .map((r) => [mesIso(r.mes), r.ipca_12m as number]);
  }, [componentes, nomes]);

  const ultimo = (c: string) => componentes[c]?.ultimo_12m ?? null;
  const titulo =
    nomes.length === 3
      ? `IPA em ${fmtPct(ultimo("IPA-M"), 1)}, IPC em ${fmtPct(ultimo("IPC-M"), 1)} e INCC em ${fmtPct(ultimo("INCC-M"), 1)} em 12 meses`
      : "Componentes do IGP-M em 12 meses";

  const pIpa = componentes["IPA-M"]?.estatisticas_12m?.percentil_atual;

  return (
    <ChartCard
      title={titulo}
      subtitle="Qual componente dita o ritmo do IGP-M? Acumulado 12 meses composto de atacado, varejo FGV e construção; IPCA como referência."
      footer={`Acumulado 12m por composição geométrica no pipeline (nunca soma de variações). O IPA — câmbio + commodities — é o componente mais volátil e o que descola o IGP-M do IPCA${typeof pIpa === "number" ? `; hoje está no percentil ${fmtPct(pIpa, 0).replace("%", "")} do histórico pós-1996` : ""}.`}
      stampGiro={data.gerado_em}
      stampDado={data.mes_recente}
    >
      <AzTimeSeriesChart
        series={series}
        benchmarks={[{ id: "ipca", label: "IPCA 12m (referência)", color: AZ_CHART.ticks, data: ipca }]}
        unit="%"
        height={300}
      />
    </ChartCard>
  );
}
