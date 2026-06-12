"use client";

import { useMemo } from "react";

import type { CagedTotalData } from "@/lib/painel-emprego";
import { ChartCard, Heatmap, steppedDivergingScale } from "@/components/painel/core";
import { fmtMesCurto, fmtNum, fmtSignedNum } from "@/lib/format-br";
import { mesIso } from "@/components/painel/atividade/v2/shared";
import { MESES_CURTO_PT, desvioRobusto, mediana } from "./shared";

/**
 * "Padrão sazonal" — heatmap ano × mês do saldo, mas as células mostram o
 * DESVIO ROBUSTO vs a mediana histórica DAQUELE mês (z-score por coluna com
 * mediana + MAD). Responde "este mês foi melhor que o normal DESTE mês?" —
 * dezembro é sempre negativo; a pergunta é se foi MAIS negativo que o normal.
 * Estatística robusta impede 2020 de dominar a escala.
 */

export function HeatmapSazonalCard({ total, geradoEm }: { total: CagedTotalData; geradoEm: string }) {
  const serie = total.serie;

  const { rows, data, zUltimo } = useMemo(() => {
    // Valores por coluna (mês do ano) p/ mediana e MAD.
    const porColuna = new Map<number, number[]>();
    for (const r of serie) {
      if (r.saldo == null) continue;
      const m = parseInt(r.mes.slice(5, 7), 10);
      if (!porColuna.has(m)) porColuna.set(m, []);
      porColuna.get(m)!.push(r.saldo);
    }
    const medCol = new Map<number, number>();
    const sdCol = new Map<number, number>();
    for (const [m, vals] of porColuna) {
      const med = mediana(vals);
      const sd = desvioRobusto(vals);
      if (med != null) medCol.set(m, med);
      if (sd != null) sdCol.set(m, sd);
    }

    const grade: Record<string, Record<string, number | null>> = {};
    const anos = new Set<string>();
    let zUlt: number | null = null;
    for (const r of serie) {
      if (r.saldo == null) continue;
      const ano = r.mes.slice(0, 4);
      const m = parseInt(r.mes.slice(5, 7), 10);
      const med = medCol.get(m);
      const sd = sdCol.get(m);
      const z = med != null && sd != null && sd > 0 ? +((r.saldo - med) / sd).toFixed(2) : null;
      anos.add(ano);
      grade[ano] = grade[ano] ?? {};
      grade[ano][MESES_CURTO_PT[m - 1]] = z;
      if (r.mes === serie[serie.length - 1].mes) zUlt = z;
    }
    return { rows: [...anos].sort(), data: grade, zUltimo: zUlt };
  }, [serie]);

  const colorScale = useMemo(() => steppedDivergingScale([0.5, 1, 2]), []);

  const ult = serie[serie.length - 1];
  const titulo = (() => {
    if (!ult || zUltimo == null) return "Padrão sazonal — cada mês contra o histórico dele mesmo";
    const nomeMes = MESES_CURTO_PT[parseInt(ult.mes.slice(5, 7), 10) - 1];
    if (Math.abs(zUltimo) < 0.5) return `${fmtMesCurto(ult.mes)} veio em linha com o típico de ${nomeMes}`;
    return `${fmtMesCurto(ult.mes)} veio ${fmtNum(Math.abs(zUltimo), 1)} desvio${Math.abs(zUltimo) >= 1.95 ? "s" : ""} ${
      zUltimo > 0 ? "ACIMA" : "ABAIXO"
    } do típico para ${nomeMes}`;
  })();

  return (
    <ChartCard
      title={titulo}
      subtitle="Célula = (saldo do mês − mediana histórica DESSE mês) ÷ desvio robusto da coluna. Verde: melhor que o normal do próprio mês; vermelho: pior — a sazonalidade já está descontada."
      footer="z-score robusto por coluna (mediana + MAD × 1,4826). Um heatmap de saldo CRU só repetiria o calendário (dezembro sempre vermelho) e deixaria 2020 esmagar a escala — este responde 'foi melhor que o normal DESTE mês?'."
      stampGiro={geradoEm}
      stampDado={ult ? mesIso(ult.mes) : null}
    >
      <Heatmap
        rows={rows}
        cols={[...MESES_CURTO_PT]}
        data={data}
        colorScale={colorScale}
        valueFmt={(v) => fmtSignedNum(v, 1)}
        caption="Leitura: 0 = mês típico; +1 = um desvio robusto acima do normal daquele mês do ano; −2 = muito pior que o normal. Dezembro é SEMPRE negativo no cru (dispensas de fim de ano) — aqui só fica vermelho se for mais negativo que o dezembro típico."
        cellWidth={44}
      />
    </ChartCard>
  );
}
