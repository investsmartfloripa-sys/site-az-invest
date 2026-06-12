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
 * Extrativa × Transformação — a divisão mais importante da PIM: a extrativa
 * conta a história da OFERTA (cronograma de plataformas de petróleo e minas —
 * quase indiferente a juros); a transformação é o termômetro da DEMANDA
 * doméstica. Mesmo toggle nível/momentum do bloco de categorias.
 */

type Modo = "nivel" | "momentum";

const SECOES = [
  { id: "industria_geral", label: "Indústria geral" },
  { id: "extrativa", label: "Extrativa" },
  { id: "transformacao", label: "Transformação" },
] as const;

export function SecoesCard({
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

  const serie = pim.secoes.serie;
  const faixas = useMemo(() => codaceAreas(codaceMensal), [codaceMensal]);

  const series = useMemo<AzTimeSeries[]>(
    () =>
      SECOES.map((s, i) => ({
        id: s.id,
        label: s.label,
        color: AZ_SERIES[i],
        data:
          modo === "nivel"
            ? rebase100(toPointsMes(serie, `${s.id}_indice_sa`))
            : mmPoints(toPointsMes(serie, `${s.id}_var_yoy`), 3),
      })),
    [serie, modo],
  );

  // Título afirmativo: qual seção lidera o ritmo interanual suavizado.
  const { extrativa, transformacao } = useMemo(() => {
    const ultMm3 = (key: string): number | null => {
      const pts = mmPoints(toPointsMes(serie, key), 3);
      return pts.length > 0 ? pts[pts.length - 1][1] : null;
    };
    return { extrativa: ultMm3("extrativa_var_yoy"), transformacao: ultMm3("transformacao_var_yoy") };
  }, [serie]);

  const titulo =
    extrativa != null && transformacao != null
      ? `Extrativa ${extrativa >= 0 ? "cresce" : "cai"} ${fmtPct(Math.abs(extrativa), 1)} e transformação ${
          transformacao >= 0 ? "cresce" : "cai"
        } ${fmtPct(Math.abs(transformacao), 1)} em 12 meses — ${
          extrativa >= transformacao ? "a oferta de commodities lidera" : "a demanda doméstica lidera"
        }`
      : "Extrativa × Transformação";

  const refLines = useMemo<AzRefLine[]>(
    () => (modo === "nivel" ? [{ y: 100, label: "fev/2020", color: "#94A3B8" }] : []),
    [modo],
  );

  const minIso = serie.length > 0 ? mesIso(serie[0].mes) : "";
  const maxIso = serie.length > 0 ? mesIso(serie[serie.length - 1].mes) : "";

  return (
    <ChartCard
      title={titulo}
      subtitle="O motor é a plataforma de petróleo ou a fábrica? As duas seções contam histórias diferentes da mesma indústria — e respondem a choques diferentes."
      toolbar={
        <>
          <AzSegmented
            ariaLabel="Nível ou momentum das seções"
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
      footer="Leitura estrutural: a extrativa segue o cronograma de plataformas e minas (choque de OFERTA — petróleo e minério, pouco sensível ao ciclo doméstico); a transformação é o termômetro da demanda doméstica e dos juros. Seções da PIM-PF (SIDRA 8888). Nível: índice SA rebasado fev/2020 = 100; momentum: YoY mm3. Faixas cinzas: recessões CODACE/FGV."
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
