-- Lead do simulador de carteira (renda variável). Migration escrita à mão
-- (padrão do repo: o shadow DB do Neon quebra o `migrate dev`; aplicar com
-- `npx prisma migrate deploy`).
CREATE TABLE "AcoesSimLead" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "valorInicial" DOUBLE PRECISION,
    "carteira" JSONB NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'SIMULADOR_ACOES',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AcoesSimLead_pkey" PRIMARY KEY ("id")
);
