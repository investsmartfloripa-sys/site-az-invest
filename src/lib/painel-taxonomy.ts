export type TrilhaSlug = "mercado" | "economia";
export type EscopoSlug = "brasil" | "global";

export type CategoryDef = {
  slug: string;
  label: string;
  description: string;
  frequency: "tempo-real" | "diario" | "semanal" | "mensal";
  sourceHint: string;
};

export type ScopeDef = {
  slug: EscopoSlug;
  label: string;
  categories: CategoryDef[];
};

export type TrailDef = {
  slug: TrilhaSlug;
  label: string;
  description: string;
  scopes: ScopeDef[];
};

const mercadoBrasil: CategoryDef[] = [
  {
    slug: "renda-variavel",
    label: "Ibovespa",
    description: "Ibovespa, valuation da bolsa (P/L histórico com bandas e prêmio vs NTN-B) e screener de ações.",
    frequency: "diario",
    sourceHint: "B3, yfinance, CVM, BCB, ANBIMA",
  },
  {
    slug: "fundos-investimento",
    label: "Fundos de Investimento",
    description:
      "Rankings de fundos por categoria (multimercado, ações, renda fixa): retorno, Sharpe e volatilidade contra o CDI. Fonte: Mais Retorno (D-1).",
    frequency: "semanal",
    sourceHint: "Mais Retorno (Data API)",
  },
  {
    slug: "renda-fixa",
    label: "Renda fixa",
    description: "Curvas de juros, spreads e estrutura a prazo doméstica.",
    frequency: "diario",
    sourceHint: "Tesouro, B3, ANBIMA",
  },
  {
    slug: "fundos-imobiliarios",
    label: "Fundos Imobiliários",
    description: "Panorama do IFIX, retornos vs benchmarks e screener completo dos FIIs listados.",
    frequency: "diario",
    sourceHint: "B3, CVM Dados Abertos, yfinance",
  },
];

const mercadoGlobal: CategoryDef[] = [
  {
    // Página própria: src/app/painel-economico/mercado/global/indices-globais/page.tsx
    slug: "indices-globais",
    label: "Índices globais",
    description: "Bolsas desenvolvidas × emergentes: retornos por período e comparativo histórico rebase 100.",
    frequency: "tempo-real",
    sourceHint: "Yahoo Finance (16 índices intradiários + histórico 5a)",
  },
  {
    // Página própria: src/app/painel-economico/mercado/global/moedas/page.tsx
    // (absorveu a antiga /mercado/brasil/cambio, que hoje só redireciona)
    slug: "moedas",
    label: "Moedas",
    description:
      "Moedas do mundo contra o dólar: ranking majors × emergentes por janela, DXY e o bloco do real (USD/BRL, cruzes e ranking emergente).",
    frequency: "tempo-real",
    sourceHint: "Yahoo Finance, pipeline AZ (fx_top_movers + histórico 5a)",
  },
  {
    slug: "juros-globais",
    label: "Juros globais",
    description: "Curvas soberanas e expectativas de política monetária.",
    frequency: "diario",
    sourceHint: "FRED, tesouros internacionais",
  },
  {
    // Página própria: src/app/painel-economico/mercado/global/commodities/page.tsx
    slug: "commodities",
    label: "Commodities",
    description: "Energia, metais e agro: retornos por período em USD/BRL e histórico comparativo dos futuros.",
    frequency: "tempo-real",
    sourceHint: "Yahoo Finance (17 futuros front-month + histórico 5a)",
  },
];

const economiaBrasil: CategoryDef[] = [
  {
    slug: "visao-geral",
    label: "Visão Geral",
    description: "Síntese executiva consolidada (em construção).",
    frequency: "diario",
    sourceHint: "Em construção",
  },
  {
    slug: "termometro-ciclo",
    label: "Termômetro de Ciclo",
    description: "Termômetro do ciclo econômico brasileiro com antecedentes e probabilidade de recessão.",
    frequency: "diario",
    sourceHint: "BCB, IBGE, OECD, FGV-IBRE, ANFAVEA, EPE, ANP",
  },
  {
    slug: "atividade",
    label: "Atividade",
    description: "PIB, produção, consumo e dinâmica da economia real.",
    frequency: "mensal",
    sourceHint: "IBGE, BCB",
  },
  {
    slug: "inflacao",
    label: "Inflação",
    description: "IPCA, núcleos e difusão de preços.",
    frequency: "mensal",
    sourceHint: "IBGE, BCB",
  },
  {
    slug: "emprego",
    label: "Emprego",
    description: "PNAD (taxas, informalidade, setor) e CAGED (saldo formal, faixa salarial).",
    frequency: "mensal",
    sourceHint: "IBGE/PNAD, MTE/CAGED, IPEADATA",
  },
  {
    slug: "fiscal",
    label: "Fiscal",
    description: "Arrecadação, gastos, resultado primário e dívida.",
    frequency: "mensal",
    sourceHint: "Tesouro Nacional, STN",
  },
  {
    slug: "politica-monetaria",
    label: "Política monetária",
    description: "Selic corrente, Selic implícita e comunicação do BC.",
    frequency: "diario",
    sourceHint: "BCB, B3",
  },
  {
    slug: "contas-externas",
    label: "Contas externas",
    description: "Balanço de pagamentos, investimento direto e reservas internacionais.",
    frequency: "mensal",
    sourceHint: "BCB (BPM6), SGS",
  },
  {
    slug: "familias",
    label: "Famílias",
    description: "Renda, endividamento, comprometimento mensal e saúde financeira das famílias brasileiras.",
    frequency: "mensal",
    sourceHint: "BCB SGS, IBGE PNAD, Ipeadata",
  },
];

const economiaGlobal: CategoryDef[] = [
  {
    slug: "atividade",
    label: "Atividade",
    description: "Crescimento global, PMIs e ciclo econômico.",
    frequency: "mensal",
    sourceHint: "FRED, OECD, bancos centrais",
  },
  {
    slug: "inflacao",
    label: "Inflação",
    description: "Inflação ao consumidor e pressão de custos internacional.",
    frequency: "mensal",
    sourceHint: "FRED, BLS, Eurostat",
  },
  {
    slug: "bancos-centrais",
    label: "Bancos centrais",
    description: "Fed, BCE e principais guias de juros globais.",
    frequency: "diario",
    sourceHint: "Fed, BCE, BoE, BoJ",
  },
];

export const painelTrails: TrailDef[] = [
  {
    slug: "mercado",
    label: "Ativos de mercado",
    description: "Leitura de preços, retornos e risco em ativos domésticos e globais.",
    scopes: [
      { slug: "brasil", label: "Brasil", categories: mercadoBrasil },
      { slug: "global", label: "Global", categories: mercadoGlobal },
    ],
  },
  {
    slug: "economia",
    label: "Indicadores macroeconômicos",
    description: "Contexto de ciclo, inflação e política econômica para decisão.",
    scopes: [
      { slug: "brasil", label: "Brasil", categories: economiaBrasil },
      { slug: "global", label: "Global", categories: economiaGlobal },
    ],
  },
];

export function getTrail(slug: string): TrailDef | null {
  return painelTrails.find((trail) => trail.slug === slug) ?? null;
}

export function getScope(trailSlug: string, scopeSlug: string): ScopeDef | null {
  const trail = getTrail(trailSlug);
  if (!trail) return null;
  return trail.scopes.find((scope) => scope.slug === scopeSlug) ?? null;
}

export function getCategory(trailSlug: string, scopeSlug: string, categorySlug: string): CategoryDef | null {
  const scope = getScope(trailSlug, scopeSlug);
  if (!scope) return null;
  return scope.categories.find((category) => category.slug === categorySlug) ?? null;
}
