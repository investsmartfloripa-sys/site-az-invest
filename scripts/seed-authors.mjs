import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const authors = [
  {
    slug: "rafael-de-faveri",
    name: "Rafael De Faveri",
    role: "Assessor de Investimentos | Mentor em Educacao Financeira",
    bio: "Conteudo autoral sobre planejamento financeiro e investimentos de longo prazo.",
    photo: "https://investimentosdeaz.com.br/wp-content/uploads/2025/10/Rafael-de-faveri.png",
  },
  {
    slug: "arthur-borba",
    name: "Arthur da Silva Borba",
    role: "Economista e Estrategista",
    bio: "Analises de economia, mercado e conjuntura para orientar decisoes de investimento.",
    photo: "/team/arthur-borba.png",
    instagram: "https://www.instagram.com/artborba/",
    whatsapp: "+5548999386708",
  },
  {
    slug: "arthur-piovesan-goncalves",
    name: "Arthur Piovesan Goncalves",
    role: "Assessor de Investimentos",
    bio: "Atendimento consultivo com foco em estrategia de carteira e alocacao eficiente.",
  },
  {
    slug: "mayara-alcantara",
    name: "Mayara Alcantara",
    role: "Especialista AZ Invest",
    bio: "Integrante do time de especialistas do AZ Invest.",
  },
  {
    slug: "andreas-peters",
    name: "Andreas Peters",
    role: "Especialista AZ Invest",
    bio: "Integrante do time de especialistas do AZ Invest.",
  },
  {
    slug: "marlon-mafra",
    name: "Marlon Mafra",
    role: "Especialista AZ Invest",
    bio: "Integrante do time de especialistas do AZ Invest.",
  },
  {
    slug: "mathias-donofrio",
    name: "Mathias DOnofrio",
    role: "Especialista AZ Invest",
    bio: "Integrante do time de especialistas do AZ Invest.",
  },
  {
    slug: "bernardo-geovane",
    name: "Bernardo Geovane",
    role: "Especialista AZ Invest",
    bio: "Integrante do time de especialistas do AZ Invest.",
  },
  {
    slug: "alessandro-neto",
    name: "Alessandro Neto",
    role: "Especialista AZ Invest",
    bio: "Integrante do time de especialistas do AZ Invest.",
  },
  {
    slug: "franco-mattana",
    name: "Franco Mattana",
    role: "Especialista AZ Invest",
    bio: "Integrante do time de especialistas do AZ Invest.",
  },
  {
    slug: "gustavo-lukaszewski",
    name: "Gustavo Lukaszewski",
    role: "Especialista AZ Invest",
    bio: "Integrante do time de especialistas do AZ Invest.",
  },
  {
    slug: "raul-braga",
    name: "Raul Braga",
    role: "Assessor de Investimentos",
    bio: "Atendimento focado em estrategia patrimonial e acompanhamento de carteira.",
  },
  {
    slug: "eduardo-piaia",
    name: "Eduardo Piaia",
    role: "Especialista AZ Invest",
    bio: "Integrante do time de especialistas do AZ Invest.",
  },
  {
    slug: "wagner-marsango",
    name: "Wagner Marsango",
    role: "Especialista AZ Invest",
    bio: "Integrante do time de especialistas do AZ Invest.",
  },
];

async function main() {
  for (const author of authors) {
    await prisma.author.upsert({
      where: { slug: author.slug },
      update: author,
      create: author,
    });
    console.log(`OK: ${author.name}`);
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
