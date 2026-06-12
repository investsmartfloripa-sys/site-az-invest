"use client";

import { useMemo, useState } from "react";

import type { AtividadePmcData } from "@/lib/painel-atividade";
import { ChartCard } from "@/components/painel/core";
import { AzPeriodSelector, type AzPeriodValue } from "@/components/painel/charts/AzPeriodSelector";
import { AzTimeSeriesChart } from "@/components/painel/charts/AzTimeSeriesChart";
import { AZ_BRAND } from "@/lib/az-chart-theme";
import { addMonthsUTC, fmtSignedPct } from "@/lib/format-br";
import { mesIso, mmPoints, toPointsMes } from "../shared";

/**
 * Momentum do varejo — a MoM SA crua é ruidosa demais para leitura de
 * tendência; aqui entra SUAVIZADA (mm3), restrito × ampliado, com a linha do
 * zero como régua: acima = o varejo acelera na margem, abaixo = perde fôlego.
 * Janela default ~36 meses (o choque de 2020 esmagaria a escala).
 */

/** Banda de "anda de lado" do título (p.p. ao mês). */
const BANDA_TITULO = 0.05;

export function MomentumPmc({ pmc, geradoEm }: { pmc: AtividadePmcData; geradoEm: string }) {
  const restritoPts = useMemo(() => mmPoints(toPointsMes(pmc.serie, "restrito_volume_var_mom_sa"), 3), [pmc.serie]);
  const ampliadoPts = useMemo(() => mmPoints(toPointsMes(pmc.serie, "ampliado_volume_var_mom_sa"), 3), [pmc.serie]);

  const minIso = restritoPts.length > 0 ? restritoPts[0][0] : "";
  const maxIso = restritoPts.length > 0 ? restritoPts[restritoPts.length - 1][0] : "";

  // Default ~36 meses: range custom explícito (não há pílula "3A" no seletor).
  const [period, setPeriod] = useState<AzPeriodValue>(() =>
    maxIso ? { id: "custom", from: addMonthsUTC(maxIso, -36), to: maxIso } : { id: "5y" },
  );

  const ultRestrito = restritoPts.length > 0 ? restritoPts[restritoPts.length - 1][1] : null;
  const titulo =
    ultRestrito != null
      ? `Na margem, o varejo ${
          ultRestrito > BANDA_TITULO ? "ganha tração" : ultRestrito < -BANDA_TITULO ? "perde fôlego" : "anda de lado"
        } — média de 3 meses em ${fmtSignedPct(ultRestrito, 2)} ao mês`
      : "Momentum do varejo — MoM SA suavizada (mm3)";

  return (
    <ChartCard
      title={titulo}
      subtitle="O varejo acelera ou perde fôlego na margem? Variação mensal com ajuste sazonal, suavizada por média móvel de 3 meses — acima do zero o consumo cresce ante o mês anterior."
      toolbar={<AzPeriodSelector value={period} onChange={setPeriod} min={minIso} max={maxIso} periods={["1y", "5y", "max"]} />}
      footer="MoM SA: variação sobre o mês imediatamente anterior, com ajuste sazonal do IBGE (SIDRA 8880 restrito; 8882 ampliado), suavizada por média móvel de 3 meses. A MoM crua mês a mês é ruído — a mm3 é a leitura de tendência."
      stampGiro={geradoEm}
      stampDado={pmc.mes_recente ? mesIso(pmc.mes_recente) : null}
    >
      <AzTimeSeriesChart
        series={[
          { id: "restrito", label: "Restrito (MoM SA, mm3)", color: AZ_BRAND.azure, data: restritoPts },
          { id: "ampliado", label: "Ampliado (MoM SA, mm3)", color: AZ_BRAND.navy, data: ampliadoPts },
        ]}
        unit="%"
        period={period}
        height={280}
        showLegend
      />
    </ChartCard>
  );
}
