/**
 * Catálogo NUMERADO de gráficos do Publisher — contrato estável entre o site,
 * o motor de imagens (data-pipeline/render/render_charts.mjs) e as skills
 * editoriais do robô de publicação.
 *
 * REGRAS:
 * - `id` é ESTÁVEL e imutável: skills e posts antigos referenciam "IPCA-02"
 *   para sempre. Gráfico novo = id novo no FIM da lista do indicador.
 *   Nunca renumerar, nunca reaproveitar id aposentado.
 * - Cada id vira uma página de render isolada (`/render/<id>`) e um PNG
 *   arquivado por divulgação (`releases/<indicador>/<mes_ref>/<id>.png`).
 * - Indicador novo (PIB, PMI, CAGED...) = adicionar entradas aqui + casos na
 *   página /render/[chartId] — o motor e o robô descobrem via /api/render-catalog.
 */

export type ChartIndicador = "ipca" | "igpm";

/** "chart" espera o SVG do Recharts montar; "dom" só espera conteúdo (tabela/KPI/heatmap). */
export type ChartWait = "chart" | "dom";

export type ChartDef = {
  id: string;
  indicador: ChartIndicador;
  titulo: string;
  /** Uma frase editorial: o que mostra e quando usar no texto do release. */
  descricao: string;
  waitFor: ChartWait;
};

/** Release JSON (contrato do robô, schema v1) por indicador. */
export const RELEASE_BLOB_PATH: Record<ChartIndicador, string> = {
  ipca: "data/ipca_release.json",
  igpm: "data/igpm_release.json",
};

/** JSON completo do painel (schema v3) por indicador. */
export const DATA_BLOB_PATH: Record<ChartIndicador, string> = {
  ipca: "data/ipca.json",
  igpm: "data/igpm.json",
};

/** Rota do painel interativo — os posts linkam as imagens para cá. */
export const PAINEL_PATH: Record<ChartIndicador, string> = {
  ipca: "/painel-economico/economia/brasil/inflacao/ipca",
  igpm: "/painel-economico/economia/brasil/inflacao/igp-m",
};

export const INDICADOR_LABEL: Record<ChartIndicador, string> = {
  ipca: "IPCA",
  igpm: "IGP-M",
};

export const CHART_CATALOG: ChartDef[] = [
  // ------------------------------- IPCA --------------------------------
  {
    id: "IPCA-00",
    indicador: "ipca",
    titulo: "Resumo da divulgação (KPIs)",
    descricao:
      "Capa do release: IPCA do mês vs Focus da véspera, 12m vs meta, média dos núcleos e difusão.",
    waitFor: "dom",
  },
  {
    id: "IPCA-01",
    indicador: "ipca",
    titulo: "IPCA 12 meses vs meta (desde 1999)",
    descricao:
      "Série longa institucional: acumulado 12m contra a meta do CMN com bandas — a foto de onde a inflação está no regime de metas.",
    waitFor: "chart",
  },
  {
    id: "IPCA-02",
    indicador: "ipca",
    titulo: "Grupos no mês (variação × contribuição)",
    descricao:
      "O que puxou o índice no mês: variação e contribuição em p.p. dos 9 grupos da POF.",
    waitFor: "chart",
  },
  {
    id: "IPCA-03",
    indicador: "ipca",
    titulo: "Contribuições por grupo (série empilhada)",
    descricao:
      "Decomposição da âncora: contribuição mensal de cada grupo ao IPCA cheio na janela recente.",
    waitFor: "chart",
  },
  {
    id: "IPCA-04",
    indicador: "ipca",
    titulo: "Núcleos de inflação (12m)",
    descricao:
      "Qualidade da desinflação: os 5 núcleos do BC (banda mín–máx + média) contra a meta.",
    waitFor: "chart",
  },
  {
    id: "IPCA-05",
    indicador: "ipca",
    titulo: "Momentum dessazonalizado (SAAR)",
    descricao:
      "Tendência de curto prazo: variação dessaz e 3m/6m anualizados do cheio, núcleos, serviços e livres.",
    waitFor: "chart",
  },
  {
    id: "IPCA-06",
    indicador: "ipca",
    titulo: "Índice de difusão",
    descricao:
      "Espalhamento das altas: % de subitens subindo, média móvel 3m e média histórica como régua.",
    waitFor: "chart",
  },
  {
    id: "IPCA-07",
    indicador: "ipca",
    titulo: "Mês vs padrão sazonal",
    descricao:
      "O número veio alto ou baixo PARA o mês? Leitura contra mediana/mín–máx do mesmo mês civil em 10 anos.",
    waitFor: "chart",
  },
  {
    id: "IPCA-08",
    indicador: "ipca",
    titulo: "Realizado vs Focus + próximos meses",
    descricao:
      "Expectativa de curtíssimo prazo: o realizado contra a mediana da véspera e o Focus dos próximos meses.",
    waitFor: "dom",
  },
  {
    id: "IPCA-09",
    indicador: "ipca",
    titulo: "Histórico de surpresas inflacionárias",
    descricao:
      "Realizado − esperado das últimas divulgações: o mercado vem errando pra cima ou pra baixo?",
    waitFor: "chart",
  },
  {
    id: "IPCA-10",
    indicador: "ipca",
    titulo: "Heatmap de grupos (12 meses)",
    descricao:
      "Mapa de calor grupo × mês: onde a pressão esteve concentrada no último ano.",
    waitFor: "dom",
  },
  {
    id: "IPCA-11",
    indicador: "ipca",
    titulo: "Ancoragem: Focus 12 meses à frente",
    descricao:
      "Expectativa suavizada 12m à frente — termômetro de ancoragem das expectativas.",
    waitFor: "chart",
  },
  {
    id: "IPCA-12",
    indicador: "ipca",
    titulo: "Tabela síntese da divulgação",
    descricao:
      "Tabela estilo Carta de Conjuntura: cheio, IPCA-15, grupos, núcleos, categorias e difusão × [m-2, m-1, mês, ano, 12m].",
    waitFor: "dom",
  },
  // ------------------------------- IGP-M -------------------------------
  {
    id: "IGPM-00",
    indicador: "igpm",
    titulo: "Resumo da divulgação (KPIs)",
    descricao:
      "Capa do release: IGP-M do mês vs Focus, acumulado no ano e 12 meses.",
    waitFor: "dom",
  },
  {
    id: "IGPM-01",
    indicador: "igpm",
    titulo: "IGP-M 12 meses (série longa pós-96)",
    descricao:
      "Série longa com réguas próprias (mediana e p10–p90 pós-Real) — o IGP não tem meta.",
    waitFor: "chart",
  },
  {
    id: "IGPM-02",
    indicador: "igpm",
    titulo: "Decomposição do mês (IPA·IPC·INCC)",
    descricao:
      "Quem puxou o índice no mês: contribuição dos três componentes com pesos efetivos.",
    waitFor: "chart",
  },
  {
    id: "IGPM-03",
    indicador: "igpm",
    titulo: "Decomposição 12m encadeada",
    descricao:
      "Contribuição acumulada de IPA/IPC/INCC ao 12m — de onde vem a inflação do atacado ao varejo.",
    waitFor: "chart",
  },
  {
    id: "IGPM-04",
    indicador: "igpm",
    titulo: "IPA-M (60%) — abertura do componente",
    descricao:
      "Atacado: série e leitura do componente de maior peso do IGP-M.",
    waitFor: "chart",
  },
  {
    id: "IGPM-05",
    indicador: "igpm",
    titulo: "IPC-M (30%) — abertura do componente",
    descricao: "Varejo: série e leitura do componente de consumo.",
    waitFor: "chart",
  },
  {
    id: "IGPM-06",
    indicador: "igpm",
    titulo: "INCC-M (10%) — abertura do componente",
    descricao: "Construção: série e leitura do componente de custos de obra.",
    waitFor: "chart",
  },
  {
    id: "IGPM-07",
    indicador: "igpm",
    titulo: "Origem do IPA: agro × industrial",
    descricao:
      "De onde vem a pressão do atacado — commodities agrícolas ou industriais (família IPA-DI).",
    waitFor: "chart",
  },
  {
    id: "IGPM-08",
    indicador: "igpm",
    titulo: "Mês vs padrão sazonal (pós-96)",
    descricao:
      "O número veio alto ou baixo PARA o mês? Mediana/mín–máx do mês civil desde 1996.",
    waitFor: "chart",
  },
  {
    id: "IGPM-09",
    indicador: "igpm",
    titulo: "Reajuste de aluguel pelo IGP-M",
    descricao:
      "Tradução prática: reajuste no aniversário do contrato (com cláusula de não-redução).",
    waitFor: "dom",
  },
  {
    id: "IGPM-10",
    indicador: "igpm",
    titulo: "Realizado vs Focus + próximos meses",
    descricao:
      "Expectativa de curtíssimo prazo do IGP-M: véspera, surpresa e meses à frente.",
    waitFor: "dom",
  },
  {
    id: "IGPM-11",
    indicador: "igpm",
    titulo: "Histórico de surpresas",
    descricao: "Realizado − esperado das últimas divulgações do IGP-M.",
    waitFor: "chart",
  },
  {
    id: "IGPM-12",
    indicador: "igpm",
    titulo: "Focus anual do IGP-M",
    descricao:
      "Trajetória das expectativas do mercado para o ano corrente e seguintes.",
    waitFor: "chart",
  },
  {
    id: "IGPM-13",
    indicador: "igpm",
    titulo: "Tabela síntese da divulgação",
    descricao:
      "Família IGP e componentes × [m-2, m-1, mês, ano, 12m] — visão tabular completa.",
    waitFor: "dom",
  },
];

export function getChartDef(id: string): ChartDef | null {
  const norm = id.trim().toUpperCase();
  return CHART_CATALOG.find((c) => c.id === norm) ?? null;
}

export function chartsDoIndicador(ind: ChartIndicador): ChartDef[] {
  return CHART_CATALOG.filter((c) => c.indicador === ind);
}
