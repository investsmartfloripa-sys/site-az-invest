import type { LucideIcon } from "lucide-react";
import {
  Armchair,
  CreditCard,
  Home,
  Hourglass,
  Landmark,
  Percent,
  PiggyBank,
  Shield,
  Sprout,
  TrendingUp,
} from "lucide-react";

export type CategoriaSlug =
  | "investir"
  | "aposentadoria"
  | "credito"
  | "protecao";

export type Categoria = {
  slug: CategoriaSlug;
  nome: string;
  descricao: string;
  /** Cor de accent da categoria (hex). Dosada em chips, filetes e CTAs. */
  cor: string;
  icone: LucideIcon;
};

/**
 * Sistema de classificação dos simuladores.
 * A cor da categoria aparece em doses pequenas e sempre nos mesmos pontos:
 * chip do hub, eyebrow do header, filete superior e CTA principal.
 */
export const CATEGORIAS: Record<CategoriaSlug, Categoria> = {
  investir: {
    slug: "investir",
    nome: "Investir e acumular",
    descricao: "Quanto o seu dinheiro rende — e como ele cresce no tempo.",
    cor: "#027DFC",
    icone: Sprout,
  },
  aposentadoria: {
    slug: "aposentadoria",
    nome: "Aposentadoria e previdência",
    descricao: "Planeje a vida depois do trabalho e pague menos IR até lá.",
    cor: "#132960",
    icone: Hourglass,
  },
  credito: {
    slug: "credito",
    nome: "Crédito e grandes compras",
    descricao: "Financiar, fazer consórcio ou investir a entrada? A conta completa.",
    cor: "#FF5713",
    icone: CreditCard,
  },
  protecao: {
    slug: "protecao",
    nome: "Proteção e sucessão",
    descricao: "Sua família protegida e o patrimônio transferido sem surpresas.",
    cor: "#0F766E",
    icone: Shield,
  },
};

/** Ordem das seções no hub: a jornada do cliente (acumular → aposentar → comprar → proteger). */
export const ORDEM_CATEGORIAS: CategoriaSlug[] = [
  "investir",
  "aposentadoria",
  "credito",
  "protecao",
];

export type Simulador = {
  slug: string;
  title: string;
  description: string;
  categoria: CategoriaSlug;
  /** A pergunta de uma linha que o simulador responde. */
  pergunta: string;
  /** Tempo estimado de uso, em minutos. */
  tempoMin: number;
  /** Destaca o badge "Mais usado" no hub. */
  popular?: boolean;
  icone: LucideIcon;
};

export const simuladores: Simulador[] = [
  {
    slug: "juros-compostos",
    title: "Juros compostos",
    description:
      "Veja quanto seu patrimônio pode crescer com aportes mensais e o efeito bola de neve dos juros.",
    categoria: "investir",
    pergunta: "Quanto meu dinheiro pode crescer com aportes mensais?",
    tempoMin: 2,
    popular: true,
    icone: TrendingUp,
  },
  {
    slug: "compromissadas",
    title: "Compromissadas",
    description:
      "Compare operações compromissadas com CDB e outras opções de renda fixa em diferentes prazos e taxas.",
    categoria: "investir",
    pergunta: "Onde o caixa da empresa rende mais entre 1 e 30 dias?",
    tempoMin: 3,
    icone: Landmark,
  },
  {
    slug: "aposentadoria",
    title: "Aposentadoria",
    description:
      "Estime o patrimônio necessário para a sua aposentadoria e quanto investir por mês para chegar lá.",
    categoria: "aposentadoria",
    pergunta: "Quanto preciso acumular — e aportar por mês — para me aposentar?",
    tempoMin: 3,
    popular: true,
    icone: Armchair,
  },
  {
    slug: "pgbl",
    title: "PGBL e restituição",
    description:
      "Descubra quanto você pode deduzir no IR com PGBL e o efeito da restituição reinvestida no longo prazo.",
    categoria: "aposentadoria",
    pergunta: "Quanto de IR eu economizo investindo em PGBL?",
    tempoMin: 3,
    icone: PiggyBank,
  },
  {
    slug: "financiamento",
    title: "Financiamento x investimento",
    description:
      "Compare se vale a pena adiar a compra de um imóvel e investir o valor da entrada por enquanto.",
    categoria: "credito",
    pergunta: "Quanto vou pagar de verdade no Price e no SAC?",
    tempoMin: 4,
    icone: Home,
  },
  {
    slug: "consorcio",
    title: "Consórcio inteligente",
    description:
      "Simule sua carta de crédito, compare com financiamento (Price/SAC) e descubra quando você pode ser contemplado.",
    categoria: "credito",
    pergunta: "Consórcio ou financiamento: qual caminho custa menos?",
    tempoMin: 5,
    icone: Percent,
  },
  {
    slug: "sucessao-seguro",
    title: "Sucessão e seguro de vida",
    description:
      "Planeje a sucessão patrimonial e veja como o seguro de vida protege a família e reduz custos do inventário.",
    categoria: "protecao",
    pergunta: "Minha família fica protegida se eu faltar?",
    tempoMin: 5,
    icone: Shield,
  },
];
