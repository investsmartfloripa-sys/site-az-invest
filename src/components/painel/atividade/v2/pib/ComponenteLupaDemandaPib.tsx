"use client";

import { useMemo, useState } from "react";

import type { AtividadeCodaceData, AtividadePibData } from "@/lib/painel-atividade";
import { LABELS_PIB_FALLBACK } from "@/lib/painel-atividade";
import { ChartCard, AzSegmented } from "@/components/painel/core";
import { AzPeriodSelector, type AzPeriodValue } from "@/components/painel/charts/AzPeriodSelector";
import { AzTimeSeriesChart, type AzSeriesPoint, type AzUnit } from "@/components/painel/charts/AzTimeSeriesChart";
import { AZ_BRAND } from "@/lib/az-chart-theme";
import { codaceAreas, num, trimIsoCentral } from "../shared";

/**
 * Componente da demanda sob a lupa — espelho do "Setor sob a lupa", mas pela
 * ótica da DEMANDA. Escolha QUAL dos 6 componentes da despesa olhar (consumo das
 * famílias, consumo do governo, FBCF, exportações, importações, variação de
 * estoques) e em QUE lente: o nível (índice de volume SA ou R$ reais a preços de
 * 1995), o ritmo (YoY, acum 4T, QoQ SA) ou o peso na economia (% do PIB nominal).
 * Uma única série temporal por vez, sem sobreposição. Recessões CODACE/FGV-IBRE
 * só sombreiam as lentes de NÍVEL (no momentum e no peso a referência é o próprio
 * zero/eixo, não o ciclo).
 *
 * Leitura das IMPORTAÇÕES: pela identidade da despesa, importação é vazamento —
 * mais importação derruba o PIB. Aqui plotamos o componente em si (alta =
 * importou mais), sem inverter sinal; quem carrega o sinal trocado é a
 * contribuição em p.p., que vive em outro card.
 */

// 6 componentes da demanda (despesa), ordem fixa da SCN.
const COMPONENTES: { key: string; fallback: string }[] = [
  { key: "consumo_familias", fallback: "Consumo das famílias" },
  { key: "consumo_governo", fallback: "Consumo do governo" },
  { key: "fbcf", fallback: "FBCF (investimento)" },
  { key: "exportacoes", fallback: "Exportações" },
  { key: "importacoes", fallback: "Importações" },
  { key: "variacao_estoque", fallback: "Variação de estoques" },
];

type LenteId = "nivel_sa" | "reais_sa" | "yoy" | "acum_4t" | "qoq_sa" | "peso_pib";

/**
 * As 6 transformações. `nivel` => sombreia recessões + unidade index/R$;
 * `serie` aponta qual bloco do JSON usar; `chave(key)` monta o nome do campo
 * (alguns são `sa_<r>`, outros `<r>`, outros `<r>_pct_pib`).
 */
const LENTES: {
  id: LenteId;
  label: string;
  serie: "indice_volume" | "valores_reais_sa" | "variacao" | "estrutura_nominal";
  chave: (key: string) => string;
  unit: AzUnit;
  nivel: boolean;
  fonte: string;
}[] = [
  {
    id: "nivel_sa",
    label: "Nível SA",
    serie: "indice_volume",
    chave: (k) => `sa_${k}`,
    unit: "index",
    nivel: true,
    fonte: "índice de volume dessazonalizado (1621, base 1995 = 100)",
  },
  {
    id: "reais_sa",
    label: "R$ real",
    serie: "valores_reais_sa",
    chave: (k) => k,
    unit: "R$",
    nivel: true,
    fonte: "valores encadeados a preços de 1995, com ajuste sazonal (6613)",
  },
  {
    id: "yoy",
    label: "YoY",
    serie: "variacao",
    chave: (k) => `yoy_${k}`,
    unit: "%",
    nivel: false,
    fonte: "variação real interanual — vs mesmo trimestre do ano anterior (5932)",
  },
  {
    id: "acum_4t",
    label: "Acum 4T",
    serie: "variacao",
    chave: (k) => `acum_4t_${k}`,
    unit: "%",
    nivel: false,
    fonte: "variação real acumulada nos últimos quatro trimestres (5932)",
  },
  {
    id: "qoq_sa",
    label: "QoQ SA",
    serie: "variacao",
    chave: (k) => `qoq_sa_${k}`,
    unit: "%",
    nivel: false,
    fonte: "variação real vs trimestre anterior, com ajuste sazonal (5932)",
  },
  {
    id: "peso_pib",
    label: "Peso %PIB",
    serie: "estrutura_nominal",
    chave: (k) => `${k}_pct_pib`,
    unit: "%",
    nivel: false,
    fonte: "participação no PIB nominal (1846)",
  },
];

export function ComponenteLupaDemandaPib({
  pib,
  codace,
  geradoEm,
}: {
  pib: AtividadePibData;
  codace?: AtividadeCodaceData | null;
  geradoEm: string;
}) {
  const [componente, setComponente] = useState<string>("consumo_familias");
  const [lenteId, setLenteId] = useState<LenteId>("nivel_sa");
  const [period, setPeriod] = useState<AzPeriodValue>({ id: "5y" });

  const lente = LENTES.find((l) => l.id === lenteId) ?? LENTES[0];
  const rotulo = pib.labels?.[componente] ?? LABELS_PIB_FALLBACK[componente] ?? componente;

  // A série temporal única da combinação (componente × lente). Cada bloco do
  // JSON é opcional no tipo (valores_reais_sa / estrutura_nominal) — trata
  // undefined.
  const { data, minIso, maxIso } = useMemo(() => {
    let rows: ReadonlyArray<Record<string, unknown> & { trim: string }> = [];
    if (lente.serie === "indice_volume") rows = pib.indice_volume.serie;
    else if (lente.serie === "variacao") rows = pib.variacao.serie;
    else if (lente.serie === "valores_reais_sa") rows = pib.valores_reais_sa?.serie ?? [];
    else rows = (pib.estrutura_nominal?.serie ?? []) as unknown as ReadonlyArray<Record<string, unknown> & { trim: string }>;

    const campo = lente.chave(componente);
    const data: AzSeriesPoint[] = [];
    for (const r of rows) {
      const v = num(r, campo);
      if (v != null) data.push([trimIsoCentral(String(r.trim)), v]);
    }
    const minIso = data.length ? data[0][0] : "";
    const maxIso = data.length ? data[data.length - 1][0] : "";
    return { data, minIso, maxIso };
  }, [pib, lente, componente]);

  const faixas = useMemo(() => codaceAreas(codace?.trimestral), [codace]);

  return (
    <ChartCard
      title={`${rotulo} sob a lupa`}
      subtitle="Escolha o componente da demanda e a transformação: nível (índice de volume SA ou R$ reais de 1995), ritmo (YoY, acum 4T, QoQ SA) ou peso na economia (% do PIB nominal). Faixas cinzas (só nos níveis) = recessões CODACE/FGV-IBRE."
      toolbar={
        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Componente da demanda"
            value={componente}
            onChange={(e) => setComponente(e.target.value)}
            className="rounded-lg border border-[#132960]/20 bg-white px-2.5 py-1 text-xs font-semibold text-[#132960] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#027DFC]"
          >
            {COMPONENTES.map((c) => (
              <option key={c.key} value={c.key}>
                {pib.labels?.[c.key] ?? LABELS_PIB_FALLBACK[c.key] ?? c.fallback}
              </option>
            ))}
          </select>
          <AzSegmented
            ariaLabel="Transformação"
            options={LENTES.map((l) => ({ id: l.id, label: l.label }))}
            value={lenteId}
            onChange={(id) => setLenteId(id as LenteId)}
          />
          <AzPeriodSelector value={period} onChange={setPeriod} min={minIso} max={maxIso} periods={["1y", "5y", "max"]} />
        </div>
      }
      footer={`Fonte: IBGE/SIDRA — Contas Nacionais Trimestrais, ótica da despesa. Lente atual (${lente.label}): ${lente.fonte}. Importações entram como o próprio componente (alta = importou mais), sem inversão de sinal. Recessões: cronologia CODACE/FGV-IBRE (apenas nas lentes de nível).`}
      stampGiro={geradoEm}
      stampDado={pib.trim_recente}
    >
      {data.length > 0 ? (
        <AzTimeSeriesChart
          series={[{ id: `${componente}-${lenteId}`, label: rotulo, color: AZ_BRAND.azure, data }]}
          unit={lente.unit}
          period={period}
          height={360}
          variant="hero"
          xRefAreas={lente.nivel ? faixas : []}
        />
      ) : (
        <div className="flex w-full items-center justify-center" style={{ height: 360 }}>
          <p className="text-sm text-zinc-400">
            Sem série de &ldquo;{lente.label}&rdquo; para {rotulo} neste recorte.
          </p>
        </div>
      )}
    </ChartCard>
  );
}
