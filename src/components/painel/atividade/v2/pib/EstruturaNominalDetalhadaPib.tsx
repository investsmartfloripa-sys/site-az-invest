"use client";

import { useMemo, useState } from "react";

import type { AtividadeCodaceData, AtividadePibData } from "@/lib/painel-atividade";
import { LABELS_PIB_FALLBACK } from "@/lib/painel-atividade";
import { ChartCard, AzSegmented } from "@/components/painel/core";
import { AzPeriodSelector, type AzPeriodValue } from "@/components/painel/charts/AzPeriodSelector";
import { AzTimeSeriesChart, type AzSeriesPoint, type AzTimeSeries } from "@/components/painel/charts/AzTimeSeriesChart";
import { seriesColor } from "@/lib/az-chart-theme";
import { num, trimIsoCentral } from "../shared";

/**
 * Como a composição NOMINAL da economia muda ao longo do tempo. Multi-série da
 * participação no PIB a preços correntes (`estrutura_nominal`, chave
 * `<r>_pct_pib`, SIDRA 1846) dos SUBSETORES da oferta — não dos agregados
 * Indústria/Serviços/VA (que se sobreporiam e poluiriam a leitura), mas das
 * peças que os compõem.
 *
 * São treze subsetores; plotar todos vira um emaranhado. O toggle escolhe o
 * recorte:
 *   - "Maiores" (default): os ~8 de maior peso no último trimestre — onde a
 *     recomposição é visível (peso de adm. pública, transformação, financeiras…);
 *   - "Todos": os treze, p/ inspeção completa (mais ruidoso, intencionalmente).
 *
 * Cada série leva sua cor da paleta categórica AZ (fixada por subsetor, não pela
 * ordem do recorte, p/ a cor não "pular" ao trocar de toggle). `seriesEndLabels`
 * ancora o valor atual de cada linha na margem — substitui um painel lateral.
 *
 * O AzTimeSeriesChart não empilha (área empilhada é gráfico dedicado); aqui a
 * leitura é de TRAJETÓRIA de cada peça (sobe/desce de peso), que o multi-linha
 * entrega bem. `estrutura_nominal` é opcional no tipo — ausência é tratada.
 */

// Subsetores da oferta (chave `<r>_pct_pib`). NÃO inclui os agregados
// industria/servicos/valor_adicionado (somam seus próprios subsetores) nem
// o PIB (denominador = 100). Ordem da lista = ordem fixa de cor por subsetor.
const SUBSETORES = [
  "agro",
  "industria_extrativa",
  "industria_transformacao",
  "eletricidade_gas",
  "construcao",
  "comercio",
  "transporte",
  "informacao",
  "financeiras",
  "imobiliarias",
  "outros_servicos",
  "admin_publica",
  "impostos",
] as const;

const TOP_N = 8; // recorte "Maiores": os 8 subsetores de maior peso atual

type Recorte = "maiores" | "todos";

function rotuloSubsetor(labels: AtividadePibData["labels"], key: string): string {
  return labels?.[key] ?? LABELS_PIB_FALLBACK[key] ?? key;
}

export function EstruturaNominalDetalhadaPib({
  pib,
  // codace aceito por simetria; não usado (este card é de subsetores, não de ciclo).
  codace: _codace,
  geradoEm,
}: {
  pib: AtividadePibData;
  codace?: AtividadeCodaceData | null;
  geradoEm: string;
}) {
  const [period, setPeriod] = useState<AzPeriodValue>({ id: "max" });
  const [recorte, setRecorte] = useState<Recorte>("maiores");

  const serie = pib.estrutura_nominal?.serie ?? [];

  const { series, minIso, maxIso, semDado } = useMemo(() => {
    if (serie.length === 0) {
      return { series: [] as AzTimeSeries[], minIso: "", maxIso: "", semDado: true };
    }

    // Cor FIXA por subsetor (índice na lista), independente do recorte.
    const corPorKey = new Map<string, string>();
    SUBSETORES.forEach((k, i) => corPorKey.set(k, seriesColor(i)));

    // Peso no último trimestre — define quais entram no recorte "Maiores".
    const ult = serie[serie.length - 1];
    const pesoAtual = (k: string) => num(ult, `${k}_pct_pib`) ?? -Infinity;

    const escolhidos =
      recorte === "todos"
        ? [...SUBSETORES]
        : [...SUBSETORES].sort((a, b) => pesoAtual(b) - pesoAtual(a)).slice(0, TOP_N);

    // Constrói as séries na ordem de peso atual (legenda do maior p/ o menor).
    const ordenados = [...escolhidos].sort((a, b) => pesoAtual(b) - pesoAtual(a));

    const series: AzTimeSeries[] = [];
    let minIso = "";
    let maxIso = "";
    for (const key of ordenados) {
      const chave = `${key}_pct_pib`;
      const data: AzSeriesPoint[] = [];
      for (const r of serie) {
        const v = num(r, chave);
        if (v == null) continue;
        const d = trimIsoCentral(String((r as unknown as { trim: string }).trim));
        data.push([d, v]);
        if (!minIso || d < minIso) minIso = d;
        if (!maxIso || d > maxIso) maxIso = d;
      }
      if (data.length === 0) continue;
      series.push({
        id: key,
        label: rotuloSubsetor(pib.labels, key),
        color: corPorKey.get(key),
        data,
      });
    }

    return { series, minIso, maxIso, semDado: series.length === 0 };
  }, [serie, recorte, pib.labels]);

  return (
    <ChartCard
      title="A composição da economia se recompõe década a década"
      subtitle="Participação de cada subsetor no PIB nominal (% do valor, a preços correntes), trimestre a trimestre. As linhas mostram quem ganha e quem perde espaço — sem ruído dos agregados Indústria/Serviços."
      toolbar={
        <div className="flex flex-wrap items-center gap-2">
          <AzSegmented
            ariaLabel="Quais subsetores exibir"
            options={[
              { id: "maiores", label: "Maiores" },
              { id: "todos", label: "Todos" },
            ]}
            value={recorte}
            onChange={(id) => setRecorte(id === "todos" ? "todos" : "maiores")}
          />
          <AzPeriodSelector value={period} onChange={setPeriod} min={minIso} max={maxIso} periods={["1y", "5y", "max"]} />
        </div>
      }
      footer="Fonte: IBGE/SIDRA — Contas Nacionais Trimestrais (1846, participação no PIB a preços correntes / nominal). Cada linha é a fatia de um subsetor da oferta no PIB. Exclui os agregados Indústria, Serviços e Valor adicionado (que somam seus próprios subsetores) e o PIB (denominador = 100%). Recorte “Maiores” = os 8 subsetores de maior peso no trimestre mais recente."
      stampGiro={geradoEm}
      stampDado={pib.trim_recente}
    >
      {semDado ? (
        <p className="flex h-64 items-center justify-center text-center text-sm text-zinc-400">
          Sem dados de estrutura nominal (% do PIB) nesta carga.
        </p>
      ) : (
        <AzTimeSeriesChart
          series={series}
          unit="%"
          period={period}
          height={380}
          showLegend
          seriesEndLabels
        />
      )}
    </ChartCard>
  );
}
