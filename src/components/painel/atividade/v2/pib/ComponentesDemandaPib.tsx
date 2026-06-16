"use client";

import { useMemo, useState } from "react";

import type { AtividadeCodaceData, AtividadePibData } from "@/lib/painel-atividade";
import { LABELS_PIB_FALLBACK } from "@/lib/painel-atividade";
import { ChartCard } from "@/components/painel/core";
import { AzPeriodSelector, type AzPeriodValue } from "@/components/painel/charts/AzPeriodSelector";
import { AzTimeSeriesChart, type AzSeriesPoint, type AzTimeSeries } from "@/components/painel/charts/AzTimeSeriesChart";
import { AZ_BRAND } from "@/lib/az-chart-theme";
import { codaceAreas, num, trimIsoCentral } from "../shared";

/**
 * "A corrida dos componentes da despesa" — a ótica da DEMANDA do PIB numa única
 * linha do tempo. Cada um dos cinco componentes da despesa (consumo das famílias,
 * consumo do governo, FBCF/investimento, exportações e importações) sai do índice
 * de volume com ajuste sazonal (`indice_volume` → `sa_<r>`), todos REBASADOS para
 * a média de 2019 = 100 — assim a comparação é de TRAJETÓRIA (quanto cada peça
 * cresceu desde o pré-pandemia, ano cheio "normal"), não de magnitude do índice
 * base-1995. O PIB entra como benchmark tracejado para enxergar quem corre acima
 * e quem corre abaixo da economia como um todo.
 *
 * Tudo NÍVEL (mesma transformação para todas as séries) → faixas de recessão
 * CODACE entram como xRefAreas, no padrão da área.
 *
 * Leitura das importações: como volume, é demanda interna por bens de fora — alta
 * = mais "vazamento" da renda doméstica para o exterior (na contribuição ao PIB
 * entra com sinal trocado, mas aqui é só o nível do volume importado).
 */

/** Os cinco componentes principais da despesa, na ordem de leitura econômica. */
const COMPONENTES: { key: string; label: string }[] = [
  { key: "consumo_familias", label: "Consumo famílias" },
  { key: "consumo_governo", label: "Consumo governo" },
  { key: "fbcf", label: "FBCF (investimento)" },
  { key: "exportacoes", label: "Exportações" },
  { key: "importacoes", label: "Importações" },
];

/** Rebase de uma série de pontos para a média de 2019 = 100 (pré-pandemia, ano cheio). */
function rebaseMedia2019(pontos: ReadonlyArray<AzSeriesPoint>): AzSeriesPoint[] {
  const ano2019 = pontos.filter(([d]) => d >= "2019-01-01" && d <= "2019-12-31").map(([, v]) => v);
  if (ano2019.length === 0) return [];
  const base = ano2019.reduce((a, b) => a + b, 0) / ano2019.length;
  if (base <= 0) return [];
  return pontos.map(([d, v]) => [d, +((100 * v) / base).toFixed(3)] as const);
}

export function ComponentesDemandaPib({
  pib,
  codace,
  geradoEm,
}: {
  pib: AtividadePibData;
  codace?: AtividadeCodaceData | null;
  geradoEm: string;
}) {
  const [period, setPeriod] = useState<AzPeriodValue>({ id: "5y" });

  const rotulo = (key: string): string => pib.labels?.[key] ?? LABELS_PIB_FALLBACK[key] ?? key;

  const series = useMemo<AzTimeSeries[]>(() => {
    return COMPONENTES.map((c) => {
      const raw: AzSeriesPoint[] = [];
      for (const r of pib.indice_volume.serie) {
        const v = num(r, "sa_" + c.key);
        if (v != null) raw.push([trimIsoCentral(String(r.trim)), v]);
      }
      return { id: c.key, label: rotulo(c.key), data: rebaseMedia2019(raw) };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pib.indice_volume.serie, pib.labels]);

  // PIB como benchmark tracejado (linha de comparação, mesma base 2019 = 100).
  const benchmarks = useMemo<AzTimeSeries[]>(() => {
    const raw: AzSeriesPoint[] = [];
    for (const r of pib.indice_volume.serie) {
      const v = num(r, "sa_pib");
      if (v != null) raw.push([trimIsoCentral(String(r.trim)), v]);
    }
    const data = rebaseMedia2019(raw);
    if (data.length === 0) return [];
    return [{ id: "pib", label: rotulo("pib"), color: AZ_BRAND.navy, data }];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pib.indice_volume.serie, pib.labels]);

  const faixas = useMemo(() => codaceAreas(codace?.trimestral), [codace]);

  const { minIso, maxIso } = useMemo(() => {
    let lo = "";
    let hi = "";
    for (const s of [...series, ...benchmarks]) {
      for (const [d] of s.data) {
        if (!lo || d < lo) lo = d;
        if (!hi || d > hi) hi = d;
      }
    }
    return { minIso: lo, maxIso: hi };
  }, [series, benchmarks]);

  return (
    <ChartCard
      title="A corrida dos componentes da despesa"
      subtitle="Índice de volume com ajuste sazonal de cada peça da demanda, rebasado para a média de 2019 = 100 — a trajetória de cada componente desde o pré-pandemia, com o PIB (tracejado) como régua. Importações como volume = demanda interna por bens de fora (alta = mais vazamento)."
      toolbar={<AzPeriodSelector value={period} onChange={setPeriod} min={minIso} max={maxIso} periods={["1y", "5y", "max"]} />}
      footer="Fonte: IBGE/SIDRA — Contas Nacionais Trimestrais, índice de volume dessazonalizado (1621), ótica da despesa. Rebase: média de 2019 = 100. Faixas cinzas = recessões CODACE/FGV-IBRE."
      stampGiro={geradoEm}
      stampDado={pib.trim_recente ? trimIsoCentral(pib.trim_recente) : null}
    >
      <AzTimeSeriesChart
        series={series}
        benchmarks={benchmarks}
        unit="index"
        period={period}
        height={340}
        xRefAreas={faixas}
        refLines={[{ y: 100, label: "média 2019", color: "#94A3B8" }]}
      />
    </ChartCard>
  );
}
