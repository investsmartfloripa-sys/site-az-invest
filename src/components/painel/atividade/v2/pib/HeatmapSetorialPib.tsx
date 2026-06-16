"use client";

import { useMemo, useState } from "react";

import type { AtividadePibData } from "@/lib/painel-atividade";
import { ChartCard, Heatmap, steppedDivergingScale, AzSegmented } from "@/components/painel/core";
import { fmtTrimCurto, num } from "../shared";

/**
 * Heatmap setorial — onde está o crescimento. DEITADO (4 medidas de variação nas
 * linhas × 17 setores da oferta nas colunas, ordem fixa da SCN) para preencher a
 * largura do card. Tudo de `variacao` (5932), já no JSON. Escala divergente
 * simétrica em torno de 0: verde = expansão, vermelho = queda; intensidade = magnitude.
 */

// 17 setores da oferta (ordem fixa SCN). `abbr` = cabeçalho da coluna no mapa.
const SETORES: { key: string; abbr: string }[] = [
  { key: "agro", abbr: "Agro" },
  { key: "industria", abbr: "Indústria" },
  { key: "industria_extrativa", abbr: "Extrat." },
  { key: "industria_transformacao", abbr: "Transf." },
  { key: "eletricidade_gas", abbr: "Eletr." },
  { key: "construcao", abbr: "Constr." },
  { key: "servicos", abbr: "Serviços" },
  { key: "comercio", abbr: "Comércio" },
  { key: "transporte", abbr: "Transp." },
  { key: "informacao", abbr: "Info" },
  { key: "financeiras", abbr: "Financ." },
  { key: "imobiliarias", abbr: "Imob." },
  { key: "outros_servicos", abbr: "Out.serv." },
  { key: "admin_publica", abbr: "Adm.púb." },
  { key: "valor_adicionado", abbr: "VA" },
  { key: "impostos", abbr: "Impostos" },
  { key: "pib", abbr: "PIB" },
];

const TAXAS: { row: string; prefix: string }[] = [
  { row: "QoQ SA", prefix: "qoq_sa_" },
  { row: "YoY", prefix: "yoy_" },
  { row: "Acum 4T", prefix: "acum_4t_" },
  { row: "Acum ano", prefix: "acum_ano_" },
];

export function HeatmapSetorialPib({ pib, geradoEm }: { pib: AtividadePibData; geradoEm: string }) {
  const serie = pib.variacao.serie;
  const [idx, setIdx] = useState(serie.length - 1);
  const ponto = serie[Math.min(idx, serie.length - 1)];
  const trimSel = String(ponto?.trim ?? pib.trim_recente);

  // Deitado: linhas = 4 taxas, colunas = 17 setores. data[taxa][setor].
  const { rows, cols, data } = useMemo(() => {
    const rows = TAXAS.map((t) => t.row);
    const cols = SETORES.map((s) => s.abbr);
    const data: Record<string, Record<string, number | null>> = {};
    for (const t of TAXAS) {
      const row: Record<string, number | null> = {};
      for (const s of SETORES) row[s.abbr] = num(ponto, t.prefix + s.key);
      data[t.row] = row;
    }
    return { rows, cols, data };
  }, [ponto]);

  const scale = useMemo(() => steppedDivergingScale([0.3, 1, 3]), []);

  const opcoes = serie.slice(-4).map((p, i) => ({
    id: String(serie.length - 4 + i),
    label: fmtTrimCurto(String(p.trim)),
  }));

  return (
    <ChartCard
      title="Onde está o crescimento — e onde não está"
      subtitle={`Mapa de calor: 4 medidas de variação × os 17 setores da oferta no ${trimSel}. Verde = expansão, vermelho = queda; a intensidade é a magnitude.`}
      toolbar={
        opcoes.length > 1 ? (
          <AzSegmented ariaLabel="Trimestre" options={opcoes} value={String(idx)} onChange={(id) => setIdx(Number(id))} />
        ) : undefined
      }
      footer="Fonte: IBGE/SIDRA — Contas Nacionais Trimestrais (5932). QoQ SA = vs trimestre anterior com ajuste sazonal; YoY = vs mesmo trimestre do ano anterior; acum 4T = últimos 12 meses; acum ano = no ano corrente. Variação real do índice de volume, em %. Setores em ordem fixa da SCN (Agro → Indústria e subsetores → Serviços e subsetores → VA, Impostos, PIB)."
      stampGiro={geradoEm}
      stampDado={trimSel}
    >
      <Heatmap rows={rows} cols={cols} data={data} colorScale={scale} cellWidth={42} />
    </ChartCard>
  );
}
