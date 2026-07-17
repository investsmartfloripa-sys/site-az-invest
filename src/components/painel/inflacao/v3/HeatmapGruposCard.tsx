"use client";

import { useMemo } from "react";

import type { IpcaIndice } from "@/lib/painel-ipca";
import { ChartCard, Heatmap, steppedDivergingScale } from "@/components/painel/core";
import { AZ_CHART } from "@/lib/az-chart-theme";
import { fmtMesCurto, fmtSignedNum } from "@/lib/format-br";
import { nomeGrupo, num } from "../v2/shared";

/** Nº de meses exibidos no heatmap (18 = um ciclo e meio de calendário). */
const MESES_HEATMAP = 18;

/**
 * Heatmap grupos × meses (estilo boletim FGV/IBRE): a variação mensal de cada
 * grupo nos últimos 18 meses, em escala divergente com semântica de inflação
 * (vermelho = pressão, azul = queda). Primeira linha = IPCA cheio (régua).
 */
export function HeatmapGruposCard({ indice, geradoEm }: { indice: IpcaIndice; geradoEm: string }) {
  const { rows, cols, data } = useMemo(() => {
    const serie = indice.serie.slice(-MESES_HEATMAP);
    const colunas = serie.map((r) => fmtMesCurto(r.mes));
    const linhas = ["IPCA", ...indice.grupos.map(nomeGrupo)];
    const valores: Record<string, Record<string, number | null>> = {};
    valores["IPCA"] = {};
    for (const r of serie) {
      valores["IPCA"][fmtMesCurto(r.mes)] = num(r, "IPCA cheio");
    }
    indice.grupos.forEach((g) => {
      const nome = nomeGrupo(g);
      valores[nome] = {};
      for (const r of serie) {
        valores[nome][fmtMesCurto(r.mes)] = num(r, g);
      }
    });
    return { rows: linhas, cols: colunas, data: valores };
  }, [indice]);

  const escala = useMemo(
    () => steppedDivergingScale([0.25, 0.75, 1.5], { posColor: AZ_CHART.neg, negColor: AZ_CHART.neutral }),
    [],
  );

  return (
    <ChartCard
      title={`Grupos × meses — últimos ${MESES_HEATMAP} meses`}
      subtitle="Variação mensal (%) de cada grupo. A linha de cima é o IPCA cheio, como régua de comparação."
      footer="Escala discreta divergente com degraus em ±0,25 / ±0,75 / ±1,5 p.p. Vermelho = alta (pressão inflacionária), azul = queda — semântica de inflação do painel. Fonte: SIDRA 7060 (v63)."
      stampGiro={geradoEm}
      stampDado={indice.mes_recente}
    >
      <Heatmap
        rows={rows}
        cols={cols}
        data={data}
        colorScale={escala}
        valueFmt={(v) => fmtSignedNum(v, 2)}
        cellWidth={54}
        caption="Células cinzas = sem observação. Passe o mouse para ver linha × mês."
      />
    </ChartCard>
  );
}
