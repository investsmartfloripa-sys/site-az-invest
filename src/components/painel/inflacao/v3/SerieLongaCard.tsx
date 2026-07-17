"use client";

import { useMemo, useState } from "react";

import type { SerieLongaBlock } from "@/lib/painel-ipca";
import { AzSegmented, ChartCard } from "@/components/painel/core";
import { AzTimeSeriesChart, type AzTimeSeries } from "@/components/painel/charts/AzTimeSeriesChart";
import { mesIso } from "../v2/shared";

/**
 * Tendência desde 1999: IPCA acumulado 12m contra a META ESCALONADA do CMN
 * (centro/piso/teto vigentes em cada mês, em degraus — as próprias linhas de
 * referência contam a história dos estouros). Modo alternativo: variação mensal.
 */

type Modo = "12m" | "mensal";

const MODOS = [
  { id: "12m", label: "Acumulado 12m" },
  { id: "mensal", label: "Variação mensal" },
];

export function SerieLongaCard({ longa, geradoEm }: { longa: SerieLongaBlock; geradoEm: string }) {
  const [modo, setModo] = useState<Modo>("12m");

  const { principais, referencias } = useMemo(() => {
    const s12: Array<[string, number]> = [];
    const sMensal: Array<[string, number]> = [];
    const meta: Array<[string, number]> = [];
    const piso: Array<[string, number]> = [];
    const teto: Array<[string, number]> = [];
    for (const p of longa.serie) {
      const iso = mesIso(p.mes);
      if (p.acum_12m != null) s12.push([iso, p.acum_12m]);
      if (p.var != null) sMensal.push([iso, p.var]);
      meta.push([iso, p.meta]);
      piso.push([iso, p.piso]);
      teto.push([iso, p.teto]);
    }
    const principais: AzTimeSeries[] =
      modo === "12m"
        ? [{ id: "ipca12m", label: "IPCA 12m", color: "#132960", data: s12 }]
        : [{ id: "ipcaMensal", label: "IPCA mensal", color: "#132960", data: sMensal }];
    const referencias: AzTimeSeries[] =
      modo === "12m"
        ? [
            { id: "meta", label: "Meta CMN", color: "#BE3B33", type: "stepAfter", data: meta },
            { id: "teto", label: "Teto", color: "#94A3B8", type: "stepAfter", data: teto },
            { id: "piso", label: "Piso", color: "#94A3B8", type: "stepAfter", data: piso },
          ]
        : [];
    return { principais, referencias };
  }, [longa, modo]);

  return (
    <ChartCard
      title={`IPCA desde ${longa.desde.slice(0, 4)}`}
      toolbar={
        <AzSegmented options={MODOS} value={modo} onChange={(id) => setModo(id as Modo)} ariaLabel="Transformação da série longa" />
      }
      stampGiro={geradoEm}
      stampDado={longa.serie.at(-1)?.mes ?? null}
    >
      <AzTimeSeriesChart series={principais} benchmarks={referencias} unit="%" height={360} showLegend />
    </ChartCard>
  );
}
