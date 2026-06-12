-- CreateTable
CREATE TABLE "LeadStatus" (
    "id" SERIAL NOT NULL,
    "leadTipo" TEXT NOT NULL,
    "leadId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'novo',
    "nota" TEXT,
    "updatedBy" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadStatus_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LeadStatus_status_idx" ON "LeadStatus"("status");

-- CreateIndex
CREATE UNIQUE INDEX "LeadStatus_leadTipo_leadId_key" ON "LeadStatus"("leadTipo", "leadId");
