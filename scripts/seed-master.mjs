import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const MASTER_LOGIN = "Borbarox";
const MASTER_PASSWORD = "041291";

async function main() {
  const passwordHash = await bcrypt.hash(MASTER_PASSWORD, 12);

  await prisma.user.upsert({
    where: { email: MASTER_LOGIN },
    update: {
      passwordHash,
      role: "MASTER",
      name: "Master",
    },
    create: {
      email: MASTER_LOGIN,
      passwordHash,
      role: "MASTER",
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
