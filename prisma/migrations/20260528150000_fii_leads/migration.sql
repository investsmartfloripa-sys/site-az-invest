-- CreateTable
CREATE TABLE "FiiLead" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "aporteMensal" DOUBLE PRECISION,
    "patrimonio" DOUBLE PRECISION,
    "source" TEXT NOT NULL DEFAULT 'PAINEL_FII',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FiiLead_pkey" PRIMARY KEY ("id")
);
