"use client";

import { useMemo, useState } from "react";

import type { FamiliasRendaData } from "@/lib/painel-familias";
import { ChartCard } from "@/components/painel/core";
import { AzPeriodSelector, type AzPeriodValue } from "@/components/painel/charts/AzPeriodSelector";
import { AzTimeSeriesChart } from "@/components/painel/charts/AzTimeSeriesChart";
import { AZ_BRAND } from "@/lib/az-chart-theme";
import { fmtBRL, fmtMesCurto, fmtPct } from "@/lib/format-br";
import { minMaxPontos, pontosData, REGIMES_SM } from "./shared";

/**
 * Salário mínimo REAL mensal — SÓ a linha real (nominal × real no mesmo eixo
 * era o vício clássico: o nominal sobe sempre e não informa nada). Os três
 * regimes da série entram sombreados como leitura EDITORIAL DECLARADA:
 * valorização 2005–2015, estagnação 2016–2022, retomada 2023+.
 */

export function SmRealCard({ renda, geradoEm }: { renda: FamiliasRendaData; geradoEm: string }) {
  const [period, setPeriod] = useState<AzPeriodValue>({ id: "max" });

  const realPts = useMemo(
    () => pontosData(renda.bloco_salario_minimo.real_serie, "valor"),
    [renda.bloco_salario_minimo.real_serie],
  );

  const minIso = realPts.length > 0 ? realPts[0][0] : "";
  const maxIso = realPts.length > 0 ? realPts[realPts.length - 1][0] : "";

  const ult = realPts.length > 0 ? realPts[realPts.length - 1] : null;
  const extremos = useMemo(() => minMaxPontos(realPts), [realPts]);

  const titulo =
    ult && extremos
      ? ult[1] >= extremos.max - 0.005
        ? `Salário mínimo real em ${fmtBRL(ult[1], 0)} — no pico histórico da série`
        : `Salário mínimo real em ${fmtBRL(ult[1], 0)} — ${fmtPct((100 * (extremos.max - ult[1])) / extremos.max, 1)} abaixo do pico (${fmtMesCurto(extremos.maxData)})`
      : "Salário mínimo real — série mensal";

  return (
    <ChartCard
      title={titulo}
      subtitle="Valor do salário mínimo em R$ constantes (deflacionado pelo INPC). Só a linha REAL: o nominal sobe sempre e não responde nenhuma pergunta — a história está nos três regimes sombreados."
      toolbar={<AzPeriodSelector value={period} onChange={setPeriod} min={minIso} max={maxIso} periods={["5y", "max"]} />}
      footer="Ipeadata GAC12_SALMINRE12 — salário mínimo real (deflator INPC). Faixas sombreadas: leitura EDITORIAL declarada dos regimes da série — valorização real (2005–2015, política de valorização do SM), estagnação (2016–2022, reajustes ≈ inflação) e retomada (2023+, novo ganho real) — referência de contexto, não datação oficial."
      stampGiro={geradoEm}
      stampDado={maxIso || null}
    >
      <AzTimeSeriesChart
        series={[{ id: "sm-real", label: "SM real (R$ de hoje)", color: AZ_BRAND.azure, data: realPts }]}
        unit="R$"
        period={period}
        height={300}
        xRefAreas={REGIMES_SM}
        showLegend={false}
      />
    </ChartCard>
  );
}
