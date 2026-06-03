export type Simulador = {
  slug: string;
  title: string;
  description: string;
  icon: string;
  highlight: string;
};

export const simuladores: Simulador[] = [
  {
    slug: "juros-compostos",
    title: "Juros compostos",
    description:
      "Veja quanto seu patrimonio pode crescer com aportes mensais e o efeito bola de neve dos juros.",
    icon: "+",
    highlight: "Investidor de longo prazo",
  },
  {
    slug: "aposentadoria",
    title: "Aposentadoria",
    description:
      "Estime o patrimonio necessario para a sua aposentadoria e quanto investir por mes para chegar la.",
    icon: ">",
    highlight: "Liberdade financeira",
  },
  {
    slug: "financiamento",
    title: "Financiamento x investimento",
    description:
      "Compare se vale a pena adiar a compra de um imovel e investir o valor da entrada por enquanto.",
    icon: "%",
    highlight: "Decisao de compra",
  },
  {
    slug: "consorcio",
    title: "Consorcio inteligente",
    description:
      "Simule sua carta de credito, compare com financiamento (Price/SAC) e descubra quando voce deve ser contemplado.",
    icon: "*",
    highlight: "Sem juros",
  },
  {
    slug: "pgbl",
    title: "PGBL e restituicao",
    description:
      "Descubra quanto voce pode deduzir no IR com PGBL e o efeito da restituicao reinvestida no longo prazo.",
    icon: "#",
    highlight: "Beneficio fiscal",
  },
  {
    slug: "compromissadas",
    title: "Compromissadas",
    description:
      "Compare operacoes compromissadas com CDB e outras opcoes de renda fixa em diferentes prazos e taxas.",
    icon: "$",
    highlight: "Renda fixa",
  },
  {
    slug: "sucessao-seguro",
    title: "Sucessao e seguro de vida",
    description:
      "Planeje a sucessao patrimonial e veja como o seguro de vida protege a familia e reduz custos do inventario.",
    icon: "&",
    highlight: "Protecao patrimonial",
  },
];
