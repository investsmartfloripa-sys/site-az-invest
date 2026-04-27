import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const authors = [
  {
    slug: "andre-zanon",
    name: "Andre Zanon",
    role: "Economista e Estrategista",
    bio: "Lidera as analises macro do AZ Invest, com mais de 15 anos de experiencia em mercado financeiro. Especialista em politica monetaria, ciclos economicos e renda fixa.",
    photo:
      "https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=400&h=400&q=80",
    email: "andre.zanon@azinvest.com",
    linkedin: "https://www.linkedin.com",
  },
  {
    slug: "rafael-de-faveri",
    name: "Rafael De Faveri",
    role: "Assessor de Investimentos | Mentor em Educ. Financeira",
    bio: "Especialista em planejamento financeiro pessoal. Atende clientes em busca de liberdade financeira por meio de estrategia de longo prazo.",
    photo:
      "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=400&h=400&q=80",
    email: "rafael@azinvest.com",
    linkedin: "https://www.linkedin.com",
  },
  {
    slug: "arthur-borba",
    name: "Arthur da Silva Borba",
    role: "Economista e Estrategista",
    bio: "Pesquisador focado em politica fiscal, demografia e impactos macroeconomicos no Brasil. Doutorando em Economia.",
    photo:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&h=400&q=80",
    email: "arthur.borba@azinvest.com",
    linkedin: "https://www.linkedin.com",
  },
  {
    slug: "arthur-piovesan",
    name: "Arthur Piovesan",
    role: "Assessor de Investimentos",
    bio: "Atua em planejamento financeiro pessoal e diversificacao global de patrimonio para investidores qualificados.",
    photo:
      "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=400&h=400&q=80",
    email: "arthur.piovesan@azinvest.com",
    linkedin: "https://www.linkedin.com",
  },
  {
    slug: "raul-braga",
    name: "Raul Braga",
    role: "Assessor de Investimentos",
    bio: "Foco em estrategias de longo prazo e geracao de renda recorrente para clientes pessoa fisica.",
    photo:
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&h=400&q=80",
    email: "raul@azinvest.com",
    linkedin: "https://www.linkedin.com",
  },
  {
    slug: "ana-fontes",
    name: "Ana Fontes",
    role: "Assessora de Investimentos",
    bio: "Atende clientes pessoa fisica com foco em renda fixa, renda variavel local e fundos imobiliarios.",
    photo:
      "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=400&h=400&q=80",
    email: "ana@azinvest.com",
    linkedin: "https://www.linkedin.com",
  },
  {
    slug: "carla-souza",
    name: "Carla Souza",
    role: "Assessora de Investimentos",
    bio: "Especialista em previdencia privada, planejamento sucessorio e protecao patrimonial.",
    photo:
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&h=400&q=80",
    email: "carla@azinvest.com",
    linkedin: "https://www.linkedin.com",
  },
  {
    slug: "lucas-meira",
    name: "Lucas Meira",
    role: "Especialista em Opcoes e Estrategias Quantitativas",
    bio: "Constroi estrategias de derivativos para protecao e geracao de renda em carteiras qualificadas.",
    photo:
      "https://images.unsplash.com/photo-1531427186611-ecfd6d936c79?auto=format&fit=crop&w=400&h=400&q=80",
    email: "lucas@azinvest.com",
    linkedin: "https://www.linkedin.com",
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
