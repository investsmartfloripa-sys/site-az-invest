"use client";

import { useMemo, useState } from "react";

import type { SerieLongaIgpmBlock } from "@/lib/painel-igpm";
import { AzSegmented, ChartCard } from "@/components/painel/core";
import { AzTimeSeriesChart, type AzRefLine, type AzTimeSeries } from "@/components/painel/charts/AzTimeSeriesChart";
import { AZ_BRAND, AZ_CHART } from "@/lib/az-chart-theme";
import { mesIso } from "../v2/shared";

/**
 * Tendência desde 1996: IGP-M acumulado 12m contra RÉGUAS PRÓPRIAS pós-Real
 * (mediana e faixa p10–p90 do 12m, do builder) — o IGP não tem meta; o IPCA
 * 12m entra como única referência externa (cinza tracejado). Modo alternativo:
 * variação mensal (sem réguas — são réguas do 12m).
 */

type Modo = "12m" | "mensal";

const MODOS = [
  { id: "12m", label: "Acumulado 12m" },
  { id: "mensal", label: "Variação mensal" },
];

export function SerieLongaIgpmCard({ longa, geradoEm }: { longa: SerieLongaIgpmBlock; geradoEm: string }) {
  const [modo, setModo] = useState<Modo>("12m");

  const { s12, sMensal, ipca12 } = useMemo(() => {
    const a: Array<[string, number]> = [];
    const m: Array<[string, number]> = [];
    const ip: Array<[string, number]> = [];
    for (const p of longa.serie) {
      const iso = mesIso(p.mes);
      if (p.acum_12m != null) a.push([iso, p.acum_12m]);
      if (p.var != null) m.push([iso, p.var]);
      if (p.ipca_12m != null) ip.push([iso, p.ipca_12m]);
    }
    return { s12: a, sMensal: m, ipca12: ip };
  }, [longa]);

  const reguas = longa.reguas;
  const refLines: AzRefLine[] =
    modo === "12m"
      ? [
          ...(reguas.mediana_12m != null
            ? [{ y: reguas.mediana_12m, label: "mediana pós-96", color: AZ_CHART.neg }]
            : []),
          ...(reguas.p10_12m != null ? [{ y: reguas.p10_12m, label: "p10", color: "#94A3B8" }] : []),
          ...(reguas.p90_12m != null ? [{ y: reguas.p90_12m, label: "p90", color: "#94A3B8" }] : []),
        ]
      : [];

  const principais: AzTimeSeries[] =
    modo === "12m"
      ? [{ id: "igpm12m", label: "IGP-M 12m", color: AZ_BRAND.navy, data: s12 }]
      : [{ id: "igpmMensal", label: "IGP-M mensal", color: AZ_BRAND.navy, data: sMensal }];
  const benchmarks: AzTimeSeries[] =
    modo === "12m" && ipca12.length > 0
      ? [{ id: "ipca12m", label: "IPCA 12m", color: AZ_CHART.ticks, data: ipca12 }]
      : [];

  if (s12.length === 0 && sMensal.length === 0) return null;

  return (
    <ChartCard
      title="IGP-M desde 1996"
      toolbar={
        <AzSegmented options={MODOS} value={modo} onChange={(id) => setModo(id as Modo)} ariaLabel="Transformação da série longa" />
      }
      footer={`O IGP-M não tem meta — as réguas são PRÓPRIAS, calculadas no pipeline sobre o pós-Real (desde ${reguas.desde}): mediana e faixa p10–p90 do acumulado 12m (n = ${reguas.n}). IPCA 12m como única referência externa. 12m COMPOSTO no builder, validado contra os oficiais FGV.`}
      stampGiro={geradoEm}
      stampDado={longa.serie.at(-1)?.mes ?? null}
    >
      <AzTimeSeriesChart series={principais} benchmarks={benchmarks} refLines={refLines} unit="%" height={360} showLegend />
    </ChartCard>
  );
}
