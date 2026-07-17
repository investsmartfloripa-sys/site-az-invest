"use client";

import { useMemo } from "react";

import type { Focus12mPonto } from "@/lib/painel-ipca";
import { ChartCard } from "@/components/painel/core";
import { AzTimeSeriesChart, type AzTimeSeries } from "@/components/painel/charts/AzTimeSeriesChart";
import { fmtMesCurto, fmtPct } from "@/lib/format-br";
import { mesIso } from "../v2/shared";

/**
 * Ancoragem das expectativas: mediana Focus do IPCA 12 MESES À FRENTE
 * (suavizada) contra a meta contínua — a distância dessa linha aos 3,0%
 * é a medida clássica de (des)ancoragem.
 */
export function AncoragemCard({ focus12m, geradoEm }: { focus12m: Focus12mPonto[]; geradoEm: string }) {
  const series = useMemo<AzTimeSeries[]>(
    () => [
      {
        id: "focus12m",
        label: "Focus 12m à frente (suavizada)",
        color: "#132960",
        data: focus12m.map((p) => [mesIso(p.mes), p.mediana] as [string, number]),
      },
    ],
    [focus12m],
  );

  const ultimo = focus12m.at(-1);
  if (!ultimo) return null;

  return (
    <ChartCard
      title="Ancoragem — expectativa 12 meses à frente"
      subtitle="Mediana Focus do IPCA acumulado nos próximos 12 meses (suavizada). A distância à meta de 3,0% mede a ancoragem."
      footer="BCB/Olinda ExpectativasMercadoInflacao12Meses (Suavizada = S, baseCalculo = 0), última pesquisa de cada mês civil. Meta contínua 3,0% ± 1,5 p.p. desde 2025."
      stampGiro={geradoEm}
      stampDado={ultimo.data}
    >
      <p className="mb-2 text-xs text-zinc-600">
        Última leitura ({fmtMesCurto(ultimo.mes)}): <strong className="text-[#132960]">{fmtPct(ultimo.mediana, 2)}</strong>{" "}
        — {(ultimo.mediana - 3).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2, signDisplay: "always" })}{" "}
        p.p. do centro da meta.
      </p>
      <AzTimeSeriesChart
        series={series}
        unit="%"
        height={300}
        refLines={[{ y: 3.0, label: "Meta 3,0%", color: "#BE3B33" }]}
        refAreas={[{ y1: 1.5, y2: 4.5, label: "Banda", opacity: 0.05 }]}
        showLegend={false}
      />
    </ChartCard>
  );
}
