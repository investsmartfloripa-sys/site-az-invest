"use client";

import { useMemo } from "react";

import type { CambioMacroData } from "@/lib/painel-contas-externas";
import { ChartCard } from "@/components/painel/core";
import { AzTimeSeriesChart, type AzSeriesPoint } from "@/components/painel/charts/AzTimeSeriesChart";
import { AZ_BRAND, AZ_CHART } from "@/lib/az-chart-theme";
import { fmtNum, fmtSignedNum } from "@/lib/format-br";
import { mesIso } from "./shared";

/**
 * Bloco 02 — "quanto o Brasil paga a mais que os EUA em juros?".
 *
 * Diferencial Selic meta − Fed Funds em área (variant hero), com Selic e Fed
 * Funds tracejadas ao fundo e a média histórica do diferencial como régua.
 * A leitura do título é gerada por regra: nível atual vs média 2000+.
 */
export function ParidadeJurosCard({ data }: { data: CambioMacroData }) {
  const serie = data.juros.diferencial.serie;

  const { difPts, selicPts, fedPts, mediaDif, atual, delta12m } = useMemo(() => {
    const dif: AzSeriesPoint[] = [];
    const selic: AzSeriesPoint[] = [];
    const fed: AzSeriesPoint[] = [];
    for (const r of serie) {
      const iso = mesIso(r.mes);
      dif.push([iso, r.diferencial_pp]);
      selic.push([iso, r.selic_meta]);
      fed.push([iso, r.fed_funds]);
    }
    const vals = serie.map((r) => r.diferencial_pp);
    const media = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    const u = serie[serie.length - 1] ?? null;
    const u12 = serie.length > 12 ? serie[serie.length - 13] : null;
    return {
      difPts: dif,
      selicPts: selic,
      fedPts: fed,
      mediaDif: media,
      atual: u,
      delta12m: u && u12 ? u.diferencial_pp - u12.diferencial_pp : null,
    };
  }, [serie]);

  const titulo = atual
    ? `Brasil paga ${fmtNum(atual.diferencial_pp, 1)} p.p. a mais que os EUA${
        mediaDif != null
          ? atual.diferencial_pp >= mediaDif
            ? " — acima da média histórica"
            : " — abaixo da média histórica"
          : ""
      }`
    : "Diferencial de juros Brasil − EUA";

  return (
    <ChartCard
      title={titulo}
      subtitle="Meta Selic (Copom) menos Fed Funds efetiva, médias mensais, em pontos percentuais ao ano — o 'prêmio' que sustenta o carry trade no real."
      footer={
        <span>
          Diferencial em pontos percentuais a.a. (área); Selic e Fed Funds em % a.a. (tracejadas).{" "}
          {delta12m != null ? `Em 12 meses o diferencial variou ${fmtSignedNum(delta12m, 1)} p.p. ` : null}
          Juro alto compensa risco e inflação esperada — não é &quot;renda grátis&quot;: veja no bloco seguinte o
          que o diferencial historicamente NÃO garantiu.
        </span>
      }
      stampGiro={data.generated_at}
      stampDado={atual?.mes ?? null}
    >
      <AzTimeSeriesChart
        series={[{ id: "dif", label: "Diferencial Selic − Fed (p.p.)", color: AZ_BRAND.azure, data: difPts }]}
        benchmarks={[
          { id: "selic", label: "Selic meta (% a.a.)", color: AZ_BRAND.navy, data: selicPts },
          { id: "fed", label: "Fed Funds (% a.a.)", color: AZ_CHART.ticks, data: fedPts },
        ]}
        unit="%"
        height={320}
        variant="hero"
        refLines={
          mediaDif != null
            ? [{ y: mediaDif, label: `média 2000+: ${fmtNum(mediaDif, 1)} p.p.`, color: AZ_BRAND.rust }]
            : []
        }
      />
    </ChartCard>
  );
}
