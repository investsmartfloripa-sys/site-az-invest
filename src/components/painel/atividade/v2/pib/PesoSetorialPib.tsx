"use client";

import { useMemo, useState } from "react";

import type { AtividadeCodaceData, AtividadePibData } from "@/lib/painel-atividade";
import { ChartCard, AzSegmented } from "@/components/painel/core";
import { variationText } from "@/lib/az-chart-theme";
import { fmtPct, fmtSignedNum } from "@/lib/format-br";
import { fmtTrimCurto, num } from "../shared";

/**
 * Peso de cada setor no PIB — a estrutura da economia hoje e como ela se moveu.
 * Tabela: para cada recorte da oferta, a participação % no PIB NOMINAL
 * (`estrutura_nominal`, chave `<r>_pct_pib`, 1846) no último trimestre, mais
 * duas colunas de VARIAÇÃO do peso (Δ em pontos percentuais): vs ~1 ano atrás
 * (4 trimestres) e vs ~10 anos atrás (40 trimestres). Ordenada por peso
 * decrescente — a economia de serviços salta à vista. NÍVEL e movimento
 * convivem aqui porque tudo está na mesma unidade (% do PIB / p.p.): é uma
 * tabela, não um gráfico de dois eixos.
 *
 * `pib` não entra (é o próprio denominador = 100%). `valor_adicionado` e
 * `impostos` são agregados (somam o PIB entre si), marcados como subtotais.
 */

// Recortes da oferta com chave `<r>_pct_pib` em estrutura_nominal (1846).
// `agg` = linha agregada (não somar com as desagregadas): VA + Impostos = PIB.
const RECORTES: { key: string; agg?: boolean }[] = [
  { key: "agro" },
  { key: "industria", agg: true },
  { key: "industria_extrativa" },
  { key: "industria_transformacao" },
  { key: "eletricidade_gas" },
  { key: "construcao" },
  { key: "servicos", agg: true },
  { key: "comercio" },
  { key: "transporte" },
  { key: "informacao" },
  { key: "financeiras" },
  { key: "imobiliarias" },
  { key: "outros_servicos" },
  { key: "admin_publica" },
  { key: "valor_adicionado", agg: true },
  { key: "impostos", agg: true },
];

const LAG_CURTO = 4; // ~1 ano
const LAG_LONGO = 40; // ~10 anos

type Linha = {
  key: string;
  rotulo: string;
  agg: boolean;
  peso: number;
  dCurto: number | null;
  dLongo: number | null;
};

function nomeRecorte(labels: AtividadePibData["labels"], key: string): string {
  return labels?.[key] ?? key;
}

export function PesoSetorialPib({
  pib,
  // codace aceito por simetria com os demais cards da face; não usado (tabela, sem eixo de tempo).
  geradoEm,
}: {
  pib: AtividadePibData;
  codace?: AtividadeCodaceData | null;
  geradoEm: string;
}) {
  const serie = pib.estrutura_nominal?.serie ?? [];
  const [horizonte, setHorizonte] = useState<"curto" | "longo">("longo");

  const { linhas, trimAtual, trimCurto, trimLongo, semDado } = useMemo(() => {
    const n = serie.length;
    if (n === 0) {
      return { linhas: [] as Linha[], trimAtual: pib.trim_recente, trimCurto: null as string | null, trimLongo: null as string | null, semDado: true };
    }
    const atual = serie[n - 1];
    const refCurto = n - 1 - LAG_CURTO >= 0 ? serie[n - 1 - LAG_CURTO] : null;
    const refLongo = n - 1 - LAG_LONGO >= 0 ? serie[n - 1 - LAG_LONGO] : null;

    const out: Linha[] = [];
    for (const r of RECORTES) {
      const chave = `${r.key}_pct_pib`;
      const peso = num(atual, chave);
      if (peso == null) continue;
      const antesCurto = refCurto ? num(refCurto, chave) : null;
      const antesLongo = refLongo ? num(refLongo, chave) : null;
      out.push({
        key: r.key,
        rotulo: nomeRecorte(pib.labels, r.key),
        agg: !!r.agg,
        peso,
        dCurto: antesCurto != null ? +(peso - antesCurto).toFixed(2) : null,
        dLongo: antesLongo != null ? +(peso - antesLongo).toFixed(2) : null,
      });
    }
    out.sort((a, b) => b.peso - a.peso);

    return {
      linhas: out,
      trimAtual: String(atual.trim ?? pib.trim_recente),
      trimCurto: refCurto ? String(refCurto.trim) : null,
      trimLongo: refLongo ? String(refLongo.trim) : null,
      semDado: false,
    };
  }, [serie, pib.labels, pib.trim_recente]);

  const trimDelta = horizonte === "curto" ? trimCurto : trimLongo;
  const labelDelta =
    horizonte === "curto"
      ? `Δ vs ${trimCurto ? fmtTrimCurto(trimCurto) : "1 ano"}`
      : `Δ vs ${trimLongo ? fmtTrimCurto(trimLongo) : "10 anos"}`;

  const maxPeso = Math.max(0.0001, ...linhas.map((l) => l.peso));

  return (
    <ChartCard
      title="Quanto cada setor pesa no PIB"
      subtitle={`Participação no PIB nominal (% do valor) no ${fmtTrimCurto(trimAtual)} e a variação do peso, em pontos percentuais, frente a ${horizonte === "curto" ? "um ano" : "dez anos"} atrás. Verde = ganhou espaço; vermelho = perdeu.`}
      toolbar={
        <AzSegmented
          ariaLabel="Horizonte da variação"
          options={[
            { id: "curto", label: "vs 1 ano" },
            { id: "longo", label: "vs 10 anos" },
          ]}
          value={horizonte}
          onChange={(id) => setHorizonte(id === "curto" ? "curto" : "longo")}
        />
      }
      footer="Fonte: IBGE/SIDRA — Contas Nacionais Trimestrais (1846, participação no PIB a preços correntes / nominal). Peso = % do valor adicionado bruto + impostos. Linhas com • são agregados: Valor adicionado + Impostos = PIB; Indústria e Serviços totalizam seus subsetores (não somar com eles). Δ em pontos percentuais (p.p.) frente a 4 ou 40 trimestres atrás."
      stampGiro={geradoEm}
      stampDado={trimAtual}
    >
      {semDado || linhas.length === 0 ? (
        <p className="py-8 text-center text-sm text-zinc-400">Sem dados de estrutura nominal disponíveis.</p>
      ) : (
        <div className="-mx-1 overflow-x-auto">
          <table className="w-full min-w-[420px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-[#132960]/10 text-[11px] uppercase tracking-wide text-zinc-500">
                <th scope="col" className="py-2 pl-1 pr-2 text-left font-semibold">
                  Setor
                </th>
                <th scope="col" className="py-2 px-2 text-right font-semibold">
                  Peso no PIB
                </th>
                <th scope="col" className="py-2 pl-2 pr-1 text-right font-semibold">
                  {labelDelta}
                </th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => {
                const delta = horizonte === "curto" ? l.dCurto : l.dLongo;
                const widthPct = Math.min(100, (l.peso / maxPeso) * 100);
                return (
                  <tr key={l.key} className="border-b border-zinc-100 last:border-0">
                    <th
                      scope="row"
                      className={`max-w-0 truncate py-1.5 pl-1 pr-2 text-left font-medium ${l.agg ? "text-zinc-500" : "text-[#132960]"}`}
                    >
                      {l.agg ? <span aria-hidden className="mr-1 text-zinc-300">•</span> : null}
                      {l.rotulo}
                    </th>
                    <td className="py-1.5 px-2 text-right align-middle">
                      <div className="flex items-center justify-end gap-2">
                        <span
                          aria-hidden
                          className="hidden h-1.5 rounded-full bg-[#132960]/15 sm:block"
                          style={{ width: `${Math.max(2, widthPct * 0.55)}%` }}
                        />
                        <span className="shrink-0 font-semibold tabular-nums text-[#132960]">{fmtPct(l.peso, 1)}</span>
                      </div>
                    </td>
                    <td className="py-1.5 pl-2 pr-1 text-right align-middle">
                      <span
                        className="font-semibold tabular-nums"
                        style={{ color: delta != null ? variationText(delta, 0.05) : undefined }}
                      >
                        {delta != null ? `${fmtSignedNum(delta, 2)} p.p.` : "—"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {trimDelta ? (
            <p className="mt-2 px-1 text-[11px] text-zinc-400">
              Variação do peso entre {fmtTrimCurto(trimDelta)} e {fmtTrimCurto(trimAtual)}, em pontos percentuais do PIB nominal.
            </p>
          ) : null}
        </div>
      )}
    </ChartCard>
  );
}
