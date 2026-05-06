import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const slug = process.argv[2] || "mayara-alcantara";
const whatsapp = process.argv[3] || "+5548999386708";

async function main() {
  const updated = await prisma.author.update({
    where: { slug },
    data: { whatsapp },
  });
  console.log(`OK: ${updated.name} -> WhatsApp ${whatsapp}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
