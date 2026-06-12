"use client";

import { useMemo, useState } from "react";

import type { CodaceFaixaAtividade } from "@/lib/painel-atividade";
import type { PnadData } from "@/lib/painel-emprego";
import { ChartCard } from "@/components/painel/core";
import { AzPeriodSelector, type AzPeriodValue } from "@/components/painel/charts/AzPeriodSelector";
import { AzTimeSeriesChart } from "@/components/painel/charts/AzTimeSeriesChart";
import { AZ_BRAND } from "@/lib/az-chart-theme";
import { fmtSignedNum } from "@/lib/format-br";
import { codaceAreas, num, toPointsTrim, trimIsoCentral } from "@/components/painel/atividade/v2/shared";
import { PNAD_KEYS, findTrim, trimAnoAnterior } from "./shared";

/**
 * Bloco 03 — "a ocupação que cresce é de qualidade?". Dois mini-painéis
 * EMPILHADOS (unidades diferentes NUNCA no mesmo eixo): em cima, ocupados no
 * setor privado com e sem carteira em mil pessoas (nível — as séries se
 * movem o bastante para a leitura direta); embaixo, o share de conta própria
 * na ocupação total (%), a terceira face da qualidade.
 */

export function QualidadeCard({
  data,
  codaceMensal,
  geradoEm,
}: {
  data: PnadData;
  codaceMensal?: CodaceFaixaAtividade[];
  geradoEm: string;
}) {
  const [period, setPeriod] = useState<AzPeriodValue>({ id: "5y" });

  const carteiraSerie = useMemo(() => data.carteira?.serie ?? [], [data.carteira]);
  const comPoints = useMemo(() => toPointsTrim(carteiraSerie, "com_carteira_mil"), [carteiraSerie]);
  const semPoints = useMemo(() => toPointsTrim(carteiraSerie, "sem_carteira_mil"), [carteiraSerie]);
  const contaPoints = useMemo(() => toPointsTrim(data.composicao.serie, PNAD_KEYS.contaPropria), [data.composicao.serie]);
  const faixas = useMemo(() => codaceAreas(codaceMensal), [codaceMensal]);

  // Título afirmativo: qual vínculo cresce mais rápido em um ano (Δ mil).
  const titulo = useMemo(() => {
    const ult = carteiraSerie[carteiraSerie.length - 1];
    if (!ult) return "Com × sem carteira no setor privado";
    const prev = findTrim(carteiraSerie, trimAnoAnterior(ult.trim));
    const com = num(ult, "com_carteira_mil");
    const sem = num(ult, "sem_carteira_mil");
    const comPrev = num(prev, "com_carteira_mil");
    const semPrev = num(prev, "sem_carteira_mil");
    if (com == null || sem == null || comPrev == null || semPrev == null) {
      return "Com × sem carteira no setor privado";
    }
    const dCom = Math.round(com - comPrev);
    const dSem = Math.round(sem - semPrev);
    if (dCom >= dSem) {
      return `Carteira assinada lidera: ${fmtSignedNum(dCom, 0)} mil em um ano, contra ${fmtSignedNum(dSem, 0)} mil sem carteira`;
    }
    return `O emprego sem carteira cresce mais rápido: ${fmtSignedNum(dSem, 0)} mil em um ano, contra ${fmtSignedNum(dCom, 0)} mil com carteira`;
  }, [carteiraSerie]);

  const minIso = carteiraSerie.length > 0 ? trimIsoCentral(carteiraSerie[0].trim) : "";
  const maxIso = carteiraSerie.length > 0 ? trimIsoCentral(carteiraSerie[carteiraSerie.length - 1].trim) : "";

  return (
    <ChartCard
      title={titulo}
      subtitle="Carteira assinada é o proxy de vínculo formal (proteção, FGTS, previdência). O painel separa o crescimento formal do informal; o share de conta própria completa a leitura de qualidade."
      toolbar={<AzPeriodSelector value={period} onChange={setPeriod} min={minIso} max={maxIso} periods={["1y", "5y", "max"]} />}
      footer="Painel de cima: SIDRA 4097 — empregados no setor privado, exclusive trabalhadores domésticos, em MIL pessoas. Painel de baixo: share de conta própria na ocupação total (SIDRA 4096, % dos ocupados) — quando sobe, a ocupação nova tende a ser por conta própria, não assalariada. Unidades diferentes (mil × %) ficam em painéis separados de propósito. Faixas cinzas: recessões CODACE/FGV."
      stampGiro={geradoEm}
      stampDado={carteiraSerie.length > 0 ? trimIsoCentral(carteiraSerie[carteiraSerie.length - 1].trim) : null}
    >
      {comPoints.length === 0 && semPoints.length === 0 ? (
        <p className="flex h-60 items-center justify-center text-sm text-zinc-400">
          O pipeline ainda não publicou a abertura com/sem carteira (schema v2). Rode o workflow emprego-pipeline.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
            Ocupados no setor privado (mil pessoas)
          </p>
          <AzTimeSeriesChart
            series={[
              { id: "com", label: "Com carteira", color: AZ_BRAND.azure, data: comPoints },
              { id: "sem", label: "Sem carteira", color: AZ_BRAND.navy, data: semPoints },
            ]}
            unit="none"
            yAxisLabel="mil pessoas"
            period={period}
            height={230}
            xRefAreas={faixas}
            dots={2}
          />

          {contaPoints.length > 0 ? (
            <>
              <p className="mt-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                Conta própria (% dos ocupados)
              </p>
              <AzTimeSeriesChart
                series={[{ id: "conta", label: "Conta própria", color: AZ_BRAND.rust, data: contaPoints }]}
                unit="%"
                period={period}
                height={160}
                xRefAreas={faixas}
                showLegend={false}
                dots={2}
              />
            </>
          ) : null}
        </div>
      )}
    </ChartCard>
  );
}
