"use client";

import { useMemo, useState } from "react";

import type { FamiliasPoderCompraData } from "@/lib/painel-familias";
import { ChartCard } from "@/components/painel/core";
import { AzPeriodSelector, type AzPeriodValue } from "@/components/painel/charts/AzPeriodSelector";
import { AzTimeSeriesChart, type AzSeriesPoint } from "@/components/painel/charts/AzTimeSeriesChart";
import { AZ_BRAND } from "@/lib/az-chart-theme";
import { fmtPct } from "@/lib/format-br";
import { pontosData } from "./shared";

/**
 * "Poder de compra" C5 — FipeZap em variação 12m × IPCA 12m no MESMO eixo %:
 * a distância entre as linhas é a valorização REAL do imóvel (o nível
 * nominal do índice, sozinho, só conta a história da inflação). A leitura
 * de 2014–2020 (preço real caindo) só entra no footer SE o dado confirmar.
 */

export function FipezapCard({ poderCompra, geradoEm }: { poderCompra: FamiliasPoderCompraData; geradoEm: string }) {
  const [period, setPeriod] = useState<AzPeriodValue>({ id: "max" });

  const fipePts = useMemo(() => pontosData(poderCompra.bloco_fipezap.serie, "var_pct_aa"), [poderCompra.bloco_fipezap.serie]);
  const ipcaPts = useMemo(() => pontosData(poderCompra.bloco_fipezap.serie, "ipca_12m"), [poderCompra.bloco_fipezap.serie]);

  // Verificação NO DADO da leitura 2014–2020 (FipeZap 12m < IPCA 12m na maioria dos meses).
  const quedaReal2014a2020 = useMemo(() => {
    const ipcaByMes = new Map<string, number>(ipcaPts.map(([d, v]) => [d, v] as const));
    let total = 0;
    let abaixo = 0;
    for (const [d, v] of fipePts) {
      if (d < "2014-01-01" || d > "2020-12-01") continue;
      const ipca = ipcaByMes.get(d);
      if (ipca == null) continue;
      total++;
      if (v < ipca) abaixo++;
    }
    return total >= 24 && abaixo / total >= 0.7;
  }, [fipePts, ipcaPts]);

  const minIso = fipePts.length > 0 ? fipePts[0][0] : "";
  const maxIso = fipePts.length > 0 ? fipePts[fipePts.length - 1][0] : "";

  const ultFipe: AzSeriesPoint | null = fipePts.length > 0 ? fipePts[fipePts.length - 1] : null;
  const ultIpca = ultFipe ? (ipcaPts.find(([d]) => d === ultFipe[0]) ?? null) : null;

  const titulo =
    ultFipe != null
      ? ultIpca != null
        ? ultFipe[1] > ultIpca[1] + 0.1
          ? `Imóveis sobem ${fmtPct(ultFipe[1], 1)} em 12 meses — acima da inflação (${fmtPct(ultIpca[1], 1)}): valorização real`
          : ultFipe[1] < ultIpca[1] - 0.1
            ? `Imóveis sobem ${fmtPct(ultFipe[1], 1)} em 12 meses — abaixo da inflação (${fmtPct(ultIpca[1], 1)}): o preço real cai`
            : `Imóveis sobem ${fmtPct(ultFipe[1], 1)} em 12 meses — em linha com a inflação (${fmtPct(ultIpca[1], 1)})`
        : `Imóveis variam ${fmtPct(ultFipe[1], 1)} em 12 meses (FipeZap)`
      : "FipeZap × IPCA — preço real dos imóveis";

  return (
    <ChartCard
      title={titulo}
      subtitle="Variação acumulada em 12 meses do FipeZap residencial (venda, Brasil) contra o IPCA 12m, no mesmo eixo. Quando a linha do FipeZap roda ABAIXO do IPCA, o imóvel perde valor em termos reais — mesmo subindo no nominal."
      toolbar={<AzPeriodSelector value={period} onChange={setPeriod} min={minIso} max={maxIso} periods={["1y", "5y", "max"]} />}
      footer={`FipeZap residencial venda Brasil (Ipeadata FIPE12_VENBR12), variação 12m, × IPCA acumulado 12m (BCB SGS 13522). A DISTÂNCIA entre as linhas é a valorização real.${
        quedaReal2014a2020
          ? " No dado: de 2014 a 2020 o FipeZap rodou consistentemente abaixo do IPCA — o preço REAL dos imóveis caiu nesse período."
          : ""
      }`}
      stampGiro={geradoEm}
      stampDado={maxIso || null}
    >
      <AzTimeSeriesChart
        series={[{ id: "fipezap", label: "FipeZap 12m", color: AZ_BRAND.azure, data: fipePts }]}
        benchmarks={ipcaPts.length > 0 ? [{ id: "ipca", label: "IPCA 12m", color: "#FF5713", data: ipcaPts }] : []}
        unit="%"
        period={period}
        height={300}
      />
    </ChartCard>
  );
}
