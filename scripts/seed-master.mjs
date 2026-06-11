import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const MASTER_LOGIN = process.env.MASTER_LOGIN || "";
const MASTER_PASSWORD = process.env.MASTER_PASSWORD || "";

async function main() {
  if (!MASTER_LOGIN || !MASTER_PASSWORD) {
    throw new Error("Defina MASTER_LOGIN e MASTER_PASSWORD no ambiente (nunca hardcoded).");
  }
  if (MASTER_PASSWORD.length < 8) {
    throw new Error("MASTER_PASSWORD precisa ter no mínimo 8 caracteres.");
  }
  const passwordHash = await bcrypt.hash(MASTER_PASSWORD, 12);

  await prisma.user.upsert({
    where: { email: MASTER_LOGIN },
    update: {
      passwordHash,
      role: "ADMIN",
      name: "Master",
    },
    create: {
      email: MASTER_LOGIN,
      passwordHash,
      role: "ADMIN",
      name: "Master",
    },
  });

  console.log(`Master pronto: ${MASTER_LOGIN}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
