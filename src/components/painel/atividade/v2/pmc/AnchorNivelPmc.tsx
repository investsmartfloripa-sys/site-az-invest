"use client";

import { useMemo, useState } from "react";

import type { AtividadePmcData, CodaceFaixaAtividade } from "@/lib/painel-atividade";
import { ChartCard } from "@/components/painel/core";
import { AzPeriodSelector, type AzPeriodValue } from "@/components/painel/charts/AzPeriodSelector";
import { AzTimeSeriesChart } from "@/components/painel/charts/AzTimeSeriesChart";
import { AZ_BRAND } from "@/lib/az-chart-theme";
import { fmtPct } from "@/lib/format-br";
import { codaceAreas, mesIso, rebase100, toPointsMes } from "../shared";

/**
 * ÂNCORA do Painel PMC v2 — "o consumo de bens já voltou ao pré-pandemia?".
 *
 * Nível do volume de vendas (índice SA) do varejo restrito × ampliado, AMBOS
 * rebasados para fev/2020 = 100 — cada série rebasa no próprio ponto-base
 * (restrito desde 2000, ampliado desde 2003). Receita nominal NÃO entra:
 * em nível ela sobe sempre, por inflação — seria gráfico mentiroso.
 */

export function AnchorNivelPmc({
  pmc,
  codaceMensal,
  geradoEm,
}: {
  pmc: AtividadePmcData;
  codaceMensal?: CodaceFaixaAtividade[];
  geradoEm: string;
}) {
  const [period, setPeriod] = useState<AzPeriodValue>({ id: "5y" });

  const restritoPts = useMemo(() => rebase100(toPointsMes(pmc.serie, "restrito_volume_indice_sa")), [pmc.serie]);
  const ampliadoPts = useMemo(() => rebase100(toPointsMes(pmc.serie, "ampliado_volume_indice_sa")), [pmc.serie]);
  const faixas = useMemo(() => codaceAreas(codaceMensal), [codaceMensal]);

  const minIso = restritoPts.length > 0 ? restritoPts[0][0] : "";
  const maxIso = restritoPts.length > 0 ? restritoPts[restritoPts.length - 1][0] : "";

  // Título afirmativo por regra: nível atual do restrito vs fev/2020 + leitura do ampliado.
  const titulo = useMemo(() => {
    const ultR = restritoPts.length > 0 ? restritoPts[restritoPts.length - 1][1] : null;
    const ultA = ampliadoPts.length > 0 ? ampliadoPts[ampliadoPts.length - 1][1] : null;
    if (ultR == null) return "Varejo restrito × ampliado — nível de vendas (fev/2020 = 100)";
    const base = `Consumo de bens está ${fmtPct(Math.abs(ultR - 100), 1)} ${ultR >= 100 ? "acima" : "abaixo"} de fev/2020`;
    if (ultA == null) return base;
    return `${base} — e o ampliado ${ultA >= ultR ? "acompanha" : "fica para trás"}`;
  }, [restritoPts, ampliadoPts]);

  return (
    <ChartCard
      title={titulo}
      subtitle="O consumo de bens já voltou (e passou) o nível pré-pandemia? Volume de vendas com ajuste sazonal, restrito × ampliado, ambos rebasados para fev/2020 = 100 — o último mês antes do choque covid."
      toolbar={<AzPeriodSelector value={period} onChange={setPeriod} min={minIso} max={maxIso} periods={["1y", "5y", "max"]} />}
      footer="Volume de vendas deflacionado (índice SA, base 2022 = 100), rebasado p/ fev/2020 = 100 — cada série rebasa no próprio ponto-base; restrito desde 2000, ampliado (soma veículos e materiais de construção) desde 2003. Receita nominal fica fora de gráfico de nível: sobe sempre, por inflação. Faixas cinzas: recessões CODACE/FGV (última datação: 2020)."
      stampGiro={geradoEm}
      stampDado={pmc.mes_recente ? mesIso(pmc.mes_recente) : null}
    >
      <AzTimeSeriesChart
        series={[
          { id: "restrito", label: "Varejo restrito", color: AZ_BRAND.azure, data: restritoPts },
          { id: "ampliado", label: "Varejo ampliado", color: AZ_BRAND.navy, data: ampliadoPts },
        ]}
        unit="index"
        period={period}
        height={340}
        xRefAreas={faixas}
        refLines={[{ y: 100, label: "fev/2020", color: "#94A3B8" }]}
        showLegend
      />
    </ChartCard>
  );
}
