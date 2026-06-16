"use client";

import { useMemo, useState } from "react";

import type { AtividadeCodaceData, AtividadePibData } from "@/lib/painel-atividade";
import { LABELS_PIB_FALLBACK } from "@/lib/painel-atividade";
import { ChartCard, AzSegmented, RankingTable, type RankingTableRow } from "@/components/painel/core";
import { fmtPct } from "@/lib/format-br";
import { fmtTrimCurto, num } from "../shared";

/**
 * Estrutura da demanda — quanto cada componente da despesa pesa no PIB. Barras
 * horizontais ordenadas pela magnitude do peso, na identidade da demanda
 * PIB = C + G + I + X − M (+ variação de estoque). Dois recortes (toggle):
 *   - Nominal: participação no PIB a preços correntes (`estrutura_nominal`,
 *     chave `<r>_pct_pib`, SIDRA 1846) no último trimestre — o peso "de bolso".
 *   - Real: participação em volume a preços de 1995 (`valores_reais_sa`,
 *     `<r>/pib·100` do último trimestre, SIDRA 6613) — o peso "de quantidade".
 *
 * Importações entram com leitura de VAZAMENTO: na identidade do PIB, M subtrai
 * (a economia consome bens de fora), então a barra aparece com sinal negativo
 * (vermelha) — não é "encolhimento", é a convenção contábil C+G+I+X−M.
 *
 * `valores_reais_sa` não traz `variacao_estoque` (só os 5 componentes de gasto
 * + agregados); no recorte Real essa linha some, com nota. Ambos os blocos são
 * opcionais no tipo — trata-se ausência sem quebrar.
 */

// 6 componentes da demanda. `vazamento` = entra subtraindo no PIB (importações).
const RECORTES: { key: string; vazamento?: boolean }[] = [
  { key: "consumo_familias" },
  { key: "consumo_governo" },
  { key: "fbcf" },
  { key: "exportacoes" },
  { key: "importacoes", vazamento: true },
  { key: "variacao_estoque" },
];

type Recorte = "nominal" | "real";

type LinhaPeso = {
  key: string;
  rotulo: string;
  /** Peso "de fato" (sempre positivo) — usado no rótulo e na ordenação. */
  peso: number;
  /** Valor plotado: negativo p/ importações (vazamento), positivo nos demais. */
  plot: number;
  vazamento: boolean;
};

function rotuloRecorte(labels: AtividadePibData["labels"], key: string): string {
  return labels?.[key] ?? LABELS_PIB_FALLBACK[key] ?? key;
}

export function EstruturaDemandaPib({
  pib,
  // codace aceito por simetria com os demais cards da face; não usado (snapshot de um trimestre, sem eixo de tempo).
  geradoEm,
}: {
  pib: AtividadePibData;
  codace?: AtividadeCodaceData | null;
  geradoEm: string;
}) {
  const [recorte, setRecorte] = useState<Recorte>("nominal");

  const serieNominal = pib.estrutura_nominal?.serie ?? [];
  const serieReal = pib.valores_reais_sa?.serie ?? [];

  const { linhas, trimRef, semDado, estoqueOculto } = useMemo(() => {
    const ultNominal = serieNominal.length ? serieNominal[serieNominal.length - 1] : null;
    const ultReal = serieReal.length ? serieReal[serieReal.length - 1] : null;

    // Denominador do recorte Real: PIB total em volume (preços de 1995) do último trimestre.
    const pibReal = ultReal ? num(ultReal, "pib") : null;

    const out: LinhaPeso[] = [];
    let estoqueOculto = false;

    for (const r of RECORTES) {
      let peso: number | null = null;
      if (recorte === "nominal") {
        peso = ultNominal ? num(ultNominal, `${r.key}_pct_pib`) : null;
      } else {
        const v = ultReal ? num(ultReal, r.key) : null;
        peso = v != null && pibReal != null && pibReal > 0 ? +((v / pibReal) * 100).toFixed(2) : null;
        // variacao_estoque não existe em valores_reais_sa — registra p/ a nota.
        if (peso == null && r.key === "variacao_estoque" && ultReal) estoqueOculto = true;
      }
      if (peso == null) continue;
      out.push({
        key: r.key,
        rotulo: rotuloRecorte(pib.labels, r.key),
        peso: Math.abs(peso),
        // Importações divergem (vazamento): plotamos negativo p/ a barra ficar vermelha à esquerda.
        plot: r.vazamento ? -Math.abs(peso) : peso,
        vazamento: !!r.vazamento,
      });
    }

    // Ordena pela magnitude do peso (maior componente no topo).
    out.sort((a, b) => b.peso - a.peso);

    const trimRef = String(
      (recorte === "nominal" ? ultNominal?.trim : ultReal?.trim) ?? pib.trim_recente,
    );

    return { linhas: out, trimRef, semDado: out.length === 0, estoqueOculto };
  }, [recorte, serieNominal, serieReal, pib.labels, pib.trim_recente]);

  const recorteIndisponivel =
    (recorte === "nominal" && serieNominal.length === 0) ||
    (recorte === "real" && serieReal.length === 0);

  // Escala comum das mini-barras: maior magnitude entre as linhas (eixo do consumo).
  const maxAbs = Math.max(0.0001, ...linhas.map((l) => l.peso));

  const rows: RankingTableRow[] = linhas.map((l) => ({
    label: l.rotulo,
    value: l.plot,
    hint: l.vazamento ? "vazamento (−)" : undefined,
  }));

  return (
    <ChartCard
      title="Estrutura da demanda: pesos no PIB"
      subtitle={`Quanto cada componente da despesa pesa no PIB no ${fmtTrimCurto(trimRef)}, na identidade C + G + I + X − M. Barras ordenadas pela magnitude do peso. Importações entram subtraindo (vazamento, em vermelho).`}
      toolbar={
        <AzSegmented
          ariaLabel="Base do peso"
          options={[
            { id: "nominal", label: "Nominal" },
            { id: "real", label: "Real" },
          ]}
          value={recorte}
          onChange={(id) => setRecorte(id === "real" ? "real" : "nominal")}
        />
      }
      footer={
        recorte === "nominal"
          ? "Fonte: IBGE/SIDRA — Contas Nacionais Trimestrais. Peso = participação no PIB a preços correntes / nominal (1846, chave % do PIB). Identidade da demanda: PIB = Consumo das famílias + Consumo do governo + FBCF + Exportações − Importações + Variação de estoque. Importações são vazamento (subtraem do PIB), por isso aparecem com sinal negativo."
          : "Fonte: IBGE/SIDRA — Contas Nacionais Trimestrais. Peso = participação no volume a preços de 1995, com ajuste sazonal (6613): componente ÷ PIB × 100, último trimestre. A soma não fecha 100% porque índices encadeados são não-aditivos. Importações são vazamento (subtraem do PIB), por isso aparecem com sinal negativo."
      }
      stampGiro={geradoEm}
      stampDado={trimRef}
    >
      {recorteIndisponivel || semDado ? (
        <p className="flex h-48 items-center justify-center text-center text-sm text-zinc-400">
          {recorte === "nominal"
            ? "Sem dados de estrutura nominal (% do PIB) nesta carga."
            : "Sem dados de valores reais (volume a preços de 1995) nesta carga."}
        </p>
      ) : (
        <>
          <RankingTable
            title={recorte === "nominal" ? "Peso no PIB nominal" : "Peso no PIB real (volume)"}
            rows={rows}
            maxAbs={maxAbs}
            valueFmt={(v) => fmtPct(Math.abs(v), 1)}
          />
          {recorte === "real" && estoqueOculto ? (
            <p className="mt-2 px-1 text-[11px] text-zinc-400">
              Variação de estoque não é publicada em volume a preços de 1995 (6613); aparece apenas no recorte Nominal.
            </p>
          ) : null}
        </>
      )}
    </ChartCard>
  );
}
