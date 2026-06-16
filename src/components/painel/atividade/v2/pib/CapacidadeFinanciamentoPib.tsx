"use client";

import { useMemo, useState } from "react";

import type { AtividadeCodaceData, AtividadePibData } from "@/lib/painel-atividade";
import { ChartCard, AzSegmented } from "@/components/painel/core";
import { AzTimeSeriesChart, type AzSeriesPoint } from "@/components/painel/charts/AzTimeSeriesChart";
import { AZ_BRAND } from "@/lib/az-chart-theme";
import { num, trimIsoCentral } from "../shared";

/**
 * Capacidade/necessidade líquida de financiamento da economia (B.9) — o saldo
 * da conta financeira das Contas Nacionais (SIDRA 2205), desde 2010. B.9 mede,
 * a cada trimestre, se o país poupou mais do que investiu (B.9 > 0, capacidade
 * de financiamento, é credor líquido frente ao resto do mundo) ou menos (B.9 < 0,
 * necessidade de financiamento — a poupança interna não cobre o investimento e o
 * país recorre a financiamento externo). No Brasil B.9 é quase sempre negativo.
 *
 * Toggle (AzSegmented): Trimestral (fluxo do trimestre, `serie`) × Acum-4T
 * (soma móvel de 4 trimestres, `serie_acum4t` — leitura anualizada, menos ruído
 * sazonal). Linha de referência em y = 0 separa capacidade de necessidade.
 *
 * conta_financeira NÃO está no tipo AtividadePibData — acesso via cast. No JSON,
 * o B.9 vem populado apenas em `b9_passivo` (`b9_ativo`/`b9_liquido` são nulos
 * em toda a série); é esse o saldo B.9, em R$ milhões. Aqui mostramos em R$ bi
 * (÷ 1000). Se conta_financeira faltar na carga, exibe placeholder "sem dados".
 */

type FinRow = Record<string, unknown> & { trim: string };

type ContaFinanceira = {
  serie?: FinRow[];
  serie_acum4t?: FinRow[];
};

type Recorte = "tri" | "acum4t";

export function CapacidadeFinanciamentoPib({
  pib,
  // codace aceito por simetria com os demais cards da face; não usado aqui.
  geradoEm,
}: {
  pib: AtividadePibData;
  codace?: AtividadeCodaceData | null;
  geradoEm: string;
}) {
  const [recorte, setRecorte] = useState<Recorte>("acum4t");

  const cf = (pib as unknown as { conta_financeira?: ContaFinanceira }).conta_financeira;

  const { tri, acum, ultimoTrim } = useMemo(() => {
    // B.9 vive em b9_passivo (único campo populado); R$ milhões → R$ bi (÷1000).
    const toPts = (serie: FinRow[] | undefined): AzSeriesPoint[] => {
      const out: AzSeriesPoint[] = [];
      for (const r of serie ?? []) {
        const v = num(r, "b9_passivo");
        if (v != null) out.push([trimIsoCentral(String(r.trim)), +(v / 1000).toFixed(2)]);
      }
      return out;
    };
    const tri = toPts(cf?.serie);
    const acum = toPts(cf?.serie_acum4t);
    const fonte = cf?.serie ?? [];
    const ultimoTrim = fonte.length ? String(fonte[fonte.length - 1].trim) : pib.trim_recente;
    return { tri, acum, ultimoTrim };
  }, [cf, pib.trim_recente]);

  const pts = recorte === "tri" ? tri : acum;
  const semDado = tri.length === 0 && acum.length === 0;

  return (
    <ChartCard
      title="O Brasil ainda depende de financiamento externo"
      subtitle="Capacidade (+) ou necessidade (−) líquida de financiamento da economia (B.9), o saldo da conta financeira desde 2010, em R$ bilhões. Acima de zero, o país é poupador líquido; abaixo, a poupança interna não cobre o investimento e recorre ao resto do mundo."
      toolbar={
        <AzSegmented
          ariaLabel="Frequência da série B.9"
          options={[
            { id: "tri", label: "Trimestral" },
            { id: "acum4t", label: "Acum-4T" },
          ]}
          value={recorte}
          onChange={(id) => setRecorte(id === "tri" ? "tri" : "acum4t")}
        />
      }
      footer="Fonte: IBGE/SIDRA — Contas Nacionais Trimestrais, conta financeira por instrumento (2205). B.9 = capacidade (+) / necessidade (−) líquida de financiamento da economia: a diferença entre poupança bruta e investimento, igual em valor ao saldo das transações com o resto do mundo. Trimestral = fluxo do trimestre; Acum-4T = soma móvel de 4 trimestres (leitura anualizada, sem sazonalidade). Valores em R$ bilhões correntes."
      stampGiro={geradoEm}
      stampDado={ultimoTrim}
    >
      {semDado ? (
        <p className="flex h-48 items-center justify-center text-center text-sm text-zinc-400">
          Sem dados da conta financeira (B.9) nesta carga.
        </p>
      ) : (
        <AzTimeSeriesChart
          series={[
            {
              id: "b9",
              label: "B.9 — capacidade/necessidade de financiamento",
              color: AZ_BRAND.navy,
              data: pts,
            },
          ]}
          unit="R$"
          height={360}
          variant="hero"
          showLegend={false}
          refLines={[{ y: 0, color: "#94A3B8", dashed: true }]}
        />
      )}
    </ChartCard>
  );
}
