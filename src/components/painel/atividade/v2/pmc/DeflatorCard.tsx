"use client";

import { useMemo, useState } from "react";

import type { AtividadePmcData, CodaceFaixaAtividade } from "@/lib/painel-atividade";
import { AzSegmented, ChartCard } from "@/components/painel/core";
import { AzPeriodSelector, type AzPeriodValue } from "@/components/painel/charts/AzPeriodSelector";
import { AzTimeSeriesChart } from "@/components/painel/charts/AzTimeSeriesChart";
import { AZ_BRAND } from "@/lib/az-chart-theme";
import { fmtPct } from "@/lib/format-br";
import { codaceAreas, mmPoints, toPointsMes } from "../shared";

/**
 * Deflator implícito do varejo — "quanta inflação há nas vendas?".
 *
 * O gráfico antigo deixava o leitor inferir o vão entre receita nominal e
 * volume; aqui o vão É plotado: deflator = (1 + receita) ÷ (1 + volume) − 1,
 * calculado no builder (schema v2), em destaque rust. Receita nominal só
 * aparece aqui — em VARIAÇÃO, nunca em nível.
 */

type Escopo = "restrito" | "ampliado";

const ESCOPO_OPCOES = [
  { id: "restrito", label: "Restrito" },
  { id: "ampliado", label: "Ampliado" },
];

export function DeflatorCard({
  pmc,
  codaceMensal,
  geradoEm,
}: {
  pmc: AtividadePmcData;
  codaceMensal?: CodaceFaixaAtividade[];
  geradoEm: string;
}) {
  const [escopo, setEscopo] = useState<Escopo>("restrito");
  const [period, setPeriod] = useState<AzPeriodValue>({ id: "5y" });

  const volumePts = useMemo(() => mmPoints(toPointsMes(pmc.serie, `${escopo}_volume_var_yoy`), 3), [pmc.serie, escopo]);
  const receitaPts = useMemo(
    () => mmPoints(toPointsMes(pmc.serie, `${escopo}_receita_nominal_var_yoy`), 3),
    [pmc.serie, escopo],
  );
  const deflatorPts = useMemo(() => mmPoints(toPointsMes(pmc.serie, `${escopo}_deflator_yoy`), 3), [pmc.serie, escopo]);
  const faixas = useMemo(() => codaceAreas(codaceMensal), [codaceMensal]);

  const minIso = volumePts.length > 0 ? volumePts[0][0] : "";
  const maxIso = volumePts.length > 0 ? volumePts[volumePts.length - 1][0] : "";

  const ultDeflator = deflatorPts.length > 0 ? deflatorPts[deflatorPts.length - 1][1] : null;
  const titulo =
    ultDeflator != null
      ? `Inflação embutida nas vendas do varejo ${escopo} roda a ${fmtPct(ultDeflator, 1)} ao ano`
      : "Volume × receita nominal × deflator implícito";

  return (
    <ChartCard
      title={titulo}
      subtitle="Quanto da alta da receita é preço, não consumo? O deflator implícito — o vão entre receita nominal e volume, plotado explicitamente — é a inflação da cesta do varejo."
      toolbar={
        <>
          <AzSegmented
            ariaLabel="Escopo do varejo"
            options={ESCOPO_OPCOES}
            value={escopo}
            onChange={(id) => setEscopo(id as Escopo)}
          />
          <AzPeriodSelector value={period} onChange={setPeriod} min={minIso} max={maxIso} periods={["1y", "5y", "max"]} />
        </>
      }
      footer="Deflator implícito = (1 + receita nominal YoY) ÷ (1 + volume YoY) − 1, calculado no pipeline (schema v2) — aproxima a inflação da cesta do varejo; compare com o IPCA de bens. Todas as séries suavizadas por média móvel de 3 meses (SIDRA 8880/8881 restrito; 8882/8883 ampliado). Faixas cinzas: recessões CODACE/FGV."
      stampGiro={geradoEm}
      stampDado={maxIso || null}
    >
      <AzTimeSeriesChart
        series={[
          { id: "volume", label: "Volume (YoY, mm3)", color: AZ_BRAND.azure, data: volumePts },
          { id: "receita", label: "Receita nominal (YoY, mm3)", color: AZ_BRAND.navy, data: receitaPts },
          { id: "deflator", label: "Deflator implícito (mm3)", color: AZ_BRAND.rust, data: deflatorPts },
        ]}
        unit="%"
        period={period}
        height={320}
        xRefAreas={faixas}
        showLegend
      />
    </ChartCard>
  );
}
