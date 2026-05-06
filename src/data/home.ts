export type NavItem = { label: string; href: string };

export const navItems: NavItem[] = [
  { label: "Artigos", href: "/blog" },
  { label: "Painel economico", href: "/painel-economico" },
  { label: "Videos", href: "/videos" },
  { label: "Simuladores", href: "/simuladores" },
  { label: "Nosso time", href: "/nosso-time" },
];

export type ArticleCategory = { label: string; href: string };

export const articleCategories: ArticleCategory[] = [
  { label: "Economia", href: "/blog?categoria=Economia" },
  { label: "Educacao Financeira", href: "/blog?categoria=Educacao+Financeira" },
  { label: "Politica", href: "/blog?categoria=Politica" },
  { label: "Investimento", href: "/blog?categoria=Investimento" },
  { label: "Ver tudo", href: "/blog" },
];
