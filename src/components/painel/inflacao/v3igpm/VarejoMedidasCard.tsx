"use client";

import { useMemo } from "react";

import type { IpcMedidasBlock } from "@/lib/painel-igpm";
import { ChartCard } from "@/components/painel/core";
import { AzTimeSeriesChart, type AzSeriesPoint } from "@/components/painel/charts/AzTimeSeriesChart";
import { AZ_BRAND, BENCHMARK_COLORS } from "@/lib/az-chart-theme";
import { fmtSignedNum } from "@/lib/format-br";
import { mesIso } from "../v2/shared";

/**
 * O varejo em 4 medidas (tab IPC-M): IPC-M (FGV, coleta 21→20), IPC-Br (FGV,
 * mês civil), IPC-Fipe (SP, quadrissemanas) e IPCA (IBGE) — todos em 12m
 * composto no pipeline. A diferença entre eles é metodologia e janela, e isso
 * fica dito; os spreads do mês recente vêm prontos do builder.
 */

const CORES = {
  ipcm: AZ_BRAND.navy, // cor fixa do IPC-M no painel
  ipca: BENCHMARK_COLORS.IPCA, // rust — convenção do site
  ipcbr: AZ_BRAND.azure,
  fipe: "#0891B2", // ciano
};

export function VarejoMedidasCard({
  medidas,
  geradoEm,
}: {
  medidas: IpcMedidasBlock;
  geradoEm: string;
}) {
  const { ipcm, ipcbr, fipe, ipca } = useMemo(() => {
    const out: Record<string, AzSeriesPoint[]> = { ipcm: [], ipcbr: [], fipe: [], ipca: [] };
    for (const r of medidas.serie) {
      const iso = mesIso(r.mes);
      if (r.ipcm_12m != null) out.ipcm.push([iso, r.ipcm_12m]);
      if (r.ipcbr_12m != null) out.ipcbr.push([iso, r.ipcbr_12m]);
      if (r.fipe_12m != null) out.fipe.push([iso, r.fipe_12m]);
      if (r.ipca_12m != null) out.ipca.push([iso, r.ipca_12m]);
    }
    return out as { ipcm: AzSeriesPoint[]; ipcbr: AzSeriesPoint[]; fipe: AzSeriesPoint[]; ipca: AzSeriesPoint[] };
  }, [medidas.serie]);

  const s = medidas.spreads_mes;
  if (ipcm.length === 0) return null;

  return (
    <ChartCard
      title="O varejo em 4 medidas"
      footer={`Spreads do IPC-M no mês (calculados no pipeline): vs IPCA ${s.vs_ipca != null ? fmtSignedNum(s.vs_ipca, 2) : "—"} p.p. · vs IPC-Br ${s.vs_ipcbr != null ? fmtSignedNum(s.vs_ipcbr, 2) : "—"} p.p. · vs IPC-Fipe ${s.vs_fipe != null ? fmtSignedNum(s.vs_fipe, 2) : "—"} p.p. ${medidas.nota}. Fontes: SGS ${medidas.fontes["IPC-Br"]} (IPC-Br) / ${medidas.fontes["IPC-Fipe"]} (IPC-Fipe) / ${medidas.fontes["IPCA"]} (IPCA); 12m COMPOSTO no pipeline.`}
      stampGiro={geradoEm}
      stampDado={s.mes}
    >
      <AzTimeSeriesChart
        series={[
          { id: "ipcm", label: "IPC-M 12m", color: CORES.ipcm, data: ipcm },
          { id: "ipca", label: "IPCA 12m", color: CORES.ipca, data: ipca },
          { id: "ipcbr", label: "IPC-Br 12m", color: CORES.ipcbr, data: ipcbr },
          { id: "fipe", label: "IPC-Fipe (SP) 12m", color: CORES.fipe, data: fipe },
        ]}
        unit="%"
        height={320}
        showLegend
      />
      <p className="mt-1 text-[11px] text-zinc-500">
        Quando as quatro linhas andam juntas, a inflação ao consumidor é um fato, não um artefato de
        metodologia; quando o IPC-M descola, a explicação usual é a janela de coleta (21→20) capturando o
        choque antes ou depois do mês civil.
      </p>
    </ChartCard>
  );
}
