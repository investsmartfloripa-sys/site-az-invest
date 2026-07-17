"use client";

import { useMemo, useState } from "react";

import type { OrigemIpaBlock } from "@/lib/painel-igpm";
import { AzSegmented, ChartCard } from "@/components/painel/core";
import { AzTimeSeriesChart, type AzSeriesPoint, type AzTimeSeries } from "@/components/painel/charts/AzTimeSeriesChart";
import { AZ_BRAND, AZ_CHART } from "@/lib/az-chart-theme";
import { fmtNum } from "@/lib/format-br";
import { mesIso } from "../v2/shared";

/**
 * Abertura do atacado por origem: agrícola × industrial (família IPA-DI,
 * proxy da dinâmica do IPA-M). Só renderiza quando o builder PUBLICOU o bloco
 * — a identificação das séries SGS 7459/7460 (rótulo ambíguo no BCB) é
 * revalidada a cada build; se falha, origem_ipa vem null e o card some.
 */

type Modo = "mensal" | "12m";

const MODOS = [
  { id: "mensal", label: "Mensal" },
  { id: "12m", label: "Acum. 12m" },
];

const COR_AGRO = AZ_CHART.pos; // verde — convenção "agro"
const COR_IND = AZ_BRAND.navy;

export function OrigemIpaCard({ origem, geradoEm }: { origem: OrigemIpaBlock; geradoEm: string }) {
  const [modo, setModo] = useState<Modo>("12m");

  const { agroM, indM, agro12, ind12 } = useMemo(() => {
    const aM: AzSeriesPoint[] = [];
    const iM: AzSeriesPoint[] = [];
    const a12: AzSeriesPoint[] = [];
    const i12: AzSeriesPoint[] = [];
    for (const r of origem.serie) {
      const iso = mesIso(r.mes);
      if (r.agro != null) aM.push([iso, r.agro]);
      if (r.ind != null) iM.push([iso, r.ind]);
      if (r.agro_12m != null) a12.push([iso, r.agro_12m]);
      if (r.ind_12m != null) i12.push([iso, r.ind_12m]);
    }
    return { agroM: aM, indM: iM, agro12: a12, ind12: i12 };
  }, [origem.serie]);

  const series: AzTimeSeries[] = (
    modo === "12m"
      ? [
          { id: "agro", label: "Agrícola 12m", color: COR_AGRO, data: agro12 },
          { id: "ind", label: "Industrial 12m", color: COR_IND, data: ind12 },
        ]
      : [
          { id: "agro", label: "Agrícola mensal", color: COR_AGRO, data: agroM },
          { id: "ind", label: "Industrial mensal", color: COR_IND, data: indM },
        ]
  ).filter((s) => s.data.length > 0);

  if (series.length === 0) return null;

  const ident = origem.identificacao;

  return (
    <ChartCard
      title="IPA por origem — agrícola × industrial"
      toolbar={
        <AzSegmented options={MODOS} value={modo} onChange={(id) => setModo(id as Modo)} ariaLabel="Transformação da abertura de origem" />
      }
      footer={`${origem.familia}. Identificação revalidada a cada build: ${ident.metodo} — w_agro ${fmtNum(ident.w_agro, 3)}, R² ${fmtNum(ident.r2, 4)}; SGS ${ident.codigo_agro} = agrícola, SGS ${ident.codigo_ind} = industrial. Se qualquer critério falha, o bloco NÃO é publicado. Acumulado 12m composto no pipeline.`}
      stampGiro={geradoEm}
      stampDado={origem.serie.at(-1)?.mes ?? null}
    >
      <AzTimeSeriesChart series={series} unit="%" height={300} showLegend />
    </ChartCard>
  );
}
