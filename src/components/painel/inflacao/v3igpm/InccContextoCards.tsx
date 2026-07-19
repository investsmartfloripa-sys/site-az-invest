"use client";

import { useMemo } from "react";

import type { InccContextoBlock } from "@/lib/painel-igpm";
import { ChartCard } from "@/components/painel/core";
import { AzTimeSeriesChart, type AzSeriesPoint } from "@/components/painel/charts/AzTimeSeriesChart";
import { AZ_SERIES, BENCHMARK_COLORS } from "@/lib/az-chart-theme";
import { fmtNum, fmtSignedNum } from "@/lib/format-br";
import { mesIso } from "../v2/shared";

/**
 * Custo de construir em contexto (tab INCC-M): INCC-M × INCC-DI (SGS 192 —
 * mesma família FGV, janela civil) e INCC-M × IVG-R × IPCA (custo de obra vs
 * valor de garantia residencial vs inflação cheia). Spread INCC−IPCA com
 * percentil histórico pós-96 calculado no builder.
 */

const CORES = {
  inccm: AZ_SERIES[5], // ocre — cor fixa do INCC-M no painel
  inccdi: "#64748B", // slate — família de referência
  ivgr: "#7C3AED", // violeta — imóveis
  ipca: BENCHMARK_COLORS.IPCA, // rust
};

function extrai(serie: InccContextoBlock["serie"], chave: keyof InccContextoBlock["serie"][number]): AzSeriesPoint[] {
  const out: AzSeriesPoint[] = [];
  for (const r of serie) {
    const v = r[chave];
    if (typeof v === "number") out.push([mesIso(r.mes), v]);
  }
  return out;
}

export function InccContextoCards({
  contexto,
  geradoEm,
}: {
  contexto: InccContextoBlock;
  geradoEm: string;
}) {
  const { inccm, inccdi, ivgr, ipca } = useMemo(
    () => ({
      inccm: extrai(contexto.serie, "inccm_12m"),
      inccdi: extrai(contexto.serie, "inccdi_12m"),
      ivgr: extrai(contexto.serie, "ivgr_12m"),
      ipca: extrai(contexto.serie, "ipca_12m"),
    }),
    [contexto.serie],
  );

  const st = contexto.spread_stats;
  const ultimo = contexto.serie.at(-1);
  if (inccm.length === 0) return null;

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <ChartCard
        title="INCC-M × INCC-DI"
        footer={`Mesma família FGV com janelas de coleta diferentes: o INCC-M fecha a coleta no dia 20 e antecipa; o INCC-DI (SGS ${contexto.fontes["INCC-DI"]}) fecha o mês civil. Divergência persistente entre os dois = choque concentrado na virada do mês (dissídio, reajuste de material). 12m COMPOSTO no pipeline.`}
        stampGiro={geradoEm}
        stampDado={ultimo?.mes ?? null}
      >
        <AzTimeSeriesChart
          series={[
            { id: "inccm", label: "INCC-M 12m", color: CORES.inccm, data: inccm },
            { id: "inccdi", label: "INCC-DI 12m", color: CORES.inccdi, data: inccdi },
          ]}
          unit="%"
          height={300}
          showLegend
        />
      </ChartCard>

      <ChartCard
        title="Custo de obra × valor do imóvel × IPCA"
        footer={
          <span>
            IVG-R (BCB, SGS {contexto.fontes["IVG-R"]}): valor de garantia de imóveis residenciais
            financiados — var. 12m do índice, publicação com ~2 meses de defasagem (até{" "}
            {contexto.ivgr_ultimo_mes ?? "—"}). Spread INCC−IPCA do mês:{" "}
            {ultimo?.spread_ipca != null ? `${fmtSignedNum(ultimo.spread_ipca, 2)} p.p.` : "—"} — percentil{" "}
            {st.percentil_atual != null ? fmtNum(st.percentil_atual, 0) : "—"} da distribuição pós-96
            (mediana {st.mediana != null ? fmtSignedNum(st.mediana, 2) : "—"}; p10{" "}
            {st.p10 != null ? fmtSignedNum(st.p10, 2) : "—"} / p90{" "}
            {st.p90 != null ? fmtSignedNum(st.p90, 2) : "—"}; n={st.n}). Custo subindo acima do IPCA e do
            valor do imóvel = margem de incorporação comprimida.
          </span>
        }
        stampGiro={geradoEm}
        stampDado={ultimo?.mes ?? null}
      >
        <AzTimeSeriesChart
          series={[
            { id: "inccm", label: "INCC-M 12m", color: CORES.inccm, data: inccm },
            { id: "ivgr", label: "IVG-R 12m", color: CORES.ivgr, data: ivgr },
            { id: "ipca", label: "IPCA 12m", color: CORES.ipca, data: ipca },
          ]}
          unit="%"
          height={300}
          showLegend
        />
      </ChartCard>
    </div>
  );
}
