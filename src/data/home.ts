export type Post = {
  id: string;
  title: string;
  category: string;
  author: string;
  date: string;
  slug: string;
  image: string;
};

export const posts: Post[] = [
  {
    id: "um-seguro-indispensavel",
    title: "Um seguro indispensavel",
    category: "Educacao Financeira",
    author: "Rafael De Faveri",
    date: "4 de marco de 2026",
    slug: "/um-seguro-indispensavel",
    image: "https://investimentosdeaz.com.br/wp-content/uploads/2026/03/Seguros-1024x666.png",
  },
  {
    id: "previdencia-privada",
    title: "Previdencia privada: uma peca estrategica no planejamento sucessorio",
    category: "Investimentos",
    author: "Rafael De Faveri",
    date: "4 de marco de 2026",
    slug: "/previdencia-privada-peca-estrategica",
    image: "https://investimentosdeaz.com.br/wp-content/uploads/2026/03/Previdencia-1024x666.png",
  },
  {
    id: "futuro-previdencia-publica",
    title: "O futuro da previdencia publica no Brasil",
    category: "Economia",
    author: "Arthur Borba",
    date: "4 de fevereiro de 2026",
    slug: "/futuro-da-previdencia-publica",
    image: "https://investimentosdeaz.com.br/wp-content/uploads/2026/02/Posts-Previdencia-1024x666.png",
  },
];

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
