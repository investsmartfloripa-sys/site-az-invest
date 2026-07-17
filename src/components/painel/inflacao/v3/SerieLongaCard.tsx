"use client";

import { useMemo, useState } from "react";

import type { SerieLongaBlock } from "@/lib/painel-ipca";
import { AzSegmented, ChartCard } from "@/components/painel/core";
import { AzTimeSeriesChart, type AzTimeSeries } from "@/components/painel/charts/AzTimeSeriesChart";
import {
  AzPeriodSelector,
  type AzPeriodId,
  type AzPeriodValue,
} from "@/components/painel/charts/AzPeriodSelector";
import { fmtMesCurto } from "@/lib/format-br";
import { mesIso } from "../v2/shared";

/**
 * Tendência desde 1999: IPCA acumulado 12m contra a META ESCALONADA do CMN
 * (centro/piso/teto vigentes em cada mês, em degraus) — o gráfico
 * institucional da história do regime de metas. Modo alternativo: variação
 * mensal (com brush p/ navegar 27 anos de série).
 */

type Modo = "12m" | "mensal";

const MODOS = [
  { id: "12m", label: "Acumulado 12m" },
  { id: "mensal", label: "Variação mensal" },
];

const PERIODOS: Exclude<AzPeriodId, "custom">[] = ["5y", "max"];

export function SerieLongaCard({ longa, geradoEm }: { longa: SerieLongaBlock; geradoEm: string }) {
  const [modo, setModo] = useState<Modo>("12m");
  const [period, setPeriod] = useState<AzPeriodValue>({ id: "max" });

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

  const ultimo = longa.serie.at(-1);

  return (
    <ChartCard
      title={`IPCA desde ${longa.desde.slice(0, 4)} — a série do regime de metas`}
      subtitle="Acumulado 12m oficial contra a meta vigente em cada momento (degraus = decisões do CMN; contínua de 3,0% desde 2025)."
      footer="SGS 433 (mensal) e 13522 (12m oficial). Metas e tolerâncias por resolução do CMN, 2003-04 nas versões ajustadas (convenção da tabela histórica do BCB); desde 2025, meta contínua de 3,0% ± 1,5 p.p. Antes de 1999 a comparação institucional não vale — a série começa com o regime."
      toolbar={
        <div className="flex flex-wrap items-center gap-2">
          <AzSegmented options={MODOS} value={modo} onChange={(id) => setModo(id as Modo)} ariaLabel="Transformação da série longa" />
          <AzPeriodSelector value={period} onChange={setPeriod} periods={PERIODOS} />
        </div>
      }
      stampGiro={geradoEm}
      stampDado={ultimo?.mes ?? null}
    >
      <AzTimeSeriesChart
        series={principais}
        benchmarks={referencias}
        unit="%"
        period={period}
        height={340}
        showBrush={modo === "mensal"}
        showLegend
      />
      {ultimo ? (
        <p className="mt-2 text-[11px] text-zinc-500">
          Última observação ({fmtMesCurto(ultimo.mes)}): meta {ultimo.meta.toLocaleString("pt-BR")}% · banda{" "}
          {ultimo.piso.toLocaleString("pt-BR")}%–{ultimo.teto.toLocaleString("pt-BR")}%.
        </p>
      ) : null}
    </ChartCard>
  );
}
