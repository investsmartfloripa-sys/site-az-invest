"use client";

import { useMemo } from "react";

import type { TabelaSinteseIgpmBlock } from "@/lib/painel-igpm";
import { ChartCard } from "@/components/painel/core";
import { DivergingReturnBars, type DivergingBarRow } from "@/components/painel/charts/DivergingReturnBars";
import { AZ_CHART } from "@/lib/az-chart-theme";
import { fmtSignedNum } from "@/lib/format-br";

/**
 * Contribuição de cada componente ao IGP-M do mês (p.p., pesos EFETIVOS
 * encadeados) + o resíduo estrutural como linha própria — tudo lido da seção
 * "componentes" da tabela_sintese (o builder já inclui a linha de resíduo).
 * Semântica de inflação: contribuição positiva = vermelho, negativa = azul.
 */

const fmtPp = (v: number) => `${fmtSignedNum(v, 3)} p.p.`;
const fillInflacao = (v: number) => (v > 0 ? AZ_CHART.neg : v < 0 ? AZ_CHART.neutral : "#94A3B8");

export function DecomposicaoMesCard({ sintese, geradoEm }: { sintese: TabelaSinteseIgpmBlock; geradoEm: string }) {
  const rows = useMemo<DivergingBarRow[]>(() => {
    const sec = sintese.secoes.find((s) => s.id === "componentes");
    if (!sec) return [];
    return sec.linhas
      .filter((l) => l.contrib_pp != null)
      .map((l) => ({ label: l.nome, value: l.contrib_pp as number }));
  }, [sintese]);

  if (rows.length === 0) return null;

  return (
    <ChartCard
      title="Decomposição do mês"
      footer="Contribuições em p.p. com pesos EFETIVOS encadeados (w = peso de origem 60/30/10 × número-índice encadeado do componente, renormalizado mês a mês, no pipeline). O resíduo estrutural da aproximação é barra própria — nunca realocado entre componentes. Alta = vermelho, queda = azul (semântica de inflação)."
      stampGiro={geradoEm}
      stampDado={sintese.mes_recente}
    >
      <DivergingReturnBars
        rows={rows}
        valueFmt={fmtPp}
        axisFmt={(v) => fmtSignedNum(v, 2)}
        fillFor={fillInflacao}
        yAxisWidth={132}
      />
    </ChartCard>
  );
}
