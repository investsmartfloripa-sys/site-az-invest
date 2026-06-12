"use client";

import { useMemo, useState } from "react";

import type { AtividadePmsData, CodaceFaixaAtividade } from "@/lib/painel-atividade";
import { ChartCard } from "@/components/painel/core";
import { AzPeriodSelector, type AzPeriodValue } from "@/components/painel/charts/AzPeriodSelector";
import { AzTimeSeriesChart } from "@/components/painel/charts/AzTimeSeriesChart";
import { AZ_BRAND } from "@/lib/az-chart-theme";
import { fmtPct } from "@/lib/format-br";
import { codaceAreas, mmPoints, rebase100, toPointsMes } from "../shared";

/**
 * ÂNCORA do Painel PMS v2 — nível e momentum em DOIS painéis empilhados
 * (nunca eixo duplo): (a) o ciclo longo, nível de volume SA rebasado para
 * fev/2020 = 100, com recessões CODACE; (b) o momentum, variação mensal SA
 * suavizada por média móvel de 3 meses. Period state compartilhado.
 *
 * "Aceleram" quando a mm3 do MoM SA é positiva; "perdem fôlego" quando
 * negativa — regra binária declarada, sem juízo editorial caso a caso.
 */

export function AnchorNivelMomentumPms({
  pms,
  codaceMensal,
  geradoEm,
}: {
  pms: AtividadePmsData;
  codaceMensal?: CodaceFaixaAtividade[];
  geradoEm: string;
}) {
  const [period, setPeriod] = useState<AzPeriodValue>({ id: "5y" });

  const nivelPts = useMemo(() => rebase100(toPointsMes(pms.serie, "volume_indice_sa")), [pms.serie]);
  const momentumPts = useMemo(() => mmPoints(toPointsMes(pms.serie, "volume_var_mom_sa"), 3), [pms.serie]);
  const faixas = useMemo(() => codaceAreas(codaceMensal), [codaceMensal]);

  const minIso = nivelPts.length > 0 ? nivelPts[0][0] : "";
  const maxIso = nivelPts.length > 0 ? nivelPts[nivelPts.length - 1][0] : "";

  const gap = nivelPts.length > 0 ? +(nivelPts[nivelPts.length - 1][1] - 100).toFixed(1) : null;
  const mm3Ult = momentumPts.length > 0 ? momentumPts[momentumPts.length - 1][1] : null;

  const titulo =
    gap != null
      ? `Serviços operam ${fmtPct(Math.abs(gap), 1)} ${gap >= 0 ? "acima" : "abaixo"} de fev/2020${
          mm3Ult != null ? ` — e ${mm3Ult >= 0 ? "aceleram" : "perdem fôlego"} na margem` : ""
        }`
      : "Serviços — nível e momentum";

  return (
    <ChartCard
      title={titulo}
      subtitle="O motor do PIB pós-pandemia sustenta o ritmo? Painel de cima: nível de volume com ajuste sazonal, rebasado para fev/2020 = 100 (o ciclo longo). Painel de baixo: variação mensal SA suavizada por média móvel de 3 meses (o momentum)."
      toolbar={<AzPeriodSelector value={period} onChange={setPeriod} min={minIso} max={maxIso} periods={["1y", "5y", "max"]} />}
      footer="SIDRA 5906 — índice de volume com ajuste sazonal (base 2022 = 100), rebasado para fev/2020 = 100 no site. Momentum: média móvel de 3 meses da variação mensal SA (mm3 amortece o ruído mês a mês). Faixas cinzas: recessões CODACE/FGV — a cronologia é atualizada com anos de defasagem (última datação: 2020)."
      stampGiro={geradoEm}
      stampDado={maxIso || null}
    >
      <div className="flex flex-col gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Nível de volume SA (fev/2020 = 100)</p>
        <AzTimeSeriesChart
          series={[{ id: "nivel", label: "Volume de serviços (SA)", color: AZ_BRAND.azure, data: nivelPts }]}
          unit="index"
          period={period}
          height={220}
          xRefAreas={faixas}
          refLines={[{ y: 100, label: "fev/2020", color: "#94A3B8" }]}
          showLegend={false}
        />

        <p className="mt-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
          Momentum — variação mensal SA, média móvel de 3 meses
        </p>
        <AzTimeSeriesChart
          series={[{ id: "mom", label: "MoM SA (mm3)", color: AZ_BRAND.navy, data: momentumPts }]}
          unit="%"
          period={period}
          height={180}
          showLegend={false}
        />
      </div>
    </ChartCard>
  );
}
