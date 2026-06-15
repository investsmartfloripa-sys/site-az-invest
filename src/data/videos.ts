export type Video = {
  id: string;
  title: string;
  description: string;
  youtubeId: string;
  duration: string;
  publishedAt: string;
};

export const videos: Video[] = [
  {
    id: "v1",
    title: "Como montar uma carteira de investimentos do zero",
    description:
      "Passo a passo para definir perfil, objetivos e selecionar ativos com critério.",
    youtubeId: "5MgBikgcWnY",
    duration: "12:45",
    publishedAt: "2026-03-01",
  },
  {
    id: "v2",
    title: "Selic, inflação e o impacto nos seus investimentos",
    description:
      "Entenda como a política monetária afeta renda fixa, bolsa e câmbio.",
    youtubeId: "kqtD5dpn9C8",
    duration: "09:32",
    publishedAt: "2026-02-18",
  },
  {
    id: "v3",
    title: "Previdência privada: PGBL ou VGBL?",
    description:
      "Diferenças, benefícios fiscais e como escolher o plano certo para o seu caso.",
    youtubeId: "p7K293_y0lE",
    duration: "11:08",
    publishedAt: "2026-02-04",
  },
  {
    id: "v4",
    title: "Investindo no exterior: caminhos legais e eficientes",
    description:
      "ETFs, BDRs, contas internacionais e estratégias para diversificação em dólar.",
    youtubeId: "lTTajzrSkCw",
    duration: "14:20",
    publishedAt: "2026-01-22",
  },
  {
    id: "v5",
    title: "Tesouro Direto: qual título escolher em 2026",
    description:
      "Comparativo entre Selic, IPCA+ e prefixados para diferentes cenários.",
    youtubeId: "hY7m5jjJ9mM",
    duration: "10:11",
    publishedAt: "2026-01-08",
  },
  {
    id: "v6",
    title: "Reforma tributária: o que muda para o investidor",
    description:
      "Análise dos pontos centrais da reforma e o que ajustar na sua estratégia.",
    youtubeId: "9bZkp7q19f0",
    duration: "13:55",
    publishedAt: "2025-12-17",
  },
];
