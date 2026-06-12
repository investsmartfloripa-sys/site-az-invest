"use client";

import { useMemo, useState } from "react";

import type { AtividadePibData, AtividadePimData, CodaceFaixaAtividade } from "@/lib/painel-atividade";
import { ChartCard } from "@/components/painel/core";
import { AzPeriodSelector, type AzPeriodValue } from "@/components/painel/charts/AzPeriodSelector";
import { AzTimeSeriesChart } from "@/components/painel/charts/AzTimeSeriesChart";
import { AZ_BRAND } from "@/lib/az-chart-theme";
import { fmtPct, fmtSignedPct } from "@/lib/format-br";
import { codaceAreas, fmtTrimCurto, mesIso, mmPoints, toPointsMes, toPointsTrim, ultimo } from "../shared";

/**
 * Construção: os insumos antecipam o PIB? — o indicador especial de insumos
 * típicos da construção (cimento, aço, tijolos...) sai MENSALMENTE e ~2 meses
 * antes da rubrica Construção das Contas Nacionais. Sobrepor as duas séries
 * (mesma métrica: YoY) é a validação visual do papel antecedente — o degrau
 * trimestral do PIB deve "perseguir" a linha mensal dos insumos.
 */

export function ConstrucaoCard({
  pim,
  pib,
  codaceMensal,
  geradoEm,
}: {
  pim: AtividadePimData;
  pib: AtividadePibData;
  codaceMensal?: CodaceFaixaAtividade[];
  geradoEm: string;
}) {
  const [period, setPeriod] = useState<AzPeriodValue>({ id: "5y" });

  const construcao = useMemo(() => pim.construcao?.serie ?? [], [pim.construcao]);
  const insumosMm3 = useMemo(() => mmPoints(toPointsMes(construcao, "var_yoy"), 3), [construcao]);
  const pibConstrucao = useMemo(() => toPointsTrim(pib.variacao.serie, "yoy_construcao"), [pib.variacao.serie]);
  const faixas = useMemo(() => codaceAreas(codaceMensal), [codaceMensal]);

  const ultInsumos = insumosMm3.length > 0 ? insumosMm3[insumosMm3.length - 1][1] : null;
  const ultPib = useMemo(() => ultimo(pib.variacao.serie, "yoy_construcao"), [pib.variacao.serie]);
  const mesmaDirecao = ultInsumos != null && ultPib != null && (ultInsumos >= 0) === (ultPib.valor >= 0);

  const titulo =
    ultInsumos != null
      ? `Insumos da construção ${ultInsumos >= 0 ? "crescem" : "caem"} ${fmtPct(Math.abs(ultInsumos), 1)} em 12 meses${
          ultPib != null
            ? ` — e o PIB da construção ${mesmaDirecao ? "confirma a direção" : "ainda diverge"} (${fmtSignedPct(
                ultPib.valor,
                1,
              )} no ${fmtTrimCurto(ultPib.row.trim)})`
            : ""
        }`
      : "Construção — insumos × PIB";

  const minIso = insumosMm3.length > 0 ? insumosMm3[0][0] : "";
  const maxIso = insumosMm3.length > 0 ? insumosMm3[insumosMm3.length - 1][0] : "";

  if (insumosMm3.length === 0) return null;

  return (
    <ChartCard
      title={titulo}
      subtitle="Os insumos antecipam o PIB? A linha mensal (insumos típicos: cimento, aço, tijolos) sai meses antes do degrau trimestral da rubrica Construção das Contas Nacionais — mesma métrica (YoY), frequências diferentes."
      toolbar={<AzPeriodSelector value={period} onChange={setPeriod} min={minIso} max={maxIso} periods={["1y", "5y", "max"]} />}
      footer="Insumos: indicador especial da PIM-PF (SIDRA 8886), variação interanual suavizada por mm3. PIB da construção: Contas Nacionais Trimestrais, YoY, em degraus ancorados no mês central de cada trimestre (~60 dias de defasagem — o trecho final dos insumos ainda não tem degrau correspondente). Faixas cinzas: recessões CODACE/FGV."
      stampGiro={geradoEm}
      stampDado={construcao.length > 0 ? mesIso(construcao[construcao.length - 1].mes) : null}
    >
      <AzTimeSeriesChart
        series={[
          { id: "insumos", label: "Insumos da construção (mensal, YoY mm3)", color: AZ_BRAND.azure, data: insumosMm3 },
          {
            id: "pib-construcao",
            label: "PIB Construção (trimestral, YoY)",
            color: AZ_BRAND.navy,
            type: "stepAfter",
            data: pibConstrucao,
          },
        ]}
        unit="%"
        period={period}
        height={300}
        xRefAreas={faixas}
      />
    </ChartCard>
  );
}
