"use client";

import { useMemo, useState } from "react";

import type { CodaceFaixaAtividade } from "@/lib/painel-atividade";
import type { PnadData } from "@/lib/painel-emprego";
import { ChartCard } from "@/components/painel/core";
import { AzPeriodSelector, type AzPeriodValue } from "@/components/painel/charts/AzPeriodSelector";
import { AzTimeSeriesChart, type AzTimeSeries } from "@/components/painel/charts/AzTimeSeriesChart";
import { AZ_BRAND } from "@/lib/az-chart-theme";
import { fmtNum, fmtPct } from "@/lib/format-br";
import { codaceAreas, num, toPointsTrim, trimIsoCentral } from "@/components/painel/atividade/v2/shared";
import { PNAD_KEYS } from "./shared";

/**
 * Bloco 02 — "quanta força de trabalho sobra?". A desocupação é só a ponta:
 * a taxa COMPOSTA de subutilização soma subocupados por insuficiência de
 * horas e a força de trabalho potencial; a informalidade qualifica a ocupação
 * que existe. Três linhas em escala própria (~5–30%) — sem a participação
 * (~62%) esmagando tudo, o vício do dashboard antigo. A "taxa combinada"
 * (v4114) foi descartada de propósito: redundante com a composta.
 */

export function SubutilizacaoCard({
  data,
  codaceMensal,
  geradoEm,
}: {
  data: PnadData;
  codaceMensal?: CodaceFaixaAtividade[];
  geradoEm: string;
}) {
  const [period, setPeriod] = useState<AzPeriodValue>({ id: "max" });

  const serie = data.taxas.serie;
  const faixas = useMemo(() => codaceAreas(codaceMensal), [codaceMensal]);

  const series = useMemo<AzTimeSeries[]>(() => {
    const defs: { id: string; label: string; color: string; key: string }[] = [
      { id: "desocupacao", label: "Desocupação", color: AZ_BRAND.azure, key: PNAD_KEYS.desocupacao },
      { id: "subutilizacao", label: "Subutilização composta", color: AZ_BRAND.navy, key: PNAD_KEYS.subutilizacao },
      { id: "informalidade", label: "Informalidade", color: AZ_BRAND.rust, key: PNAD_KEYS.informalidade },
    ];
    return defs
      .map((d) => ({ id: d.id, label: d.label, color: d.color, data: toPointsTrim(serie, d.key) }))
      .filter((s) => s.data.length > 0);
  }, [serie]);

  const ult = serie[serie.length - 1];
  const des = num(ult, PNAD_KEYS.desocupacao);
  const sub = num(ult, PNAD_KEYS.subutilizacao);

  const titulo =
    des != null && sub != null && des > 0
      ? `Folga além do desemprego: a subutilização de ${fmtPct(sub, 1)} é ${fmtNum(sub / des, 1)}× a desocupação de ${fmtPct(des, 1)}`
      : "Desocupação, subutilização e informalidade";

  const minIso = serie.length > 0 ? trimIsoCentral(serie[0].trim) : "";
  const maxIso = serie.length > 0 ? trimIsoCentral(serie[serie.length - 1].trim) : "";

  return (
    <ChartCard
      title={titulo}
      subtitle="A desocupação subestima a folga do mercado de trabalho: a subutilização composta soma quem trabalha menos horas do que gostaria e quem está disponível mas não procurou; a informalidade mede a qualidade da ocupação existente."
      toolbar={<AzPeriodSelector value={period} onChange={setPeriod} min={minIso} max={maxIso} periods={["1y", "5y", "max"]} />}
      footer="SIDRA 4099 (desocupação), 6461 (subutilização composta: desocupados + subocupados por horas + força de trabalho potencial, % da força de trabalho ampliada) e 8529 (informalidade, % dos ocupados — a série só existe desde o 4T2015, por isso a linha começa depois). A 'taxa combinada' foi omitida: redundante com a composta. Faixas cinzas: recessões CODACE/FGV."
      stampGiro={geradoEm}
      stampDado={serie.length > 0 ? trimIsoCentral(serie[serie.length - 1].trim) : null}
    >
      <AzTimeSeriesChart series={series} unit="%" period={period} height={320} xRefAreas={faixas} dots={2} />
    </ChartCard>
  );
}
