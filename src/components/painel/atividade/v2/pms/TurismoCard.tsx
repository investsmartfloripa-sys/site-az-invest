"use client";

import { useMemo, useState } from "react";

import type { CodaceFaixaAtividade, PmsPonto } from "@/lib/painel-atividade";
import { ChartCard } from "@/components/painel/core";
import { AzPeriodSelector, type AzPeriodValue } from "@/components/painel/charts/AzPeriodSelector";
import { AzTimeSeriesChart } from "@/components/painel/charts/AzTimeSeriesChart";
import { AZ_BRAND } from "@/lib/az-chart-theme";
import { fmtMesCurto, fmtPct, fmtSignedPct } from "@/lib/format-br";
import { codaceAreas, num, rebase100, toPointsMes } from "../shared";

/**
 * Turismo (PMS especial, SIDRA 8694) — a pergunta do bloco é de NÍVEL, não de
 * variação: o setor mais atingido em 2020 voltou ao patamar pré-pandemia?
 * Por isso o gráfico é o nível SA rebasado para fev/2020 = 100 (o colapso de
 * 2020 aparece na própria série) e as YoY de volume/receita viram chips.
 * Default "Máx" deliberado: em janelas curtas a história do colapso some.
 */

function Chip({ label, valor, hint }: { label: string; valor: string; hint?: string }) {
  return (
    <div className="rounded-lg bg-zinc-50 px-3 py-1.5">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">{label}</p>
      <p className="text-sm font-bold tabular-nums text-[#132960]">{valor}</p>
      {hint ? <p className="text-[10px] text-zinc-400">{hint}</p> : null}
    </div>
  );
}

export function TurismoCard({
  serie,
  codaceMensal,
  geradoEm,
}: {
  serie: PmsPonto[];
  codaceMensal?: CodaceFaixaAtividade[];
  geradoEm: string;
}) {
  const [period, setPeriod] = useState<AzPeriodValue>({ id: "max" });

  const nivelPts = useMemo(() => rebase100(toPointsMes(serie, "volume_indice_sa")), [serie]);
  const faixas = useMemo(() => codaceAreas(codaceMensal), [codaceMensal]);

  const ult = serie[serie.length - 1];
  const yoyVolume = num(ult, "volume_var_yoy");
  const yoyReceita = num(ult, "receita_var_yoy");

  const minIso = nivelPts.length > 0 ? nivelPts[0][0] : "";
  const maxIso = nivelPts.length > 0 ? nivelPts[nivelPts.length - 1][0] : "";
  const gap = nivelPts.length > 0 ? +(nivelPts[nivelPts.length - 1][1] - 100).toFixed(1) : null;

  const titulo =
    gap != null
      ? gap >= 0
        ? `Turismo opera ${fmtPct(gap, 1)} acima de fev/2020 — a recuperação se completou`
        : `Turismo ainda opera ${fmtPct(Math.abs(gap), 1)} abaixo de fev/2020 — a recuperação não se completou`
      : "Turismo — nível vs pré-pandemia";

  return (
    <ChartCard
      title={titulo}
      subtitle="O setor-símbolo do choque de 2020 voltou ao patamar? Nível de volume com ajuste sazonal, rebasado para fev/2020 = 100 — o colapso e a retomada aparecem na própria série."
      toolbar={<AzPeriodSelector value={period} onChange={setPeriod} min={minIso} max={maxIso} periods={["1y", "5y", "max"]} />}
      footer="SIDRA 8694 (atividades turísticas — volume com ajuste sazonal, base 2022 = 100; rebase fev/2020 = 100 no site). As variações interanuais de volume e receita ficam nos chips e no tooltip em vez de um gráfico próprio: a pergunta do turismo é de NÍVEL. Faixas cinzas: recessões CODACE/FGV."
      stampGiro={geradoEm}
      stampDado={maxIso || null}
    >
      <div className="mb-3 flex flex-wrap gap-2">
        <Chip
          label={`Volume ${ult ? fmtMesCurto(ult.mes) : ""} (YoY)`}
          valor={fmtSignedPct(yoyVolume, 1)}
          hint="vs mesmo mês do ano anterior"
        />
        <Chip label="Receita nominal (YoY)" valor={fmtSignedPct(yoyReceita, 1)} hint="sem deflação — embute preços" />
      </div>
      <AzTimeSeriesChart
        series={[{ id: "turismo", label: "Turismo — volume (SA)", color: AZ_BRAND.azure, data: nivelPts }]}
        unit="index"
        period={period}
        height={300}
        xRefAreas={faixas}
        refLines={[{ y: 100, label: "fev/2020", color: "#94A3B8" }]}
        showLegend={false}
      />
    </ChartCard>
  );
}
