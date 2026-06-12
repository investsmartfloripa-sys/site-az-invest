"use client";

import { useMemo, useState } from "react";

import type { CodaceFaixaAtividade } from "@/lib/painel-atividade";
import type { PnadData } from "@/lib/painel-emprego";
import { ChartCard } from "@/components/painel/core";
import { AzPeriodSelector, type AzPeriodValue } from "@/components/painel/charts/AzPeriodSelector";
import { AzTimeSeriesChart, type AzRefLine, type AzTimeSeries } from "@/components/painel/charts/AzTimeSeriesChart";
import { AZ_BRAND, AZ_CHART } from "@/lib/az-chart-theme";
import { fmtPct } from "@/lib/format-br";
import { codaceAreas, fmtTrimCurto, num, toPointsTrim, trimIsoCentral } from "@/components/painel/atividade/v2/shared";
import { PNAD_KEYS, mediana } from "./shared";

/**
 * ÂNCORA do painel PNAD v2 — "o desemprego está alto ou baixo para o padrão
 * brasileiro?". Linha principal: desocupação DESSAZONALIZADA (estimativa
 * própria, STL robusta — não há SA oficial); a observada entra fina e
 * tracejada em cinza (T1 é sazonalmente mais alto — comparar trimestres
 * vizinhos na observada engana). Mínima e máxima da série anotadas como
 * réguas; recessões CODACE sombreadas. Título afirmativo VERIFICADO contra
 * o dado: "mínima/máxima da série" só quando for de fato.
 */

const CINZA_OBSERVADA = "#94A3B8";

type Extremo = { v: number; trim: string } | null;

function extremos(serie: ReadonlyArray<Record<string, unknown> & { trim: string }>, key: string): { min: Extremo; max: Extremo } {
  let min: Extremo = null;
  let max: Extremo = null;
  for (const r of serie) {
    const v = num(r, key);
    if (v == null) continue;
    if (min == null || v < min.v) min = { v, trim: r.trim };
    if (max == null || v > max.v) max = { v, trim: r.trim };
  }
  return { min, max };
}

export function DesocupacaoHistoricaCard({
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
  const saPoints = useMemo(() => toPointsTrim(serie, PNAD_KEYS.desocupacaoSa), [serie]);
  const obsPoints = useMemo(() => toPointsTrim(serie, PNAD_KEYS.desocupacao), [serie]);
  const faixas = useMemo(() => codaceAreas(codaceMensal), [codaceMensal]);

  const temSa = saPoints.length > 0;
  const ult = serie.length > 0 ? serie[serie.length - 1] : undefined;
  const ultTrim = ult?.trim ?? "";

  const derivados = useMemo(() => {
    const exSa = extremos(serie, PNAD_KEYS.desocupacaoSa);
    const exObs = extremos(serie, PNAD_KEYS.desocupacao);
    const obsVals = serie.map((r) => num(r, PNAD_KEYS.desocupacao)).filter((v): v is number => v != null);
    return {
      exSa,
      exObs,
      medObs: mediana(obsVals),
      lastSa: num(ult, PNAD_KEYS.desocupacaoSa),
      lastObs: num(ult, PNAD_KEYS.desocupacao),
    };
  }, [serie, ult]);

  // Título afirmativo derivado — "mínima/máxima da série" só quando VERIFICADO.
  const titulo = useMemo(() => {
    const { exSa, exObs, medObs, lastSa, lastObs } = derivados;
    const eps = 1e-9;
    if (lastSa != null && exSa.min != null && lastSa <= exSa.min.v + eps) {
      return `Desocupação dessazonalizada de ${fmtPct(lastSa, 1)} é a mínima da série iniciada em 2012`;
    }
    if (lastSa != null && exSa.max != null && lastSa >= exSa.max.v - eps) {
      return `Desocupação dessazonalizada de ${fmtPct(lastSa, 1)} é a máxima da série iniciada em 2012`;
    }
    if (lastObs != null && exObs.min != null && lastObs <= exObs.min.v + eps) {
      return `Desocupação de ${fmtPct(lastObs, 1)} é a mínima da série iniciada em 2012`;
    }
    if (lastObs != null && exObs.max != null && lastObs >= exObs.max.v - eps) {
      return `Desocupação de ${fmtPct(lastObs, 1)} é a máxima da série iniciada em 2012`;
    }
    if (lastObs != null && medObs != null) {
      return `Desocupação de ${fmtPct(lastObs, 1)} no ${fmtTrimCurto(ultTrim)} — ${
        lastObs < medObs ? "abaixo" : "acima"
      } da mediana da série desde 2012 (${fmtPct(medObs, 1)})`;
    }
    return "Taxa de desocupação — série histórica desde 2012";
  }, [derivados, ultTrim]);

  // Réguas de mínima e máxima da série (preferência pela dessazonalizada).
  const refLines = useMemo<AzRefLine[]>(() => {
    const ex = temSa ? derivados.exSa : derivados.exObs;
    const out: AzRefLine[] = [];
    if (ex.min != null) {
      out.push({
        y: ex.min.v,
        label: `mín ${fmtPct(ex.min.v, 1)} (${fmtTrimCurto(ex.min.trim)})`,
        color: AZ_CHART.ticks,
      });
    }
    if (ex.max != null) {
      out.push({
        y: ex.max.v,
        label: `máx ${fmtPct(ex.max.v, 1)} (${fmtTrimCurto(ex.max.trim)})`,
        color: AZ_CHART.ticks,
      });
    }
    return out;
  }, [temSa, derivados]);

  const series = useMemo<AzTimeSeries[]>(() => {
    if (temSa) {
      return [
        { id: "sa", label: "Dessazonalizada (estimativa própria)", color: AZ_BRAND.azure, data: saPoints },
      ];
    }
    return [{ id: "obs", label: "Taxa observada", color: AZ_BRAND.azure, data: obsPoints }];
  }, [temSa, saPoints, obsPoints]);

  const benchmarks = useMemo<AzTimeSeries[]>(
    () => (temSa ? [{ id: "obs", label: "Observada", color: CINZA_OBSERVADA, data: obsPoints }] : []),
    [temSa, obsPoints],
  );

  const minIso = serie.length > 0 ? trimIsoCentral(serie[0].trim) : "";
  const maxIso = serie.length > 0 ? trimIsoCentral(serie[serie.length - 1].trim) : "";

  return (
    <ChartCard
      title={titulo}
      subtitle="A pergunta de partida do painel: o desemprego está alto ou baixo para o padrão brasileiro? Linha azul: taxa livre de sazonalidade (estimativa própria); tracejada cinza: taxa observada, como o IBGE divulga."
      toolbar={<AzPeriodSelector value={period} onChange={setPeriod} min={minIso} max={maxIso} periods={["1y", "5y", "max"]} />}
      footer="SIDRA 4099 — taxa de desocupação, trimestre calendário. Dessazonalização própria (STL robusta a 2020): o IBGE não publica SA oficial da PNAD — trate como estimativa da casa. A observada carrega sazonalidade forte (1º trimestre é tipicamente mais alto). Linhas pontilhadas: mínima e máxima históricas da série dessazonalizada. Faixas cinzas: recessões CODACE/FGV."
      stampGiro={geradoEm}
      stampDado={serie.length > 0 ? trimIsoCentral(serie[serie.length - 1].trim) : null}
    >
      <AzTimeSeriesChart
        series={series}
        benchmarks={benchmarks}
        unit="%"
        period={period}
        height={340}
        xRefAreas={faixas}
        refLines={refLines}
        dots={2}
      />
    </ChartCard>
  );
}
