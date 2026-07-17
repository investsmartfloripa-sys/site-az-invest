"use client";

import { useMemo } from "react";

import type { CategoriasBlock, NucleosBlock } from "@/lib/painel-ipca";
import { ChartCard } from "@/components/painel/core";
import { AzTimeSeriesChart } from "@/components/painel/charts/AzTimeSeriesChart";
import { AZ_BRAND, AZ_CHART, AZ_SERIES } from "@/lib/az-chart-theme";
import { META, META_PISO, META_TETO, toPoints } from "./shared";

/**
 * Bloco 02 — abertura do IPCA em DOIS cards com perguntas distintas (regra da
 * crítica: nada de conjuntos sobrepostos no mesmo gráfico — Serviços ⊂ Livres
 * não é partição de nada):
 *  (a) Livres × Monitorados — quanto da inflação o juro não alcança?
 *  (b) Serviços — a inflação que o juro combate está cedendo? (IPCA cheio
 *      entra só como REFERÊNCIA em cinza tracejado, convenção do padrão visual)
 *
 * Tudo em 12m composto do builder. Serviços subjacentes (SGS 25255 morta) e
 * momentum dessazonalizado ficam para a fatia 2.
 */
export function AberturaCards({
  categorias,
  nucleos,
  geradoEm,
}: {
  categorias: CategoriasBlock | undefined;
  nucleos: NucleosBlock;
  geradoEm: string;
}) {
  const serie12 = useMemo(() => categorias?.serie_12m ?? [], [categorias?.serie_12m]);

  const livres = useMemo(() => toPoints(serie12, "Livres"), [serie12]);
  const monitorados = useMemo(() => toPoints(serie12, "Monitorados"), [serie12]);
  const servicos = useMemo(() => toPoints(serie12, "Servicos"), [serie12]);
  const ipca12 = useMemo(() => toPoints(nucleos.serie_12m ?? [], "IPCA cheio"), [nucleos.serie_12m]);

  const ultimo = serie12[serie12.length - 1];

  if (serie12.length === 0) {
    return (
      <p className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-500">
        Séries de categorias em 12m ainda não disponíveis neste JSON.
      </p>
    );
  }

  const metaRefs = {
    refAreas: [
      {
        y1: META_PISO,
        y2: META_TETO,
        color: AZ_CHART.ticks,
        opacity: 0.08,
        label: "banda da meta",
      },
    ],
    refLines: [{ y: META, label: "meta 3,0%", color: AZ_BRAND.navy }],
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <ChartCard
        title="Preços livres × monitorados (12 meses)"
        stampGiro={geradoEm}
        stampDado={ultimo?.mes ?? null}
      >
        <AzTimeSeriesChart
          series={[
            { id: "livres", label: "Livres", color: AZ_BRAND.azure, data: livres },
            { id: "monitorados", label: "Monitorados", color: AZ_SERIES[5], data: monitorados },
          ]}
          unit="%"
          height={260}
          refAreas={metaRefs.refAreas}
          refLines={metaRefs.refLines}
        />
      </ChartCard>

      <ChartCard
        title="Serviços (12 meses)"
        stampGiro={geradoEm}
        stampDado={ultimo?.mes ?? null}
      >
        <AzTimeSeriesChart
          series={[{ id: "servicos", label: "Serviços", color: AZ_BRAND.azure, data: servicos }]}
          benchmarks={[{ id: "ipca", label: "IPCA cheio (12m)", color: AZ_CHART.ticks, data: ipca12 }]}
          unit="%"
          height={260}
          refAreas={metaRefs.refAreas}
          refLines={metaRefs.refLines}
        />
      </ChartCard>
    </div>
  );
}
