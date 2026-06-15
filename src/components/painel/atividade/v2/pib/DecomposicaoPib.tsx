"use client";

import { useMemo, useState } from "react";

import type { AtividadeCodaceData, AtividadePibData } from "@/lib/painel-atividade";
import { ChartCard, AzSegmented } from "@/components/painel/core";
import { AzPeriodSelector, type AzPeriodValue } from "@/components/painel/charts/AzPeriodSelector";
import { AzTimeSeriesChart, type AzSeriesPoint, type AzTimeSeries } from "@/components/painel/charts/AzTimeSeriesChart";
import { codaceAreas, num, trimIsoCentral } from "../shared";

/**
 * Decomposição do PIB — onde está o crescimento, por SETOR (ótica da oferta) e
 * por COMPONENTE (ótica da demanda). Um único frame com dois toggles ("abas"):
 *   - Oferta / Demanda  → qual conjunto de séries;
 *   - Nível / Momentum  → índice de volume SA rebase média 2019 = 100 (recuperou
 *     o pré-pandemia?) ou variação interanual (YoY, ritmo).
 * Tudo de `indice_volume` (já no JSON): `sa_*` para nível, `ns_*` para o YoY (a
 * sazonalidade cancela na comparação interanual — convenção oficial).
 */

const OFERTA: { key: string; label: string }[] = [
  { key: "agro", label: "Agropecuária" },
  { key: "industria", label: "Indústria" },
  { key: "servicos", label: "Serviços" },
];
const DEMANDA: { key: string; label: string }[] = [
  { key: "consumo_familias", label: "Consumo famílias" },
  { key: "consumo_governo", label: "Consumo governo" },
  { key: "fbcf", label: "FBCF (investimento)" },
  { key: "exportacoes", label: "Exportações" },
  { key: "importacoes", label: "Importações" },
];

/** Rebase de uma série de pontos para média de 2019 = 100 (pré-pandemia, ano cheio). */
function rebaseMedia2019(pontos: ReadonlyArray<AzSeriesPoint>): AzSeriesPoint[] {
  const ano2019 = pontos.filter(([d]) => d >= "2019-01-01" && d <= "2019-12-31").map(([, v]) => v);
  if (ano2019.length === 0) return [];
  const base = ano2019.reduce((a, b) => a + b, 0) / ano2019.length;
  if (base <= 0) return [];
  return pontos.map(([d, v]) => [d, +((100 * v) / base).toFixed(3)] as const);
}

/** YoY % de uma série trimestral ordenada (idx_t / idx_{t-4} − 1). */
function yoyTrimestral(pontos: ReadonlyArray<AzSeriesPoint>): AzSeriesPoint[] {
  const out: AzSeriesPoint[] = [];
  for (let i = 4; i < pontos.length; i++) {
    const prev = pontos[i - 4][1];
    const cur = pontos[i][1];
    if (prev > 0) out.push([pontos[i][0], +((cur / prev - 1) * 100).toFixed(2)]);
  }
  return out;
}

export function DecomposicaoPib({
  pib,
  codace,
  geradoEm,
}: {
  pib: AtividadePibData;
  codace?: AtividadeCodaceData | null;
  geradoEm: string;
}) {
  const [otica, setOtica] = useState<"oferta" | "demanda">("oferta");
  const [modo, setModo] = useState<"nivel" | "momentum">("nivel");
  const [period, setPeriod] = useState<AzPeriodValue>({ id: "5y" });

  const comps = otica === "oferta" ? OFERTA : DEMANDA;

  const series = useMemo<AzTimeSeries[]>(() => {
    const prefixo = modo === "nivel" ? "sa_" : "ns_";
    return comps.map((c) => {
      const raw: AzSeriesPoint[] = [];
      for (const r of pib.indice_volume.serie) {
        const v = num(r, prefixo + c.key);
        if (v != null) raw.push([trimIsoCentral(r.trim), v]);
      }
      const data = modo === "nivel" ? rebaseMedia2019(raw) : yoyTrimestral(raw);
      return { id: c.key, label: c.label, data };
    });
  }, [comps, modo, pib.indice_volume.serie]);

  const faixas = useMemo(() => codaceAreas(codace?.trimestral), [codace]);

  const { minIso, maxIso } = useMemo(() => {
    let lo = "";
    let hi = "";
    for (const s of series) {
      for (const [d] of s.data) {
        if (!lo || d < lo) lo = d;
        if (!hi || d > hi) hi = d;
      }
    }
    return { minIso: lo, maxIso: hi };
  }, [series]);

  const ultTrim = pib.indice_volume.serie[pib.indice_volume.serie.length - 1];

  return (
    <ChartCard
      title={
        otica === "oferta"
          ? "Quais setores sustentam a oferta da economia?"
          : "Quais componentes da demanda puxam o PIB?"
      }
      subtitle={
        modo === "nivel"
          ? "Índice de volume com ajuste sazonal, rebasado para média de 2019 = 100 — quem já recuperou (e superou) o pré-pandemia."
          : "Variação interanual (YoY) do volume — o ritmo de cada peça da economia. Importações entram como demanda interna por bens de fora (alta = mais vazamento)."
      }
      toolbar={
        <div className="flex flex-wrap items-center gap-2">
          <AzSegmented
            ariaLabel="Ótica"
            options={[
              { id: "oferta", label: "Oferta" },
              { id: "demanda", label: "Demanda" },
            ]}
            value={otica}
            onChange={(id) => setOtica(id === "demanda" ? "demanda" : "oferta")}
          />
          <AzSegmented
            ariaLabel="Transformação"
            options={[
              { id: "nivel", label: "Nível" },
              { id: "momentum", label: "Momentum" },
            ]}
            value={modo}
            onChange={(id) => setModo(id === "momentum" ? "momentum" : "nivel")}
          />
          <AzPeriodSelector value={period} onChange={setPeriod} min={minIso} max={maxIso} periods={["1y", "5y", "max"]} />
        </div>
      }
      footer="Fonte: IBGE/SIDRA — Contas Nacionais Trimestrais, índice de volume (1621, com ajuste sazonal para o nível; sem ajuste para o YoY). Recortes da oferta (setores de atividade) e da demanda (componentes). Faixas cinzas = recessões CODACE."
      stampGiro={geradoEm}
      stampDado={ultTrim ? trimIsoCentral(String(ultTrim.trim)) : null}
    >
      <AzTimeSeriesChart
        series={series}
        unit={modo === "nivel" ? "index" : "%"}
        period={period}
        height={320}
        xRefAreas={faixas}
        refLines={modo === "nivel" ? [{ y: 100, label: "média 2019", color: "#94A3B8" }] : []}
      />
    </ChartCard>
  );
}
