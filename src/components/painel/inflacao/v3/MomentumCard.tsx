"use client";

import { useMemo, useState } from "react";

import type { MomentumBlock } from "@/lib/painel-ipca";
import { AzSegmented, ChartCard } from "@/components/painel/core";
import { AzTimeSeriesChart, type AzTimeSeries } from "@/components/painel/charts/AzTimeSeriesChart";
import {
  AzPeriodSelector,
  type AzPeriodId,
  type AzPeriodValue,
} from "@/components/painel/charts/AzPeriodSelector";
import { mesIso } from "../v2/shared";

const PERIODOS: Exclude<AzPeriodId, "custom">[] = ["1y", "5y", "max"];

/**
 * Momentum da inflação: variação dessazonalizada (STL, no builder) anualizada
 * em janelas de 3 e 6 meses (SAAR) — a leitura "para onde a inflação está
 * indo AGORA", sem o retrovisor dos 12 meses. Réguas: meta 3% e banda.
 */

type Modo = "saar3" | "saar6";

const MODOS = [
  { id: "saar3", label: "3m anualizado" },
  { id: "saar6", label: "6m anualizado" },
];

function pontos(momentum: MomentumBlock, sid: string, campo: "saar_3m" | "saar_6m"): AzTimeSeries["data"] {
  const serie = momentum.series[sid] ?? [];
  const out: Array<[string, number]> = [];
  for (const p of serie) {
    const v = p[campo];
    if (v != null) out.push([mesIso(p.mes), v]);
  }
  return out;
}

export function MomentumCard({ momentum, geradoEm }: { momentum: MomentumBlock; geradoEm: string }) {
  const [modo, setModo] = useState<Modo>("saar3");
  const [period, setPeriod] = useState<AzPeriodValue>({ id: "5y" });

  const series = useMemo<AzTimeSeries[]>(() => {
    const campo = modo === "saar3" ? ("saar_3m" as const) : ("saar_6m" as const);
    const out: AzTimeSeries[] = [
      { id: "ipca", label: "IPCA", color: "#132960", data: pontos(momentum, "ipca", campo) },
    ];
    if (modo === "saar3" && momentum.media_nucleos_saar3m.length > 0) {
      out.push({
        id: "nucleos",
        label: "Média dos 5 núcleos",
        color: "#BE3B33",
        data: momentum.media_nucleos_saar3m.map((p) => [mesIso(p.mes), p.saar_3m] as [string, number]),
      });
    }
    out.push({ id: "servicos", label: "Serviços", color: "#027DFC", data: pontos(momentum, "servicos", campo) });
    return out.filter((s) => s.data.length > 0);
  }, [momentum, modo]);

  const ultimo = momentum.series.ipca?.[momentum.series.ipca.length - 1];

  if (series.length === 0) return null;

  return (
    <ChartCard
      title="Momentum dessazonalizado (SAAR)"
      subtitle="Taxa anualizada da janela recente, sem sazonalidade — a inflação corrente, não a dos últimos 12 meses."
      footer={`Dessazonalização ${momentum.metodo}. Ajuste desde ${momentum.ajuste_desde}; publicado desde ${momentum.publica_desde}. NÃO é o X-13 do BCB — método próprio, documentado no pipeline. Meta contínua 3,0% ± 1,5 p.p. como régua.`}
      toolbar={
        <div className="flex flex-wrap items-center gap-2">
          <AzSegmented options={MODOS} value={modo} onChange={(id) => setModo(id as Modo)} ariaLabel="Janela do SAAR" />
          <AzPeriodSelector value={period} onChange={setPeriod} periods={PERIODOS} />
        </div>
      }
      stampGiro={geradoEm}
      stampDado={ultimo?.mes ?? null}
    >
      <AzTimeSeriesChart
        series={series}
        unit="%"
        period={period}
        height={320}
        refLines={[{ y: 3.0, label: "Meta 3,0%", color: "#132960" }]}
        refAreas={[{ y1: 1.5, y2: 4.5, label: "Banda da meta", opacity: 0.05 }]}
      />
    </ChartCard>
  );
}
