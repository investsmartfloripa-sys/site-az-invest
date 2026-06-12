"use client";

import { useMemo, useState } from "react";

import type { PnadData } from "@/lib/painel-emprego";
import { AzSegmented, ChartCard } from "@/components/painel/core";
import { DivergingReturnBars, type DivergingBarRow } from "@/components/painel/charts/DivergingReturnBars";
import { fmtNum, fmtSignedNum } from "@/lib/format-br";
import { fmtTrimCurto, num, trimIsoCentral } from "@/components/painel/atividade/v2/shared";
import { TRIM_PRE_PANDEMIA, findTrim, trimAnoAnterior } from "./shared";

/**
 * Bloco 04 — "quais setores criam ocupação?". Decomposição da VARIAÇÃO da
 * ocupação por grupamento de atividade em barras horizontais divergentes
 * (Δ mil pessoas) — a vista que substitui o empilhado absoluto de 10 setores
 * somando ~100 mi, onde a variação era invisível. Sempre o trimestre mais
 * recente; o toggle alterna a base: YoY (mesmo trimestre do ano anterior —
 * controla a sazonalidade) ou vs 4T2019 (régua estrutural pós-pandemia).
 */

type Base = "yoy" | "pre";

export function SetoresPnadCard({ data, geradoEm }: { data: PnadData; geradoEm: string }) {
  const [base, setBase] = useState<Base>("yoy");

  const serie = data.setor.serie;
  const cats = data.setor.categorias;
  const ult = serie[serie.length - 1];

  const { rows, total, refTrim } = useMemo(() => {
    if (!ult) return { rows: [] as DivergingBarRow[], total: 0, refTrim: "" };
    const alvo = base === "yoy" ? trimAnoAnterior(ult.trim) : TRIM_PRE_PANDEMIA;
    const ref = findTrim(serie, alvo);
    const out: DivergingBarRow[] = [];
    let soma = 0;
    for (const c of cats) {
      const cur = num(ult, c);
      const ant = num(ref, c);
      if (cur == null || ant == null) continue;
      const d = Math.round(cur - ant);
      soma += d;
      out.push({ label: c, value: d });
    }
    out.sort((a, b) => b.value - a.value);
    return { rows: out, total: soma, refTrim: alvo };
  }, [serie, cats, ult, base]);

  const titulo = useMemo(() => {
    if (!ult || rows.length === 0) return "Variação da ocupação por setor";
    const top = rows[0];
    const fundo = rows[rows.length - 1];
    const destaque =
      total >= 0
        ? `maior motor: ${top.label} (${fmtSignedNum(top.value, 0)} mil)`
        : `maior perda: ${fundo.label} (${fmtSignedNum(fundo.value, 0)} mil)`;
    if (base === "yoy") {
      return total >= 0
        ? `Ocupação cresce ${fmtNum(total, 0)} mil em um ano — ${destaque}`
        : `Ocupação encolhe ${fmtNum(Math.abs(total), 0)} mil em um ano — ${destaque}`;
    }
    return total >= 0
      ? `Ocupação está ${fmtNum(total, 0)} mil acima do 4T2019 — ${destaque}`
      : `Ocupação ainda está ${fmtNum(Math.abs(total), 0)} mil abaixo do 4T2019 — ${destaque}`;
  }, [ult, rows, total, base]);

  return (
    <ChartCard
      title={titulo}
      subtitle={
        ult
          ? `Δ em mil pessoas ocupadas por grupamento de atividade: ${fmtTrimCurto(ult.trim)} vs ${fmtTrimCurto(refTrim)}. Quem cria e quem destrói postos — a soma das barras é o Δ total do título.`
          : undefined
      }
      toolbar={
        <AzSegmented
          ariaLabel="Base de comparação da decomposição setorial"
          options={[
            { id: "yoy", label: "YoY" },
            { id: "pre", label: "vs 4T2019" },
          ]}
          value={base}
          onChange={(id) => setBase(id as Base)}
        />
      }
      footer="SIDRA 5434 — ocupados por grupamento de atividade (mil pessoas, trimestre calendário). YoY = vs mesmo trimestre do ano anterior, a comparação que controla a sazonalidade; vs 4T2019 = mudança ESTRUTURAL acumulada desde o pré-pandemia (quais setores saíram maiores do choque)."
      stampGiro={geradoEm}
      stampDado={ult ? trimIsoCentral(ult.trim) : null}
    >
      <DivergingReturnBars
        rows={rows}
        valueFmt={(v) => `${fmtSignedNum(v, 0)} mil`}
        axisFmt={(v) => fmtSignedNum(v, 0)}
      />
    </ChartCard>
  );
}
