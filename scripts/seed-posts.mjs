import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function slugify(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

const dummyPosts = [
  {
    title: "Selic em 2026: o que esperar dos juros nos proximos meses",
    category: "Economia",
    authorSlug: "andre-zanon",
    excerpt:
      "Analise dos rumos da politica monetaria do Banco Central e os impactos para investidores de renda fixa.",
    content: `O Comite de Politica Monetaria (Copom) vem sinalizando cautela nas ultimas reunioes. Com a inflacao ainda pressionada por servicos e alimentos, o cenario base aponta para a manutencao da taxa basica em patamar elevado no curto prazo.\n\nPara o investidor pessoa fisica, isso significa que titulos atrelados ao CDI continuam atraentes, especialmente os de prazos curtos e medios. Ja os prefixados ganham apelo somente em momentos de stress, quando a curva de juros embute previsao de queda mais acelerada.\n\nNossa recomendacao para os proximos 90 dias: manter alocacao defensiva, aproveitar IPCA+ longos quando o premio passar de 6,5% e evitar concentracao em multimercados que apostem em queda rapida.`,
    coverImage:
      "https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=1024&q=80",
  },
  {
    title: "Como montar uma reserva de emergencia eficiente",
    category: "Educacao Financeira",
    authorSlug: "rafael-de-faveri",
    excerpt:
      "Quanto guardar, onde guardar e quando comecar a investir o excedente sem comprometer a seguranca financeira.",
    content: `A reserva de emergencia e o primeiro passo de qualquer estrategia financeira saudavel. Ela protege voce de imprevistos como desemprego, problemas de saude e gastos inesperados.\n\nA regra geral e acumular o equivalente a 6 meses dos seus gastos mensais. Para autonomos e empreendedores, recomendamos 12 meses devido a maior volatilidade da renda.\n\nO ideal e manter esse dinheiro em um Tesouro Selic ou em CDBs com liquidez diaria de bancos solidos. Evite fundos com taxas altas e qualquer ativo de risco para essa parcela.`,
    coverImage:
      "https://images.unsplash.com/photo-1579621970795-87facc2f976d?auto=format&fit=crop&w=1024&q=80",
  },
  {
    title: "Reforma tributaria: impactos diretos para quem investe",
    category: "Politica",
    authorSlug: "arthur-borba",
    excerpt:
      "Mudancas aprovadas trazem novas regras para fundos exclusivos, offshore e tributacao de dividendos.",
    content: `A reforma tributaria recem aprovada altera de forma profunda a forma como rendimentos de aplicacoes financeiras sao tributados. Os principais pontos de atencao sao:\n\n1. Come-cotas semestral em fundos exclusivos\n2. Tributacao automatica de offshore\n3. Possivel volta da tributacao de dividendos\n\nO investidor que tem patrimonio relevante via PJ ou estrutura no exterior precisa, urgente, revisar a estrategia. Em muitos casos, o ganho de eficiencia tributaria de antes deixou de existir.`,
    coverImage:
      "https://images.unsplash.com/photo-1450101499163-c8848c66ca85?auto=format&fit=crop&w=1024&q=80",
  },
  {
    title: "ETFs internacionais: por que diversificar em dolar agora",
    category: "Investimento",
    authorSlug: "arthur-piovesan",
    excerpt:
      "Estrategias praticas para expor parte do portfolio a economia americana com baixo custo e alta liquidez.",
    content: `A diversificacao internacional deixou de ser um luxo e virou necessidade para qualquer carteira que busca consistencia. ETFs como IVVB11 e BIIB39 permitem exposicao ao mercado americano direto da B3.\n\nAlocar entre 15% e 30% da parcela de renda variavel em ativos dolarizados ajuda a proteger o poder de compra e reduz a volatilidade total da carteira em momentos de estresse interno.\n\nVale destacar: nao confunda diversificacao com timing. O objetivo nao e acertar o cambio, e sim ter exposicao constante a economias mais maduras.`,
    coverImage:
      "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=1024&q=80",
  },
  {
    title: "Previdencia privada: PGBL ou VGBL? Como escolher",
    category: "Educacao Financeira",
    authorSlug: "carla-souza",
    excerpt:
      "Guia direto ao ponto para entender quando cada tipo de plano faz sentido na sua estrategia de longo prazo.",
    content: `A escolha entre PGBL e VGBL depende basicamente de dois fatores: como voce declara IR e por quanto tempo pretende manter o investimento.\n\nPGBL: ideal para quem faz declaracao completa do IR. Permite deduzir ate 12% da renda bruta tributavel.\n\nVGBL: indicado para quem faz declaracao simplificada ou ja excedeu os 12% no PGBL. A tributacao incide apenas sobre os rendimentos.\n\nEm ambos, prefira a tabela regressiva se o horizonte for superior a 10 anos. Aliquota minima de 10% e diferenca enorme no resultado final.`,
    coverImage:
      "https://images.unsplash.com/photo-1556742502-ec7c0e9f34b1?auto=format&fit=crop&w=1024&q=80",
  },
  {
    title: "Bolsa em alta: setores que devem liderar nos proximos 12 meses",
    category: "Economia",
    authorSlug: "andre-zanon",
    excerpt:
      "Analise setorial com nomes que combinam dividendo robusto, balanco saudavel e potencial de valorizacao.",
    content: `O cenario macro mais benigno deve impulsionar setores ligados ao consumo domestico, com destaque para varejo, bancos medios e construcao civil de baixa renda.\n\nNossa selecao para os proximos 12 meses inclui empresas com geracao consistente de caixa, baixo endividamento e bom historico de remuneracao ao acionista.\n\nPara investidor de longo prazo, a recomendacao e ir construindo posicao gradualmente, aproveitando momentos de stress de mercado para aumentar exposicao em nomes de qualidade.`,
    coverImage:
      "https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?auto=format&fit=crop&w=1024&q=80",
  },
];

async function main() {
  for (const post of dummyPosts) {
    const slug = slugify(post.title);
    const author = await prisma.author.findUnique({
      where: { slug: post.authorSlug },
    });
    if (!author) {
      console.warn(`Autor nao encontrado: ${post.authorSlug}. Rode db:seed-authors antes.`);
      continue;
    }

    const data = {
      title: post.title,
      category: post.category,
      authorName: author.name,
      authorId: author.id,
      excerpt: post.excerpt,
      content: post.content,
      coverImage: post.coverImage,
      published: true,
    };

    await prisma.post.upsert({
      where: { slug },
      update: data,
      create: { slug, ...data },
    });
    console.log(`OK: ${post.title}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
