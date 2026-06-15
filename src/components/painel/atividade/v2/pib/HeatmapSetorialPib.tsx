"use client";

import { useMemo, useState } from "react";

import type { AtividadePibData } from "@/lib/painel-atividade";
import { ChartCard, Heatmap, steppedDivergingScale, AzSegmented } from "@/components/painel/core";
import { fmtTrimCurto, num } from "../shared";

/**
 * Heatmap setorial — onde está o crescimento. 17 setores da oferta (ordem fixa
 * da SCN, nunca por amplitude) × 4 medidas de variação do trimestre selecionado.
 * Tudo de `variacao` (5932), já no JSON. Escala divergente simétrica em torno de
 * 0: verde = expansão, vermelho = queda, intensidade = magnitude.
 */

// Ordem fixa SCN (agregados ao fim): setores da oferta.
const SETORES: { key: string; label: string }[] = [
  { key: "agro", label: "Agropecuária" },
  { key: "industria", label: "Indústria (total)" },
  { key: "industria_extrativa", label: "Extrativa" },
  { key: "industria_transformacao", label: "Transformação" },
  { key: "eletricidade_gas", label: "Eletricidade e gás" },
  { key: "construcao", label: "Construção" },
  { key: "servicos", label: "Serviços (total)" },
  { key: "comercio", label: "Comércio" },
  { key: "transporte", label: "Transporte" },
  { key: "informacao", label: "Informação" },
  { key: "financeiras", label: "Financeiras" },
  { key: "imobiliarias", label: "Imobiliárias" },
  { key: "outros_servicos", label: "Outros serviços" },
  { key: "admin_publica", label: "Adm. pública" },
  { key: "valor_adicionado", label: "Valor adicionado" },
  { key: "impostos", label: "Impostos" },
  { key: "pib", label: "PIB" },
];

const TAXAS: { col: string; prefix: string }[] = [
  { col: "QoQ SA", prefix: "qoq_sa_" },
  { col: "YoY", prefix: "yoy_" },
  { col: "Acum 4T", prefix: "acum_4t_" },
  { col: "Acum ano", prefix: "acum_ano_" },
];

export function HeatmapSetorialPib({ pib, geradoEm }: { pib: AtividadePibData; geradoEm: string }) {
  const serie = pib.variacao.serie;
  const [idx, setIdx] = useState(serie.length - 1);
  const ponto = serie[Math.min(idx, serie.length - 1)];
  const trimSel = String(ponto?.trim ?? pib.trim_recente);

  const { rows, data } = useMemo(() => {
    const rows = SETORES.map((s) => s.label);
    const data: Record<string, Record<string, number | null>> = {};
    for (const s of SETORES) {
      const row: Record<string, number | null> = {};
      for (const t of TAXAS) row[t.col] = num(ponto, t.prefix + s.key);
      data[s.label] = row;
    }
    return { rows, data };
  }, [ponto]);

  const scale = useMemo(() => steppedDivergingScale([0.3, 1, 3]), []);
  const cols = TAXAS.map((t) => t.col);

  // Seletor: últimos 4 trimestres (default = mais recente).
  const opcoes = serie.slice(-4).map((p, i) => ({
    id: String(serie.length - 4 + i),
    label: fmtTrimCurto(String(p.trim)),
  }));

  return (
    <ChartCard
      title="Onde está o crescimento — e onde não está"
      subtitle={`Mapa de calor dos 17 setores da oferta × 4 medidas de variação no ${trimSel}. Verde = expansão, vermelho = queda; a intensidade é a magnitude.`}
      toolbar={
        opcoes.length > 1 ? (
          <AzSegmented ariaLabel="Trimestre" options={opcoes} value={String(idx)} onChange={(id) => setIdx(Number(id))} />
        ) : undefined
      }
      footer="Fonte: IBGE/SIDRA — Contas Nacionais Trimestrais (5932). QoQ SA = vs trimestre anterior com ajuste sazonal; YoY = vs mesmo trimestre do ano anterior; acum 4T = últimos 12 meses; acum ano = no ano corrente. Variação real do índice de volume, em %. Setores em ordem fixa da SCN."
      stampGiro={geradoEm}
      stampDado={trimSel}
    >
      <Heatmap rows={rows} cols={cols} data={data} colorScale={scale} cellWidth={72} />
    </ChartCard>
  );
}
