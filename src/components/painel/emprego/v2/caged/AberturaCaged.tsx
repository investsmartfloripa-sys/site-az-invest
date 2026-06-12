"use client";

import { useMemo, useState } from "react";

import type { CagedQuebrasData } from "@/lib/painel-emprego";
import { FAIXAS_5_ORDEM, SETORES_IBGE_ORDEM, agrupa5 } from "@/lib/painel-emprego";
import { AzSegmented, ChartCard } from "@/components/painel/core";
import { DivergingReturnBars, type DivergingBarRow } from "@/components/painel/charts/DivergingReturnBars";
import { variationText } from "@/lib/az-chart-theme";
import { fmtPct, fmtSignedNum } from "@/lib/format-br";
import { mesIso } from "@/components/painel/atividade/v2/shared";
import { fmtSignedMil, somaJanela } from "./shared";

/**
 * "Quem cria as vagas?" — saldo ACUMULADO 12 MESES por setor IBGE ou por
 * faixa salarial (5 grupos), em barras horizontais DIVERGENTES. Nada de pizza
 * nem stacked de saldo: saldo tem sinal misto e não comporta share — o share
 * (%) aparece só nas ADMISSÕES por faixa (fluxo bruto), e só nos meses em que
 * o campo v2 existe.
 */

type Vista = "setores" | "faixas";

type Linha = DivergingBarRow & { delta: number | null };

export function AberturaCaged({ quebras, geradoEm }: { quebras: CagedQuebrasData; geradoEm: string }) {
  const [vista, setVista] = useState<Vista>("setores");

  const serie = quebras.serie;
  const ult12 = useMemo(() => serie.slice(-12), [serie]);
  const ant12 = useMemo(() => serie.slice(-24, -12), [serie]);
  const temComparacao = ant12.length === 12;

  const { rows, mesesComShare } = useMemo(() => {
    if (vista === "setores") {
      const atual = somaJanela(ult12, "saldo_por_setor_ibge");
      const anterior = temComparacao ? somaJanela(ant12, "saldo_por_setor_ibge") : null;
      const out: Linha[] = SETORES_IBGE_ORDEM.map((s) => ({
        label: s,
        value: +((atual[s] ?? 0) / 1000).toFixed(1),
        delta: anterior ? (atual[s] ?? 0) - (anterior[s] ?? 0) : null,
      }));
      out.sort((a, b) => b.value - a.value);
      return { rows: out, mesesComShare: 0 };
    }
    // Faixas: agrega as 11 faixas somadas do período em 5 grupos (faixa "00" já excluída no agrupa5).
    const atual = agrupa5(somaJanela(ult12, "saldo_por_faixa_salario"));
    const anterior = temComparacao ? agrupa5(somaJanela(ant12, "saldo_por_faixa_salario")) : null;

    // Share % das ADMISSÕES por faixa — só nos meses em que admissoes_por_faixa existe.
    const mesesAdm = ult12.filter((r) => r.admissoes_por_faixa && Object.keys(r.admissoes_por_faixa).length > 0);
    const admPorFaixa = mesesAdm.length > 0 ? agrupa5(somaJanela(mesesAdm, "admissoes_por_faixa")) : null;
    const admTotal = admPorFaixa ? Object.values(admPorFaixa).reduce((a, b) => a + b, 0) : 0;

    const out: Linha[] = FAIXAS_5_ORDEM.map((f) => {
      const share = admPorFaixa && admTotal > 0 ? (100 * (admPorFaixa[f] ?? 0)) / admTotal : null;
      return {
        label: share != null ? `${f} · ${fmtPct(share, 0)} adm.` : f,
        value: +((atual[f] ?? 0) / 1000).toFixed(1),
        delta: anterior ? (atual[f] ?? 0) - (anterior[f] ?? 0) : null,
      };
    });
    out.sort((a, b) => b.value - a.value);
    return { rows: out, mesesComShare: mesesAdm.length };
  }, [vista, ult12, ant12, temComparacao]);

  const top = rows.length > 0 ? rows[0] : null;
  const titulo = (() => {
    if (!top) return "Saldo acumulado 12 meses por recorte";
    const nomeTop = top.label.split(" · ")[0];
    if (top.value < 0)
      return `Todos os recortes fecham vagas em 12 meses — ${nomeTop} resiste melhor (${fmtSignedNum(top.value, 1)} mil)`;
    return vista === "setores"
      ? `${nomeTop} lidera a criação de vagas: ${fmtSignedNum(top.value, 1)} mil no acumulado 12 meses`
      : `As vagas novas se concentram em ${nomeTop}: ${fmtSignedNum(top.value, 1)} mil em 12 meses`;
  })();

  const ultMes = serie.length > 0 ? serie[serie.length - 1].mes : null;

  return (
    <ChartCard
      title={titulo}
      subtitle={
        vista === "setores"
          ? "Saldo acumulado dos últimos 12 meses por setor IBGE (mil postos, microdado). Barras divergentes: criação líquida à direita, fechamento à esquerda."
          : `Saldo acumulado dos últimos 12 meses por faixa salarial em salários mínimos (mil postos, microdado).${
              mesesComShare > 0 ? ` Share % = participação nas ADMISSÕES (fluxo bruto, ${mesesComShare} ${mesesComShare === 1 ? "mês" : "meses"} com dado).` : ""
            }`
      }
      toolbar={
        <AzSegmented
          ariaLabel="Recorte da abertura"
          options={[
            { id: "setores", label: "Setores" },
            { id: "faixas", label: "Faixas salariais" },
          ]}
          value={vista}
          onChange={(id) => setVista(id as Vista)}
        />
      }
      footer="Microdados PDET/MTE — declarações no prazo, cobertura ~40–50% do saldo oficial: use para COMPOSIÇÃO, não para o nível. Share % apenas de admissões — saldo tem sinal misto e não comporta participação. Faixa '00' (salário não informado) excluída. Δ = acumulado 12m vs os 12m imediatamente anteriores."
      stampGiro={geradoEm}
      stampDado={ultMes ? mesIso(ultMes) : null}
    >
      {temComparacao ? (
        <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-zinc-500">
          <span className="font-semibold uppercase tracking-wider text-zinc-400">Δ vs 12m anteriores:</span>
          {rows.map((r) => (
            <span key={r.label} className="whitespace-nowrap tabular-nums">
              {r.label.split(" · ")[0]}{" "}
              <strong style={{ color: variationText((r.delta ?? 0) / 1000) }}>{fmtSignedMil(r.delta)}</strong>
            </span>
          ))}
        </div>
      ) : null}
      <DivergingReturnBars
        rows={rows}
        yAxisWidth={132}
        valueFmt={(v) => `${fmtSignedNum(v, 0)} mil`}
        axisFmt={(v) => fmtSignedNum(v, 0)}
      />
    </ChartCard>
  );
}
