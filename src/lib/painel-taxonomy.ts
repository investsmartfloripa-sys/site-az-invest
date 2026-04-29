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
    label: "Renda Variavel",
    description: "Acoes, setores e amplitude de mercado local.",
    frequency: "tempo-real",
    sourceHint: "B3, provedores de mercado",
  },
  {
    slug: "renda-fixa",
    label: "Renda Fixa",
    description: "Curvas de juros, spreads e term structure domestica.",
    frequency: "diario",
    sourceHint: "Tesouro, B3, ANBIMA",
  },
  {
    slug: "cambio",
    label: "Cambio",
    description: "Moedas, fluxo e variacoes relativas do real.",
    frequency: "tempo-real",
    sourceHint: "BCB, provedores FX",
  },
];

const mercadoGlobal: CategoryDef[] = [
  {
    slug: "indices-globais",
    label: "Indices Globais",
    description: "Principais bolsas e performance por regiao.",
    frequency: "tempo-real",
    sourceHint: "Yahoo Finance, bolsas globais",
  },
  {
    slug: "juros-globais",
    label: "Juros Globais",
    description: "Curvas soberanas e expectativas de politica monetaria.",
    frequency: "diario",
    sourceHint: "FRED, tesouros internacionais",
  },
  {
    slug: "commodities",
    label: "Commodities",
    description: "Energia, metais e agro com leitura de tendencia.",
    frequency: "tempo-real",
    sourceHint: "Yahoo Finance, bolsas de commodities",
  },
];

const economiaBrasil: CategoryDef[] = [
  {
    slug: "atividade",
    label: "Atividade",
    description: "PIB, producao, consumo e dinamica da economia real.",
    frequency: "mensal",
    sourceHint: "IBGE, BCB",
  },
  {
    slug: "inflacao",
    label: "Inflacao",
    description: "IPCA, nucleos e difusao de precos.",
    frequency: "mensal",
    sourceHint: "IBGE, BCB",
  },
  {
    slug: "fiscal",
    label: "Fiscal",
    description: "Arrecadacao, gastos, resultado primario e divida.",
    frequency: "mensal",
    sourceHint: "Tesouro Nacional, STN",
  },
  {
    slug: "politica-monetaria",
    label: "Politica Monetaria",
    description: "Selic corrente, Selic implicita e comunicacao do BC.",
    frequency: "diario",
    sourceHint: "BCB, B3",
  },
];

const economiaGlobal: CategoryDef[] = [
  {
    slug: "atividade",
    label: "Atividade",
    description: "Crescimento global, PMIs e ciclo economico.",
    frequency: "mensal",
    sourceHint: "FRED, OECD, bancos centrais",
  },
  {
    slug: "inflacao",
    label: "Inflacao",
    description: "Inflacao ao consumidor e pressao de custos internacional.",
    frequency: "mensal",
    sourceHint: "FRED, BLS, Eurostat",
  },
  {
    slug: "bancos-centrais",
    label: "Bancos Centrais",
    description: "Fed, BCE e principais guias de juros globais.",
    frequency: "diario",
    sourceHint: "Fed, BCE, BoE, BoJ",
  },
];

export const painelTrails: TrailDef[] = [
  {
    slug: "mercado",
    label: "Ativos de Mercado",
    description: "Leitura de precos, retornos e risco em ativos domesticos e globais.",
    scopes: [
      { slug: "brasil", label: "Brasil", categories: mercadoBrasil },
      { slug: "global", label: "Global", categories: mercadoGlobal },
    ],
  },
  {
    slug: "economia",
    label: "Indicadores Macroeconomicos",
    description: "Contexto de ciclo, inflacao e politica economica para decisao.",
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
