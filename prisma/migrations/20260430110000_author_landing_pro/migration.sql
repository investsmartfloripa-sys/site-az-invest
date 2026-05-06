-- AlterTable
ALTER TABLE "Author"
ADD COLUMN "whatsapp" TEXT;

-- AlterTable
ALTER TABLE "AuthorLead"
ADD COLUMN "emailStatus" TEXT NOT NULL DEFAULT 'SKIPPED';
