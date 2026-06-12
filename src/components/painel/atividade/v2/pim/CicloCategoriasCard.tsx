"use client";

import { useMemo, useState } from "react";

import type { AtividadePimData, CodaceFaixaAtividade } from "@/lib/painel-atividade";
import { AzSegmented, ChartCard } from "@/components/painel/core";
import { AzPeriodSelector, type AzPeriodValue } from "@/components/painel/charts/AzPeriodSelector";
import { AzTimeSeriesChart, type AzRefLine, type AzTimeSeries } from "@/components/painel/charts/AzTimeSeriesChart";
import { AZ_SERIES } from "@/lib/az-chart-theme";
import { fmtPct } from "@/lib/format-br";
import { codaceAreas, mesIso, mmPoints, rebase100, toPointsMes } from "../shared";

/**
 * Ciclo por categoria de uso — a leitura CÍCLICA canônica da PIM: bens de
 * capital lideram (investimento), duráveis respondem ao crédito,
 * semi/não duráveis seguem a massa de renda. Toggle nível (fev/2020 = 100,
 * default — compara TRAJETÓRIAS) / momentum (YoY mm3 — compara RITMOS);
 * nunca os dois no mesmo eixo.
 */

type Modo = "nivel" | "momentum";

const CATEGORIAS = [
  { id: "bens_capital", label: "Bens de capital" },
  { id: "bens_intermediarios", label: "Intermediários" },
  { id: "bens_consumo_duraveis", label: "Duráveis" },
  { id: "bens_consumo_semi_nao_duraveis", label: "Semi e não duráveis" },
] as const;

export function CicloCategoriasCard({
  pim,
  codaceMensal,
  geradoEm,
}: {
  pim: AtividadePimData;
  codaceMensal?: CodaceFaixaAtividade[];
  geradoEm: string;
}) {
  const [modo, setModo] = useState<Modo>("nivel");
  const [period, setPeriod] = useState<AzPeriodValue>({ id: "5y" });

  const serie = pim.categorias_economicas.serie;
  const faixas = useMemo(() => codaceAreas(codaceMensal), [codaceMensal]);

  const series = useMemo<AzTimeSeries[]>(
    () =>
      CATEGORIAS.map((c, i) => ({
        id: c.id,
        label: c.label,
        color: AZ_SERIES[i],
        data:
          modo === "nivel"
            ? rebase100(toPointsMes(serie, `${c.id}_indice_sa`))
            : mmPoints(toPointsMes(serie, `${c.id}_var_yoy`), 3),
      })),
    [serie, modo],
  );

  // Título afirmativo pela categoria que LIDERA o ciclo: bens de capital.
  const capitalMm3 = useMemo(() => mmPoints(toPointsMes(serie, "bens_capital_var_yoy"), 3), [serie]);
  const ultCapital = capitalMm3.length > 0 ? capitalMm3[capitalMm3.length - 1][1] : null;
  const titulo =
    ultCapital != null
      ? `Bens de capital ${ultCapital >= 0 ? "crescem" : "caem"} ${fmtPct(Math.abs(ultCapital), 1)} na tendência interanual — o ciclo de investimento ${
          ultCapital >= 0 ? "avança" : "perde tração"
        }`
      : "Categorias de uso — quem lidera o ciclo industrial";

  const refLines = useMemo<AzRefLine[]>(
    () => (modo === "nivel" ? [{ y: 100, label: "fev/2020", color: "#94A3B8" }] : []),
    [modo],
  );

  const minIso = serie.length > 0 ? mesIso(serie[0].mes) : "";
  const maxIso = serie.length > 0 ? mesIso(serie[serie.length - 1].mes) : "";

  return (
    <ChartCard
      title={titulo}
      subtitle="Quem lidera o ciclo industrial? Bens de capital antecipam o investimento, duráveis respondem ao crédito e aos juros, semi e não duráveis seguem a massa de renda — a ordem em que viram diz em que fase do ciclo estamos."
      toolbar={
        <>
          <AzSegmented
            ariaLabel="Nível ou momentum das categorias de uso"
            options={[
              { id: "nivel", label: "Nível (fev/20=100)" },
              { id: "momentum", label: "Momentum (YoY mm3)" },
            ]}
            value={modo}
            onChange={(id) => setModo(id as Modo)}
          />
          <AzPeriodSelector value={period} onChange={setPeriod} min={minIso} max={maxIso} periods={["1y", "5y", "max"]} />
        </>
      }
      footer="Grandes categorias econômicas da PIM-PF (SIDRA 8887, base 2022 = 100). Nível: índice SA rebasado fev/2020 = 100 (cada série na própria base). Momentum: variação interanual suavizada por média móvel de 3 meses. Faixas cinzas: recessões CODACE/FGV."
      stampGiro={geradoEm}
      stampDado={serie.length > 0 ? mesIso(serie[serie.length - 1].mes) : null}
    >
      <AzTimeSeriesChart
        series={series}
        unit={modo === "nivel" ? "index" : "%"}
        period={period}
        height={320}
        xRefAreas={faixas}
        refLines={refLines}
      />
    </ChartCard>
  );
}
