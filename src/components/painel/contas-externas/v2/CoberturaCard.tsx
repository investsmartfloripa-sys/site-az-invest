"use client";

import { useMemo, useState } from "react";

import type { CoberturaIdpPonto } from "@/lib/painel-contas-externas";
import { ChartCard } from "@/components/painel/core";
import { AzPeriodSelector, type AzPeriodValue } from "@/components/painel/charts/AzPeriodSelector";
import { AzTimeSeriesChart, type AzSeriesPoint } from "@/components/painel/charts/AzTimeSeriesChart";
import { AZ_BRAND } from "@/lib/az-chart-theme";
import { fmtPct } from "@/lib/format-br";
import { mesIso, superavitAreas } from "./shared";

/**
 * Bloco 05a — "o financiamento é sadio?". Razão de COBERTURA do déficit em
 * conta corrente pelo IDP (uma linha vs a régua de 100%) — substitui o vício
 * antigo de duas linhas com déficit clipado em zero. Períodos de superávit da
 * TC ficam sombreados: ali a razão não tem leitura (não há déficit).
 */

/** Teto de exibição: déficit perto de zero infla a razão sem significado econômico. */
const TETO_PCT = 400;

export function CoberturaCard({ cobertura, geradoEm }: { cobertura: CoberturaIdpPonto[]; geradoEm: string }) {
  const [period, setPeriod] = useState<AzPeriodValue>({ id: "max" });

  const { points, truncou } = useMemo(() => {
    const out: AzSeriesPoint[] = [];
    let teve = false;
    for (const p of cobertura) {
      const v = p.cobertura_pct;
      if (typeof v === "number" && Number.isFinite(v)) {
        if (v > TETO_PCT) teve = true;
        out.push([mesIso(p.mes), Math.min(v, TETO_PCT)]);
      }
    }
    return { points: out, truncou: teve };
  }, [cobertura]);

  const faixasSuperavit = useMemo(() => superavitAreas(cobertura), [cobertura]);

  const minIso = cobertura.length > 0 ? mesIso(cobertura[0].mes) : "";
  const maxIso = cobertura.length > 0 ? mesIso(cobertura[cobertura.length - 1].mes) : "";

  const titulo = useMemo(() => {
    const u = cobertura.length > 0 ? cobertura[cobertura.length - 1] : null;
    if (!u) return "Cobertura do déficit corrente pelo IDP";
    if (typeof u.tc_pct_pib === "number" && u.tc_pct_pib >= 0)
      return "A conta corrente está superavitária — não há déficit a financiar";
    const c = u.cobertura_pct;
    if (typeof c !== "number") return "Cobertura do déficit corrente pelo IDP";
    if (c >= 100) return `O IDP cobre ${fmtPct(c, 0)} do déficit em conta corrente — capital de longo prazo paga a conta`;
    if (c >= 70) return `O IDP cobre ${fmtPct(c, 0)} do déficit em conta corrente — o restante depende de capital mais volátil`;
    return `O IDP cobre só ${fmtPct(c, 0)} do déficit em conta corrente`;
  }, [cobertura]);

  return (
    <ChartCard
      title={titulo}
      subtitle="IDP acumulado 12m ÷ déficit em transações correntes 12m (ambos em % do PIB). Acima de 100%, o déficit é integralmente financiado por investimento direto."
      toolbar={<AzPeriodSelector value={period} onChange={setPeriod} min={minIso} max={maxIso} periods={["5y", "max"]} />}
      footer={`Cobertura = IDP 12m (SGS 22885) ÷ |TC 12m| (22701), em % do PIB (4192). Faixas verdes: TC superavitária — a razão fica sem leitura nesses meses (a linha apenas atravessa o trecho).${
        truncou ? ` Valores acima de ${fmtPct(TETO_PCT, 0)} truncados no gráfico: déficit perto de zero infla a razão sem significado econômico.` : ""
      } IDP é o financiamento mais estável do BP — mas cobre fluxo, não estoque: não imuniza contra repatriação de portfólio.`}
      stampGiro={geradoEm}
      stampDado={maxIso || null}
    >
      <AzTimeSeriesChart
        series={[{ id: "cobertura", label: "Cobertura IDP/déficit", color: AZ_BRAND.azure, data: points }]}
        unit="%"
        period={period}
        height={300}
        refLines={[{ y: 100, label: "100% — déficit coberto", color: AZ_BRAND.navy }]}
        xRefAreas={faixasSuperavit}
        showLegend={false}
      />
    </ChartCard>
  );
}
