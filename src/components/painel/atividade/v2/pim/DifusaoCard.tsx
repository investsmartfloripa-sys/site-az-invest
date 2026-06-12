"use client";

import { useMemo, useState } from "react";

import type { CodaceFaixaAtividade, PimDifusaoPonto } from "@/lib/painel-atividade";
import { ChartCard } from "@/components/painel/core";
import { AzPeriodSelector, type AzPeriodValue } from "@/components/painel/charts/AzPeriodSelector";
import { AzTimeSeriesChart } from "@/components/painel/charts/AzTimeSeriesChart";
import { AZ_BRAND } from "@/lib/az-chart-theme";
import { fmtPct } from "@/lib/format-br";
import { codaceAreas, mesIso, toPointsMes } from "../shared";

/**
 * Difusão — a pergunta de QUALIDADE do crescimento: a alta da manchete vem de
 * muitos setores ou de meia dúzia? Acima de 50% das atividades em alta, a
 * expansão é disseminada (robusta); abaixo, é concentrada (frágil — basta um
 * setor virar para a manchete virar junto). Cálculo PRÓPRIO do builder sobre
 * as ~25 atividades CNAE — não confundir com o índice oficial do IBGE.
 */

export function DifusaoCard({
  difusao,
  codaceMensal,
  geradoEm,
}: {
  difusao: PimDifusaoPonto[];
  codaceMensal?: CodaceFaixaAtividade[];
  geradoEm: string;
}) {
  const [period, setPeriod] = useState<AzPeriodValue>({ id: "5y" });

  const pontos = useMemo(() => toPointsMes(difusao, "pct_mm3"), [difusao]);
  const faixas = useMemo(() => codaceAreas(codaceMensal), [codaceMensal]);

  const ultMm3 = pontos.length > 0 ? pontos[pontos.length - 1][1] : null;
  const ult = difusao.length > 0 ? difusao[difusao.length - 1] : null;

  const titulo =
    ultMm3 != null
      ? ultMm3 >= 50
        ? `Alta disseminada: ${fmtPct(ultMm3, 0)} das atividades industriais cresce na margem`
        : `Alta concentrada: só ${fmtPct(ultMm3, 0)} das atividades industriais cresce na margem`
      : "Difusão por atividades";

  const minIso = pontos.length > 0 ? pontos[0][0] : "";
  const maxIso = pontos.length > 0 ? pontos[pontos.length - 1][0] : "";

  if (pontos.length === 0) return null;

  return (
    <ChartCard
      title={titulo}
      subtitle="Quantos setores sustentam o número da manchete? Difusão = % das atividades CNAE com produção em alta no mês, suavizada por média móvel de 3 meses. Acima de 50%, a expansão é disseminada; abaixo, depende de poucos setores."
      toolbar={<AzPeriodSelector value={period} onChange={setPeriod} min={minIso} max={maxIso} periods={["1y", "5y", "max"]} />}
      footer={`Difusão por atividades (cálculo próprio sobre ~${ult?.n ?? 25} atividades CNAE, critério MoM SA > 0 com fallback YoY quando o ajuste sazonal não está disponível) — NÃO é o índice oficial de difusão por ~789 produtos do IBGE. Faixas cinzas: recessões CODACE/FGV.`}
      stampGiro={geradoEm}
      stampDado={ult ? mesIso(ult.mes) : null}
    >
      <AzTimeSeriesChart
        series={[{ id: "difusao", label: "Difusão (mm3)", color: AZ_BRAND.azure, data: pontos }]}
        unit="%"
        period={period}
        height={280}
        xRefAreas={faixas}
        refLines={[{ y: 50, label: "expansão disseminada acima", color: AZ_BRAND.navy }]}
        showLegend={false}
      />
    </ChartCard>
  );
}
