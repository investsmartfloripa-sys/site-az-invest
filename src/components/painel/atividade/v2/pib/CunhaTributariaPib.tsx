"use client";

import { useMemo, useState } from "react";

import type { AtividadeCodaceData, AtividadePibData } from "@/lib/painel-atividade";
import { LABELS_PIB_FALLBACK } from "@/lib/painel-atividade";
import { ChartCard, AzSegmented, RankingTable, type RankingTableRow } from "@/components/painel/core";
import { AzTimeSeriesChart, type AzSeriesPoint } from "@/components/painel/charts/AzTimeSeriesChart";
import { AZ_BRAND } from "@/lib/az-chart-theme";
import { fmtPct } from "@/lib/format-br";
import { fmtTrimCurto, num, trimIsoCentral } from "../shared";

/**
 * A cunha tributária da estrutura nominal — onde a soma do que cada grande setor
 * PRODUZ (Valor adicionado a preços básicos) e o PIB (a preços de mercado) se
 * separam. Na identidade da oferta, PIB = Valor adicionado + Impostos líquidos
 * sobre produtos; a diferença entre os dois é a "cunha tributária": o quanto da
 * renda nominal não é remunerado a fatores, mas arrecadado sobre produtos
 * (ICMS, IPI, II...). Em % do PIB nominal, VA + Impostos somam 100.
 *
 * Dois recortes (toggle):
 *  - Composição (snapshot do último trimestre): barras do peso no PIB dos GRANDES
 *    setores que compõem o valor adicionado (Serviços, Indústria, Agropecuária)
 *    + a cunha de Impostos líquidos — quatro fatias que fecham (aproximadamente)
 *    100% do PIB nominal. Lê de `estrutura_nominal` (chaves `<r>_pct_pib`, 1846).
 *  - Evolução: as mesmas quatro participações ao longo do tempo (índice de % do
 *    PIB), incluindo o agregado Valor adicionado vs. a cunha de Impostos.
 *
 * `estrutura_nominal` é opcional no tipo (e a série não declara `trim` no tipo,
 * embora exista em runtime) — trata-se ausência sem quebrar.
 */

// Grandes blocos do valor adicionado + a cunha tributária. `cunha` = Impostos
// líquidos (o gap entre VA e PIB). Ordem: maiores componentes do VA primeiro.
const BLOCOS: { key: string; cunha?: boolean }[] = [
  { key: "servicos" },
  { key: "industria" },
  { key: "agro" },
  { key: "impostos", cunha: true },
];

// Linhas do recorte "Evolução": agregam o VA e contrastam com a cunha.
const LINHAS_EVOLUCAO: { key: string; cor: string }[] = [
  { key: "valor_adicionado", cor: AZ_BRAND.navy },
  { key: "impostos", cor: AZ_BRAND.rust },
  { key: "servicos", cor: AZ_BRAND.azure },
  { key: "industria", cor: "#1E8A5C" },
  { key: "agro", cor: "#A16207" },
];

type Recorte = "composicao" | "evolucao";

function rotulo(labels: AtividadePibData["labels"], key: string): string {
  return labels?.[key] ?? LABELS_PIB_FALLBACK[key] ?? key;
}

export function CunhaTributariaPib({
  pib,
  // codace aceito por simetria; usado só p/ contexto histórico no recorte temporal.
  geradoEm,
}: {
  pib: AtividadePibData;
  codace?: AtividadeCodaceData | null;
  geradoEm: string;
}) {
  const [recorte, setRecorte] = useState<Recorte>("composicao");

  const serie = pib.estrutura_nominal?.serie ?? [];
  const labels = pib.labels ?? {};

  // ---- Recorte "Composição": peso no PIB dos grandes blocos no último trim ----
  const { rows, trimRef, cunha, vaTotal } = useMemo(() => {
    const ult = serie.length ? serie[serie.length - 1] : null;
    const trimRef = String(((ult as Record<string, unknown> | null)?.trim as string | undefined) ?? pib.trim_recente);

    const out: RankingTableRow[] = [];
    for (const b of BLOCOS) {
      const peso = ult ? num(ult, `${b.key}_pct_pib`) : null;
      if (peso == null) continue;
      out.push({
        label: rotulo(labels, b.key),
        value: peso,
        hint: b.cunha ? "cunha tributária" : undefined,
      });
    }
    const cunha = ult ? num(ult, "impostos_pct_pib") : null;
    const vaTotal = ult ? num(ult, "valor_adicionado_pct_pib") : null;
    return { rows: out, trimRef, cunha, vaTotal };
  }, [serie, labels, pib.trim_recente]);

  // ---- Recorte "Evolução": as participações ao longo do tempo ----
  const seriesTempo = useMemo(
    () =>
      LINHAS_EVOLUCAO.map((l) => {
        const data: AzSeriesPoint[] = [];
        for (const row of serie) {
          const t = (row as Record<string, unknown>).trim;
          const v = num(row, `${l.key}_pct_pib`);
          if (typeof t === "string" && v != null) data.push([trimIsoCentral(t), v]);
        }
        return { id: l.key, label: rotulo(labels, l.key), color: l.cor, data };
      }).filter((s) => s.data.length > 0),
    [serie, labels],
  );

  const semDado = serie.length === 0 || (recorte === "composicao" ? rows.length === 0 : seriesTempo.length === 0);

  // Escala das barras: 100 (% do PIB) para a cunha não desaparecer ao lado de Serviços.
  const maxAbs = Math.max(0.0001, ...rows.map((r) => Math.abs(r.value)));

  return (
    <ChartCard
      title="A cunha tributária da estrutura nominal do PIB"
      subtitle={`Na oferta, PIB = Valor adicionado + Impostos líquidos sobre produtos. ${
        recorte === "composicao"
          ? `Peso no PIB nominal dos grandes setores que produzem o valor adicionado, mais a cunha de impostos, no ${fmtTrimCurto(trimRef)}.`
          : "Como essas participações no PIB nominal se moveram ao longo do tempo."
      }`}
      toolbar={
        <AzSegmented
          ariaLabel="Recorte da cunha tributária"
          options={[
            { id: "composicao", label: "Composição" },
            { id: "evolucao", label: "Evolução" },
          ]}
          value={recorte}
          onChange={(id) => setRecorte(id === "evolucao" ? "evolucao" : "composicao")}
        />
      }
      footer="Fonte: IBGE/SIDRA — Contas Nacionais Trimestrais (1846, participação no PIB a preços correntes / nominal). Identidade da oferta: PIB a preços de mercado = Valor adicionado a preços básicos + Impostos líquidos sobre produtos. A cunha tributária é a diferença entre os dois — a parcela da renda nominal arrecadada sobre produtos (ICMS, IPI, II e afins). Serviços, Indústria e Agropecuária são os grandes blocos do valor adicionado; somados à cunha de impostos, fecham (aproximadamente) 100% do PIB nominal."
      stampGiro={geradoEm}
      stampDado={trimRef}
    >
      {semDado ? (
        <p className="flex h-48 items-center justify-center text-center text-sm text-zinc-400">
          Sem dados de estrutura nominal (% do PIB) nesta carga.
        </p>
      ) : recorte === "composicao" ? (
        <>
          <RankingTable
            title={`Peso no PIB nominal — ${fmtTrimCurto(trimRef)}`}
            rows={rows}
            maxAbs={maxAbs}
            dotColor={AZ_BRAND.navy}
            valueFmt={(v) => fmtPct(v, 1)}
          />
          {cunha != null && vaTotal != null ? (
            <p className="mt-2 px-1 text-[11px] text-zinc-400">
              Valor adicionado a preços básicos = {fmtPct(vaTotal, 1)} do PIB; a cunha de impostos líquidos sobre produtos
              responde por {fmtPct(cunha, 1)}. É essa cunha que separa o que os setores produzem (valor adicionado) do PIB
              a preços de mercado.
            </p>
          ) : null}
        </>
      ) : (
        <AzTimeSeriesChart
          series={seriesTempo}
          unit="%"
          period={{ id: "max" }}
          height={340}
          seriesEndLabels
        />
      )}
    </ChartCard>
  );
}
