"use client";

import { useMemo } from "react";

import type { CategoriasBlock, NucleosBlock } from "@/lib/painel-ipca";
import { ChartCard } from "@/components/painel/core";
import { AzTimeSeriesChart } from "@/components/painel/charts/AzTimeSeriesChart";
import { AZ_BRAND, AZ_CHART, AZ_SERIES } from "@/lib/az-chart-theme";
import { fmtPct } from "@/lib/format-br";
import { META, META_PISO, META_TETO, num, toPoints } from "./shared";

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
  const livresU = ultimo ? num(ultimo, "Livres") : null;
  const monitU = ultimo ? num(ultimo, "Monitorados") : null;
  const servU = ultimo ? num(ultimo, "Servicos") : null;

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
        title={
          livresU != null && monitU != null
            ? `Monitorados em ${fmtPct(monitU, 1)} × livres em ${fmtPct(livresU, 1)} (12m)`
            : "Livres × Monitorados (12m)"
        }
        subtitle="Quanto da inflação vem de preços administrados (energia, combustíveis, tarifas), que a política de juros não alcança diretamente?"
        footer="Acumulado 12m por composição geométrica (BCB SGS 4448 e 4449), calculado no pipeline."
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
        title={servU != null ? `Serviços em ${fmtPct(servU, 1)} em 12 meses` : "Serviços (12m)"}
        subtitle="A inflação de serviços — a mais sensível ao ciclo e ao juro — está cedendo? IPCA cheio como referência."
        footer="BCB SGS 11428, 12m composto no pipeline. Serviços subjacentes (cesta do RI) entram quando houver série oficial vigente; momentum dessazonalizado na próxima fase."
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
