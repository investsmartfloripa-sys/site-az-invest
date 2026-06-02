export type NavItem = { label: string; href: string };

export const navItems: NavItem[] = [
  { label: "Conteúdo", href: "/conteudo" },
  { label: "Painel econômico", href: "/painel-economico" },
  { label: "Simuladores", href: "/simuladores" },
  { label: "Nosso time", href: "/nosso-time" },
];

/** Entradas da home / atalhos; `value` é o valor salvo em Post.category e em ?categoria=. */
export type ArticleCategoryEntry =
  | { kind: "filter"; label: string; value: string }
  | { kind: "all"; label: string };

export const articleCategories: ArticleCategoryEntry[] = [
  { kind: "filter", label: "Economia", value: "Economia" },
  { kind: "filter", label: "Educação Financeira", value: "Educacao Financeira" },
  { kind: "filter", label: "Política", value: "Politica" },
  { kind: "filter", label: "Investimento", value: "Investimento" },
  { kind: "all", label: "Ver tudo" },
];
