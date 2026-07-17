"use client";

import { useMemo } from "react";

import type { IpcaData } from "@/lib/painel-ipca";
import { ChartCard } from "@/components/painel/core";
import { DivergingReturnBars } from "@/components/painel/charts/DivergingReturnBars";
import { AZ_CHART } from "@/lib/az-chart-theme";
import { fmtSignedNum } from "@/lib/format-br";
import { num } from "./shared";

/**
 * Maiores influências do mês: top 8 altas + top 8 quedas em p.p., com "Demais
 * itens" fechando a conta com o IPCA cheio (âncora no total). Cores na
 * semântica de inflação (alta = vermelho, pressão; queda = azul). A busca
 * completa nos ~440 subitens vive no card "Busca por subitem".
 */
export function InfluenciasCard({ data }: { data: IpcaData }) {
  const { mes, top_altas, top_quedas } = data.maiores_influencias;

  const ipcaMes = num(
    data.ipca_cheio.serie.find((r) => r.mes === mes),
    "IPCA cheio",
  );

  const rows = useMemo(() => {
    const altas = top_altas.filter((x) => x.contrib_pp > 0).slice(0, 8);
    const quedas = top_quedas.filter((x) => x.contrib_pp < 0).slice(0, 8);
    const selecionados = [...altas, ...quedas];
    const out = selecionados.map((x) => ({ label: x.subitem, value: x.contrib_pp }));
    if (ipcaMes != null) {
      const demais = ipcaMes - selecionados.reduce((s, x) => s + x.contrib_pp, 0);
      out.push({ label: "Demais itens", value: Number(demais.toFixed(4)) });
    }
    return out.sort((a, b) => b.value - a.value);
  }, [top_altas, top_quedas, ipcaMes]);

  return (
    <ChartCard title="Maiores influências do mês" stampGiro={data.gerado_em} stampDado={mes}>
      <DivergingReturnBars
        rows={rows}
        yAxisWidth={150}
        valueFmt={(v) => `${fmtSignedNum(v, 2)} p.p.`}
        axisFmt={(v) => fmtSignedNum(v, Math.abs(v) < 1 ? 2 : 1)}
        fillFor={(v) => (v > 0 ? AZ_CHART.neg : AZ_CHART.neutral)}
      />
    </ChartCard>
  );
}
