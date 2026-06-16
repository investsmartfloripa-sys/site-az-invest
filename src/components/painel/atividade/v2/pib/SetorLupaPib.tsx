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
 * Setor sob a lupa — um frame, dois seletores. Escolha QUAL dos 17 recortes da
 * oferta da SCN olhar (Agro → Indústria e subsetores → Serviços e subsetores →
 * VA, Impostos, PIB) e em QUE lente: o nível (índice de volume SA ou R$ reais a
 * preços de 1995), o ritmo (YoY, acum 4T, QoQ SA) ou o peso na economia (% do
 * PIB nominal). Uma única série temporal por vez, sem sobreposição. Recessões
 * CODACE/FGV-IBRE só sombreiam as lentes de NÍVEL (no momentum e no peso a
 * referência é o próprio zero/eixo, não o ciclo).
 */

// 17 recortes da oferta, ordem fixa da SCN (mesma de HeatmapSetorialPib).
const SETORES: { key: string; fallback: string }[] = [
  { key: "agro", fallback: "Agropecuária" },
  { key: "industria", fallback: "Indústria total" },
  { key: "industria_extrativa", fallback: "Indústria extrativa" },
  { key: "industria_transformacao", fallback: "Indústria de transformação" },
  { key: "eletricidade_gas", fallback: "Eletricidade, gás e água" },
  { key: "construcao", fallback: "Construção" },
  { key: "servicos", fallback: "Serviços total" },
  { key: "comercio", fallback: "Comércio" },
  { key: "transporte", fallback: "Transporte e armazenagem" },
  { key: "informacao", fallback: "Informação e comunicação" },
  { key: "financeiras", fallback: "Atividades financeiras" },
  { key: "imobiliarias", fallback: "Atividades imobiliárias" },
  { key: "outros_servicos", fallback: "Outros serviços" },
  { key: "admin_publica", fallback: "Admin, saúde, educação públicas" },
  { key: "valor_adicionado", fallback: "Valor adicionado a preços básicos" },
  { key: "impostos", fallback: "Impostos líquidos sobre produtos" },
  { key: "pib", fallback: "PIB a preços de mercado" },
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

export function SetorLupaPib({
  pib,
  codace,
  geradoEm,
}: {
  pib: AtividadePibData;
  codace?: AtividadeCodaceData | null;
  geradoEm: string;
}) {
  const [setor, setSetor] = useState<string>("pib");
  const [lenteId, setLenteId] = useState<LenteId>("nivel_sa");
  const [period, setPeriod] = useState<AzPeriodValue>({ id: "5y" });

  const lente = LENTES.find((l) => l.id === lenteId) ?? LENTES[0];
  const rotulo = pib.labels?.[setor] ?? LABELS_PIB_FALLBACK[setor] ?? setor;

  // A série temporal única da combinação (setor × lente). Cada bloco do JSON é
  // opcional no tipo (valores_reais_sa / estrutura_nominal) — trata undefined.
  const { data, minIso, maxIso } = useMemo(() => {
    let rows: ReadonlyArray<Record<string, unknown> & { trim: string }> = [];
    if (lente.serie === "indice_volume") rows = pib.indice_volume.serie;
    else if (lente.serie === "variacao") rows = pib.variacao.serie;
    else if (lente.serie === "valores_reais_sa") rows = pib.valores_reais_sa?.serie ?? [];
    else rows = (pib.estrutura_nominal?.serie ?? []) as unknown as ReadonlyArray<Record<string, unknown> & { trim: string }>;

    const campo = lente.chave(setor);
    const data: AzSeriesPoint[] = [];
    for (const r of rows) {
      const v = num(r, campo);
      if (v != null) data.push([trimIsoCentral(String(r.trim)), v]);
    }
    const minIso = data.length ? data[0][0] : "";
    const maxIso = data.length ? data[data.length - 1][0] : "";
    return { data, minIso, maxIso };
  }, [pib, lente, setor]);

  const faixas = useMemo(() => codaceAreas(codace?.trimestral), [codace]);

  return (
    <ChartCard
      title={`${rotulo} sob a lupa`}
      subtitle="Escolha o recorte da oferta e a transformação: nível (índice de volume SA ou R$ reais de 1995), ritmo (YoY, acum 4T, QoQ SA) ou peso na economia (% do PIB nominal). Faixas cinzas (só nos níveis) = recessões CODACE/FGV-IBRE."
      toolbar={
        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Setor"
            value={setor}
            onChange={(e) => setSetor(e.target.value)}
            className="rounded-lg border border-[#132960]/20 bg-white px-2.5 py-1 text-xs font-semibold text-[#132960] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#027DFC]"
          >
            {SETORES.map((s) => (
              <option key={s.key} value={s.key}>
                {pib.labels?.[s.key] ?? LABELS_PIB_FALLBACK[s.key] ?? s.fallback}
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
      footer={`Fonte: IBGE/SIDRA — Contas Nacionais Trimestrais. Lente atual (${lente.label}): ${lente.fonte}. Recessões: cronologia CODACE/FGV-IBRE (apenas nas lentes de nível).`}
      stampGiro={geradoEm}
      stampDado={pib.trim_recente}
    >
      {data.length > 0 ? (
        <AzTimeSeriesChart
          series={[{ id: `${setor}-${lenteId}`, label: rotulo, color: AZ_BRAND.azure, data }]}
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
