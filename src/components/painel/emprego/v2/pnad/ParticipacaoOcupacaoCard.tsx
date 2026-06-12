"use client";

import { useMemo, useState } from "react";

import type { CodaceFaixaAtividade } from "@/lib/painel-atividade";
import type { PnadData } from "@/lib/painel-emprego";
import { ChartCard } from "@/components/painel/core";
import { AzPeriodSelector, type AzPeriodValue } from "@/components/painel/charts/AzPeriodSelector";
import { AzTimeSeriesChart, type AzRefLine, type AzTimeSeries } from "@/components/painel/charts/AzTimeSeriesChart";
import { AZ_BRAND } from "@/lib/az-chart-theme";
import { fmtNum, fmtPct } from "@/lib/format-br";
import { codaceAreas, num, toPointsTrim, trimIsoCentral } from "@/components/painel/atividade/v2/shared";
import { PNAD_KEYS, TRIM_PRE_PANDEMIA, findTrim, trimAnoAnterior } from "./shared";

/**
 * Bloco 01 — "o desemprego caiu pelo motivo certo?". Participação e nível da
 * ocupação na MESMA unidade (% da PIA): a desocupação só cai "de verdade"
 * quando a ocupação sobe com participação estável; se a participação despenca,
 * a queda é desalento (gente desistindo de procurar). Réguas tracejadas nos
 * níveis do 4T2019 mostram o quanto falta (ou sobra) vs o pré-pandemia.
 */

export function ParticipacaoOcupacaoCard({
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
  const partPoints = useMemo(() => toPointsTrim(serie, PNAD_KEYS.participacao), [serie]);
  const ocupPoints = useMemo(() => toPointsTrim(serie, PNAD_KEYS.nivelOcupacao), [serie]);
  const faixas = useMemo(() => codaceAreas(codaceMensal), [codaceMensal]);
  const temOcupacao = ocupPoints.length > 0;

  const ult = serie.length > 0 ? serie[serie.length - 1] : undefined;
  const prev = ult ? findTrim(serie, trimAnoAnterior(ult.trim)) : undefined;
  const pre = findTrim(serie, TRIM_PRE_PANDEMIA);

  const part = num(ult, PNAD_KEYS.participacao);
  const ocup = num(ult, PNAD_KEYS.nivelOcupacao);
  const partPrev = num(prev, PNAD_KEYS.participacao);
  const ocupPrev = num(prev, PNAD_KEYS.nivelOcupacao);
  const dPart = part != null && partPrev != null ? +(part - partPrev).toFixed(2) : null;
  const dOcup = ocup != null && ocupPrev != null ? +(ocup - ocupPrev).toFixed(2) : null;
  const part19 = num(pre, PNAD_KEYS.participacao);
  const ocup19 = num(pre, PNAD_KEYS.nivelOcupacao);

  // Título afirmativo por regra, derivado dos deltas YoY (banda ±0,1 p.p. = "estável").
  const titulo = useMemo(() => {
    if (ocup != null && dOcup != null && dPart != null) {
      if (dPart < -0.1 && dOcup <= 0.1) {
        return "Participação em queda e ocupação parada — a melhora do desemprego tem cheiro de desalento";
      }
      if (dOcup > 0.1 && dPart < -0.1) {
        return `Ocupação em ${fmtPct(ocup, 1)} da PIA sobe, mas a participação recua — a queda do desemprego é só em parte genuína`;
      }
      if (dOcup > 0.1) {
        return `Ocupação em ${fmtPct(ocup, 1)} da PIA sobe com participação ${dPart > 0.1 ? "também em alta" : "estável"} — melhora genuína`;
      }
      if (dOcup < -0.1) {
        return `Nível da ocupação recua a ${fmtPct(ocup, 1)} da PIA em um ano`;
      }
      return "Participação e ocupação andam de lado — o mercado de trabalho está em equilíbrio";
    }
    if (part != null && part19 != null) {
      const gap = +(part - part19).toFixed(1);
      if (gap <= -0.1) return `Participação de ${fmtPct(part, 1)} ainda está ${fmtNum(Math.abs(gap), 1)} p.p. abaixo do pré-pandemia`;
      if (gap >= 0.1) return `Participação de ${fmtPct(part, 1)} já supera o pré-pandemia em ${fmtNum(gap, 1)} p.p.`;
      return `Participação de ${fmtPct(part, 1)} voltou ao nível pré-pandemia`;
    }
    return "Participação × nível da ocupação — % da PIA";
  }, [ocup, dOcup, dPart, part, part19]);

  const series = useMemo<AzTimeSeries[]>(() => {
    const out: AzTimeSeries[] = [
      { id: "part", label: "Taxa de participação", color: AZ_BRAND.azure, data: partPoints },
    ];
    if (temOcupacao) out.push({ id: "ocup", label: "Nível da ocupação", color: AZ_BRAND.navy, data: ocupPoints });
    return out;
  }, [partPoints, ocupPoints, temOcupacao]);

  // Réguas pré-pandemia (derivadas do dado do 4T2019, nunca hardcoded).
  const refLines = useMemo<AzRefLine[]>(() => {
    const out: AzRefLine[] = [];
    if (part19 != null) out.push({ y: part19, label: "participação 4T19", color: AZ_BRAND.azure });
    if (temOcupacao && ocup19 != null) out.push({ y: ocup19, label: "ocupação 4T19", color: AZ_BRAND.navy });
    return out;
  }, [part19, ocup19, temOcupacao]);

  const minIso = serie.length > 0 ? trimIsoCentral(serie[0].trim) : "";
  const maxIso = serie.length > 0 ? trimIsoCentral(serie[serie.length - 1].trim) : "";

  return (
    <ChartCard
      title={titulo}
      subtitle="As duas séries na mesma unidade (% da população em idade de trabalhar): quem procura trabalho e quem de fato trabalha. É o teste de qualidade de qualquer queda da desocupação."
      toolbar={<AzPeriodSelector value={period} onChange={setPeriod} min={minIso} max={maxIso} periods={["1y", "5y", "max"]} />}
      footer={
        <>
          Como ler: ocupação subindo com participação estável = queda genuína do desemprego (mais gente trabalhando);
          participação despencando = desalento — o desemprego cai porque as pessoas desistem de procurar, não porque há mais
          vagas. Réguas tracejadas: níveis do 4T2019 (pré-pandemia). SIDRA 4099/6461 — ambas em % da PIA.
          {!temOcupacao
            ? " O 'Nível da ocupação' entra no gráfico quando o pipeline publicar a próxima carga (schema v2 completo)."
            : null}
        </>
      }
      stampGiro={geradoEm}
      stampDado={serie.length > 0 ? trimIsoCentral(serie[serie.length - 1].trim) : null}
    >
      <AzTimeSeriesChart
        series={series}
        unit="%"
        period={period}
        height={300}
        xRefAreas={faixas}
        refLines={refLines}
        dots={2}
      />
    </ChartCard>
  );
}
