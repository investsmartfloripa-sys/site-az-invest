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
    slug: "reserva-de-emergencia",
    title: "Reserva de emergencia",
    description:
      "Calcule quanto voce precisa guardar para 6 a 12 meses de despesas e proteja seu orcamento.",
    icon: "$",
    highlight: "Protecao financeira",
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
];
