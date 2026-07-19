"use client";

import { useMemo, useState } from "react";

import type { IpaDriversBlock } from "@/lib/painel-igpm";
import { AzSegmented, ChartCard } from "@/components/painel/core";
import { AzTimeSeriesChart, type AzSeriesPoint, type AzTimeSeries } from "@/components/painel/charts/AzTimeSeriesChart";
import { AZ_BRAND, BENCHMARK_COLORS } from "@/lib/az-chart-theme";
import { fmtNum } from "@/lib/format-br";
import { mesIso } from "../v2/shared";

/**
 * Drivers do atacado (tab IPA-M): o IPA vive de commodities em BRL e câmbio —
 * IC-Br do BCB (com aberturas agro/metal/energia) e dólar médio mensal, ambos
 * em 12m contra o IPA-M 12m. Transformações e correlações nascem no BUILDER
 * (yoy de nível + corr defasada 0-6m); aqui só se plota e rotula.
 */

const COR_ICBR = "#132960"; // navy — índice cheio
const COR_ABERTURA: Record<string, string> = {
  agro: "#1E8A5C", // verde-mar
  metal: "#0891B2", // ciano
  energia: "#A16207", // ocre
};

function extrai(serie: IpaDriversBlock["serie"], chave: keyof IpaDriversBlock["serie"][number]): AzSeriesPoint[] {
  const out: AzSeriesPoint[] = [];
  for (const r of serie) {
    const v = r[chave];
    if (typeof v === "number") out.push([mesIso(r.mes), v]);
  }
  return out;
}

export function DriversIpaCards({
  drivers,
  geradoEm,
}: {
  drivers: IpaDriversBlock;
  geradoEm: string;
}) {
  const [modo, setModo] = useState<"cheio" | "aberturas">("cheio");

  const { ipa, icbr, agro, metal, energia, cambio } = useMemo(
    () => ({
      ipa: extrai(drivers.serie, "ipa_12m"),
      icbr: extrai(drivers.serie, "icbr_12m"),
      agro: extrai(drivers.serie, "agro_12m"),
      metal: extrai(drivers.serie, "metal_12m"),
      energia: extrai(drivers.serie, "energia_12m"),
      cambio: extrai(drivers.serie, "cambio_12m"),
    }),
    [drivers.serie],
  );

  const lags = drivers.cambio_lags;
  const seriesCommodities: AzTimeSeries[] =
    modo === "cheio"
      ? [
          { id: "ipa", label: "IPA-M 12m", color: AZ_BRAND.azure, data: ipa },
          { id: "icbr", label: "IC-Br 12m", color: COR_ICBR, data: icbr },
        ]
      : [
          { id: "ipa", label: "IPA-M 12m", color: AZ_BRAND.azure, data: ipa },
          { id: "agro", label: "IC-Br agro 12m", color: COR_ABERTURA.agro, data: agro },
          { id: "metal", label: "IC-Br metal 12m", color: COR_ABERTURA.metal, data: metal },
          { id: "energia", label: "IC-Br energia 12m", color: COR_ABERTURA.energia, data: energia },
        ];

  if (ipa.length === 0) return null;

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <ChartCard
        title="Atacado × commodities em reais"
        toolbar={
          <AzSegmented
            ariaLabel="Abertura do IC-Br"
            options={[
              { id: "cheio", label: "IC-Br cheio" },
              { id: "aberturas", label: "Agro × Metal × Energia" },
            ]}
            value={modo}
            onChange={(id) => setModo(id as "cheio" | "aberturas")}
          />
        }
        footer={`IC-Br (BCB, SGS ${drivers.fontes["IC-Br"]}/${drivers.fontes["IC-Br agro"]}-${drivers.fontes["IC-Br energia"]}): índice de commodities relevantes p/ a inflação brasileira, já em reais (commodity E câmbio no mesmo número); var. 12m calculada no pipeline sobre o número-índice. A amplitude maior do IC-Br é a mensagem: o IPA amortece o choque de commodities via margens e mix.`}
        stampGiro={geradoEm}
        stampDado={drivers.ultimo_mes}
      >
        <AzTimeSeriesChart series={seriesCommodities} unit="%" height={300} showLegend />
      </ChartCard>

      <ChartCard
        title="Atacado × câmbio"
        footer={
          <span>
            Dólar médio mensal de venda (BCB, SGS {drivers.fontes["cambio"]}) em var. 12m. Correlação
            câmbio→IPA calculada no pipeline com o IPA defasado em +k meses:{" "}
            {lags.lags
              .map((l) => `${l.lag}m ${l.corr_pos96 != null ? fmtNum(l.corr_pos96, 2) : "—"}`)
              .join(" · ")}
            {lags.melhor_lag != null
              ? ` (máx ${lags.melhor_corr_pos96 != null ? fmtNum(lags.melhor_corr_pos96, 2) : "—"} em +${lags.melhor_lag}m, pós-96)`
              : ""}
            . Honestidade: correlação não é garantia de repasse — a associação concentra-se nos episódios de
            depreciação rápida.
          </span>
        }
        stampGiro={geradoEm}
        stampDado={drivers.ultimo_mes}
      >
        <AzTimeSeriesChart
          series={[
            { id: "ipa", label: "IPA-M 12m", color: AZ_BRAND.azure, data: ipa },
            { id: "cambio", label: "USD/BRL 12m", color: BENCHMARK_COLORS["USD/BRL"], data: cambio },
          ]}
          unit="%"
          height={300}
          showLegend
        />
      </ChartCard>
    </div>
  );
}
