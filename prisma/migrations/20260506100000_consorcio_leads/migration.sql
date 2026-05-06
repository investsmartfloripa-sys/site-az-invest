-- CreateTable
CREATE TABLE "ConsorcioLead" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "tipoBem" TEXT,
    "objetivo" TEXT,
    "valorCarta" DOUBLE PRECISION,
    "prazoMeses" INTEGER,
    "parcela" DOUBLE PRECISION,
    "source" TEXT NOT NULL DEFAULT 'SIMULADOR_CONSORCIO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsorcioLead_pkey" PRIMARY KEY ("id")
);
